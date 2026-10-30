/* WordRush browser-only MP3 + ZIP export; no network needed. */
(() => {
  'use strict';
  const te = new TextEncoder();
  function crc32(bytes) {
    let crc = -1;
    for (const x of bytes) { crc ^= x; for (let j=0;j<8;j++) crc=(crc>>>1)^((crc&1)?0xEDB88320:0); }
    return (crc^-1)>>>0;
  }
  const u16=(view,p,n)=>view.setUint16(p,n,true), u32=(view,p,n)=>view.setUint32(p,n>>>0,true);
  function zipFile(files) {
    const parts=[], directory=[]; let offset=0;
    for(const file of files) {
      const name=te.encode(file.name), data=file.data instanceof Uint8Array?file.data:te.encode(file.data);
      const crc=crc32(data), header=new Uint8Array(30+name.length), v=new DataView(header.buffer);
      u32(v,0,0x04034b50); u16(v,4,20); u16(v,6,0x800); u16(v,8,0); u32(v,14,crc); u32(v,18,data.length); u32(v,22,data.length); u16(v,26,name.length);
      header.set(name,30);parts.push(header,data);
      const entry=new Uint8Array(46+name.length),e=new DataView(entry.buffer);
      u32(e,0,0x02014b50);u16(e,4,20);u16(e,6,20);u16(e,8,0x800);u16(e,10,0);u32(e,16,crc);u32(e,20,data.length);u32(e,24,data.length);u16(e,28,name.length);u32(e,42,offset);entry.set(name,46);directory.push(entry);
      offset+=header.length+data.length;
    }
    const end=new Uint8Array(22), v=new DataView(end.buffer);
    u32(v,0,0x06054b50);u16(v,8,files.length);u16(v,10,files.length);u32(v,12,directory.reduce((a,b)=>a+b.length,0));u32(v,16,offset);
    return new Blob([...parts,...directory,end],{type:'application/zip'});
  }
  async function mp3(blob) {
    if(!window.lamejs?.Mp3Encoder)throw Error('MP3 kodlovchi yuklanmagan. Sahifani yangilang.');
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    try {
      const buffer=await ctx.decodeAudioData(await blob.arrayBuffer());
      const rate=44100, count=Math.ceil(buffer.duration*rate), channels=buffer.numberOfChannels;
      const out=[];
      for(let ch=0;ch<Math.min(channels,2);ch++){
        const input=buffer.getChannelData(ch), pcm=new Int16Array(count);
        for(let i=0;i<count;i++){
          const index=i*buffer.sampleRate/rate, low=Math.min(input.length-1,Math.floor(index)), high=Math.min(input.length-1,low+1), fraction=index-low;
          const v=Math.max(-1,Math.min(1,input[low]*(1-fraction)+input[high]*fraction));
          pcm[i]=Math.round(v*32767);
        }
        out.push(pcm);
      }
      const encoder=new lamejs.Mp3Encoder(out.length,rate,96), chunks=[];
      for(let p=0;p<count;p+=1152) {
        const slice=out[0].subarray(p,p+1152);
        const bytes=out.length===2?encoder.encodeBuffer(slice,out[1].subarray(p,p+1152)):encoder.encodeBuffer(slice);
        if(bytes.length)chunks.push(new Uint8Array(bytes));
      }
      const last=encoder.flush();if(last.length)chunks.push(new Uint8Array(last));
      const n=chunks.reduce((a,b)=>a+b.length,0), joined=new Uint8Array(n);
      let pos=0;for(const b of chunks){joined.set(b,pos);pos+=b.length;} return joined;
    } finally {await ctx.close();}
  }
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function build({day,topics,recordings,answers,onProgress}) {
    const files=[], text=[], sections=[], used=new Set();
    let n=0, actual=0;
    const count=topics.reduce((a,t)=>a+t.questions.length,0);
    for(const topic of topics) {
      let cards='';
      for(let i=0;i<topic.questions.length;i++) {
        n++;const key=topic.id+':'+i, title=topic.questions[i][0], answer=(answers[key]||'').trim();
        const file='audio/'+topic.id+'-Q'+String(i+1).padStart(2,'0')+'.mp3';
        let audio='';
        if(recordings.has(key)?.blob) {
          onProgress?.('MP3 konvertatsiya: '+n+'/'+count+' — '+title);
          files.push({name:file,data:await mp3(recordings.get(key).blob)});
          audio='<audio controls preload="metadata" src="'+file+'"></audio><p><a href="'+file+'" download>MP3 ni saqlash</a></p>';
          actual++;
        } else audio='<p class="missing">Audio yozilmagan</p>';
        text.push(topic.title+' — Savol '+(i+1)+'\n'+title+'\nYozma javob: '+(answer||'Kiritilmagan')+'\nAudio: '+(recordings.has(key)?.blob?file:'yo‘q')+'\n');
        cards+='<article><small>QUESTION '+(i+1)+'</small><h3>'+escape(title)+'</h3><p>'+escape(answer||'Yozma javob kiritilmagan.')+'</p>'+audio+'</article>';
      }
      sections.push('<section><h2>'+escape(topic.title)+'</h2>'+cards+'</section>');
    }
    const html='<!doctype html><html lang="uz"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WORDRUSH — Alisher’s Speaking Day '+day+'</title><style>body{background:#f2f8ef;color:#173329;font:16px/1.6 system-ui;margin:auto;max-width:820px;padding:24px}header{background:#123d2e;color:white;padding:26px;border-radius:18px}article{background:white;border:1px solid #d2e1cf;border-radius:16px;padding:20px;margin:16px 0}article p{white-space:pre-wrap}h2{margin-top:42px}audio{width:100%}.missing{color:#888}small{color:#588260}</style><header><h1>Alisher’s Speaking — Day '+day+'</h1><p>'+count+' ta savol · '+actual+' ta MP3 audio · WORDRUSH</p></header>'+sections.join('')+'</html>';
    files.unshift({name:'index.html',data:html},{name:'Savollar_va_javoblar.txt',data:text.join('\n')});
    return {blob:zipFile(files),count:actual};
  }
  async function download(blob,name) {
    if(window.showSaveFilePicker) {
      try {
        const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'ZIP archive',accept:{'application/zip':['.zip']}}]});
        const stream=await handle.createWritable();await stream.write(blob);await stream.close();return;
      }catch(e){if(e.name==='AbortError')return; }
    }
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),120000);
  }
  window.WORDRUSH_ZIP={build,download};
})();
