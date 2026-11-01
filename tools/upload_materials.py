#!/usr/bin/env python3
"""Upload all WORDRUSH IELTS materials one file at a time from the supplied ZIP.

Run INSIDE the local kasb_uz Git repository:
    python tools/upload_materials.py "WORDRUSH_IELTS_Materials_Complete.zip"

Requires Git configured with GitHub authentication. No token is stored or asked
for. Small files are staged individually and pushed in one commit; large files
(>=8 MiB) are committed and pushed one at a time to keep Git pushes manageable.
The current materials/index.html and materials/jszip.min.js are NEVER overwritten.
"""
import argparse
import hashlib
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
from zipfile import ZipFile

REPO = Path(__file__).resolve().parent.parent
THRESHOLD = 8 * 1024 * 1024
EXCLUDE = {"materials/index.html", "materials/app.js", "materials/jszip.min.js"}

def git(*args):
    return subprocess.run(["git", "-C", str(REPO), *args], check=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

def push():
    print("Pushing commit to GitHub…", flush=True)
    try:
        git("push", "origin", "main")
    except subprocess.CalledProcessError as error:
        print(error.stderr, file=sys.stderr)
        raise SystemExit("Git push failed. Check GitHub login, then run git push origin main.")

def commit(message):
    if not git("diff", "--cached", "--name-only").stdout.strip():
        print("Nothing new to commit.")
        return False
    print("Committing:", message, flush=True)
    git("commit", "-m", message)
    push()
    return True

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("zip", type=Path, help="Path to WORDRUSH_IELTS_Materials_Complete.zip")
    args = p.parse_args()
    archive = args.zip.expanduser().resolve()
    if not archive.is_file():
        raise SystemExit("ZIP file not found: " + str(archive))
    if not (REPO / ".git").exists():
        raise SystemExit("Put this script inside the cloned kasb_uz Git repository.")
    origin = git("remote", "get-url", "origin").stdout.strip()
    if "kasb_uz" not in origin:
        raise SystemExit("Wrong Git repository: expected kasb_uz.")
    if git("diff", "--cached", "--name-only").stdout.strip():
        raise SystemExit("You have staged changes. Commit or unstage them first.")

    small, large, skipped = [], [], 0
    with ZipFile(archive) as z:
        members = [m for m in z.infolist() if not m.is_dir()]
        for m in members:
            name = PurePosixPath(m.filename)
            if not name.parts or name.parts[0] != "materials" or len(name.parts) < 2:
                continue
            relative = str(name)
            if relative in EXCLUDE:
                skipped += 1
                continue
            if ".." in name.parts or name.is_absolute():
                raise SystemExit("Invalid path in ZIP: " + relative)
            # Use a stream so large MP3s never need to be held in memory.
            target = REPO.joinpath(*name.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            import shutil
            with z.open(m) as source, target.open("wb") as dest:
                shutil.copyfileobj(source, dest, length=1024 * 1024)
            if m.file_size >= THRESHOLD:
                large.append(relative)
            else:
                small.append(relative)
    print(f"Extracted {len(small)} small, {len(large)} large; skipped {skipped} old app files.")

    # Stage each file separately, but commit only once for speed.
    for i, name in enumerate(small, 1):
        git("add", "--", name)
        print(f"[{i}/{len(small)}] staged {name}", flush=True)
    commit(f"Upload WORDRUSH IELTS materials: {len(small)} small files")

    # Big files, including MP3s, travel in separate pushes.
    for i, name in enumerate(large, 1):
        git("add", "--", name)
        print(f"[LARGE {i}/{len(large)}] {name}", flush=True)
        commit("Upload IELTS material: " + Path(name).name)
    print("Complete: files are in GitHub. Vercel will build the latest main commit.")

if __name__ == "__main__":
    main()
