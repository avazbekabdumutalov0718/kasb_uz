/* WORDRUSH client-side MP3 + ZIP exporter. Self-hosted lame.min.js required. */
(() => {
  'use strict';
  const enc = new TextEncoder();
  const safe = value => String(value).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  const utf8 = value => enc.encode(String(value));
  const le16 = (bytes, pos, n) => { bytes[pos]=n&255; bytes[pos+1]=(n>>>8)&255; };
  const le32 = (bytes,pos,n) => { bytes[pos]=n&255; bytes[pos+1]=(n>>>8)&255;bytes[pos+2]=(n>>>16)&255;bytes[pos+3]=(n>>>24)&255; };
  const CRC = new Uint32Array(256);
  for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xEDB88320^(c>>>1):c>>>1;CRC[i]=c>>>0;}
  function crc32(data) {let c=0xFFFFFFFF;for(let i=0;i<data.length;i++)c=CRC[(c^data[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
  function zipFile(files) {
    const now=new Date();
    const date=((Math.max(1980,now.getFullYear())-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
    const time=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1);
    let localLength=0,centralLength=0;
    const rows=files.map(file=>{
      const name=utf8(file.name),data=file.data instanceof Uint8Array?file.data:utf8(file.data);
      if(data.length>0xFFFFFFFF)throw new Error('Audio fayl juda katta.');
      const row={name,data,crc:crc32(data),offset:localLength};
      localLength+=30+name.length+data.length;
      centralLength+=46+name.length;
      return row;
    });
    const out=new Uint8Array(localLength+centralLength+22);
    let pos=0;
    for(const f of rows){
      le32(out,pos,0x04034B50);le16(out,pos+4,20);le16(out,pos+6,0x0800);
      le16(out,pos+8,0);le16(out,pos+10,time);le16(out,pos+12,date);le32(out,pos+14,f.crc);
      le32(out,pos+18,f.data.length);le32(out,pos+22,f.data.length);le16(out,pos+26,f.name.length);
      le16(out,pos+28,0);pos+=30;out.set(f.name,pos);pos+=f.name.length;
      out.set(f.data,pos);pos+=f.data.length;
    }
    const centralStart=pos;
    for(const f of rows){
      le32(out,pos,0x02014B50);le16(out,pos+4,20);le16(out,pos+6,20);
      le16(out,pos+8,0x0800);le16(out,pos+10,0);le16(out,pos+12,time);le16(out,pos+14,date);
      le32(out,pos+16,f.crc);le32(out,pos+20,f.data.length);le32(out,pos+24,f.data.length);
      le16(out,pos+28,f.name.length);le16(out,pos+30,0);le16(out,pos+32,0);
      le16(out,pos+34,0);le16(out,pos+36,0);le32(out,pos+38,0);le32(out,pos+42,f.offset);
      pos+=46;out.set(f.name,pos);pos+=f.name.length;
    }
    le32(out,pos,0x06054B50);le16(out,pos+4,0);le16(out,pos+6,0);
    le16(out,pos+8,rows.length);le16(out,pos+10,rows.length);
    le32(out,pos+12,pos-centralStart);le32(out,pos+16,centralStart);le16(out,pos+20,0);
    return new Blob([out],{type:'application/zip'});
  }
  async function mp3FromBlob(blob) {
    if(!window.lamejs?.Mp3Encoder)throw new Error('MP3 konvertor yuklanmadi. Internetni tekshirib sahifani qayta oching.');
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    const OfflineCtx=window.OfflineAudioContext||window.webkitOfflineAudioContext;
    if(!AudioCtx||!OfflineCtx)throw new Error('Brauzeringiz MP3 konvertatsiyasini qo‘llamaydi. Chrome yoki Edge’da oching.');
    const ctx=new AudioCtx();
    let decoded;
    try{const buf=await blob.arrayBuffer();decoded=await ctx.decodeAudioData(buf);}finally{await ctx.close();}
    const sampleRate=22050;
    const offline=new OfflineCtx(1,Math.max(1,Math.ceil(decoded.duration*sampleRate)),sampleRate);
    const src=offline.createBufferSource();src.buffer=decoded;src.connect(offline.destination);src.start();
    const rendered=await offline.startRendering();
    const pcm=rendered.getChannelData(0);
    const encoder=new window.lamejs.Mp3Encoder(1,sampleRate,80);
    const chunks=[];let size=0;
    for(let offset=0;offset<pcm.length;offset+=1152){
      const n=Math.min(1152,pcm.length-offset),buf=new Int16Array(n);
      for(let i=0;i<n;i++){const v=Math.max(-1,Math.min(1,pcm[offset+i]));buf[i]=v<0?v*32768:v*32767;}
      const result=encoder.encodeBuffer(buf);
      if(result.length){const copy=new Uint8Array(result);chunks.push(copy);size+=copy.length;}
      if(offset%460800===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    const end=encoder.flush();if(end.length){const copy=new Uint8Array(end);chunks.push(copy);size+=copy.length;}
    const result=new Uint8Array(size);let cursor=0;for(const chunk of chunks){result.set(chunk,cursor);cursor+=chunk.length;}
    if(result.length<100)throw new Error('MP3 yaratilmadi. Yozuvni yangidan sinab ko‘ring.');
    return result;
  }
  async function exportMock({day,topics,recordings,answers,onProgress}) {
    const files=[],sections=[],questionLines=[],missing=[];
    const total=topics.reduce((v,t)=>v+t.questions.length,0);
    let current=0,audios=0;
    for(const t of topics){
      let cards=[];
      questionLines.push('\n## '+t.title+'\n');
      for(let i=0;i<t.questions.length;i++){
        current++;
        const key=t.id+':'+i,clip=recordings.get(key),question=t.questions[i][0];
        const name='audios/'+t.title.replace(/[^A-Za-z0-9_-]/g,'_')+'_'+String(i+1).padStart(2,'0')+'.mp3';
        onProgress?.('MP3 tayyorlanmoqda: '+current+'/'+total+' — '+t.title);
        let player='<p class="missing">Audio yozilmagan.</p>';
        if(clip?.blob?.size){
          const mp3=await mp3FromBlob(clip.blob);
          files.push({name,data:mp3});audios++;
          player='<audio controls preload="metadata" src="'+safe(name)+'"></audio><p><a href="'+safe(name)+'" download>MP3 ni yuklab olish</a></p>';
        } else missing.push(t.title+' / savol '+(i+1));
        const answer=(answers[key]||'').trim()||'Yozma javob yozilmagan.';
        questionLines.push((i+1)+'. '+question+'\n   Javob: '+answer+'\n   Audio: '+(clip?.blob?.size?name:'Yozilmagan')+'\n');
        cards.push('<article><b>QUESTION '+(i+1)+'</b><h3>'+safe(question)+'</h3><p class="answer">'+safe(answer)+'</p>'+player+'</article>');
      }
      sections.push('<section><h2>'+safe(t.title)+'</h2>'+cards.join('')+'</section>');
    }
    const html='<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WORDRUSH — Alisher’s Speaking Day '+day+'</title><style>body{margin:0;background:#f2f7ed;color:#183627;font:16px system-ui,Arial;line-height:1.6}.wrap{max-width:850px;margin:25px auto;padding:20px}header{background:#143c2c;color:#f6ffe9;padding:30px;border-radius:20px}header p{opacity:.85}h2{border-bottom:2px solid #b4d38b;padding-bottom:8px}article{background:white;border:1px solid #d2e0cf;padding:20px;margin:14px 0;border-radius:15px}article b{font-size:12px;color:#558252}audio{width:100%;max-width:460px}.answer{white-space:pre-wrap;background:#f0f5ec;border-radius:10px;padding:13px}.missing{color:#888}@media print{audio{display:none}}</style></head><body><div class="wrap"><header><h1>WORDRUSH · Alisher’s Speaking · Day '+day+'</h1><p>'+topics.map(t=>safe(t.title)).join(' · ')+'</p><p>'+total+' savol · '+audios+' ta MP3 audio. Bu HTML faylni ZIP ichidan chiqargandan keyin oching.</p></header>'+sections.join('')+'</div></body></html>';
    files.unshift({name:'index.html',data:utf8(html)});
    files.push({name:'Savollar_va_javoblar.txt',data:utf8('WORDRUSH — Alisher’s Speaking Day '+day+'\n'+questionLines.join('\n'))});
    files.push({name:'README.txt',data:utf8('WORDRUSH Alisher’s Speaking Day '+day+'\nZIP faylni avval Extract All qiling va index.html faylini oching.\nHar bir mavjud audio audios/ papkasida alohida haqiqiy MP3.\n'+audios+'/'+total+' ta audio yozilgan.\nYozilmagan audio savollar: '+(missing.join('; ')||'yo‘q')+'\n')});
    onProgress?.('ZIP fayl tayyorlanmoqda…');
    return {blob:zipFile(files),audios,total,missing};
  }
  window.WordrushMp3Zip={exportMock};
})();