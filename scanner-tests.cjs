const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/scanner.js','utf8');
const target='https://n-sample-script.googleusercontent.com',state='a'.repeat(32);
function harness(options={}){
 const nodes=new Map(),events={},messages=[],timers=new Map();
 let nextTimer=0,stopped=0,reset=0,callback,focused=0,closed=0;
 function el(id){
  if(!nodes.has(id)){
   const classes=new Set();nodes.set(id,{textContent:'',disabled:false,addEventListener(){},srcObject:null,
    classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),contains:n=>classes.has(n)}});
  }return nodes.get(id);
 }
 const opener={closed:false,postMessage(data,origin){if(options.postThrows)throw Error('blocked');messages.push({data,origin});},focus(){focused++;if(options.focusThrows)throw Error('blocked');}};
 class Reader{
  decodeFromConstraints(constraints,video,fn){assert.equal(constraints.audio,false);assert.equal(constraints.video.facingMode.ideal,'environment');callback=fn;video.srcObject={getTracks:()=>[{stop(){stopped++;}}]};return Promise.resolve();}
  reset(){reset++;}
 }
 const ctx={console,URLSearchParams,Map,Date,Promise,
  setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  location:{hash:'#'+new URLSearchParams({state,target}),pathname:'/'},history:{replaceState(){}},navigator:{mediaDevices:{getUserMedia(){}}},
  document:{hidden:false,getElementById:el,addEventListener:(n,fn)=>events[n]=fn},
  window:{isSecureContext:true,opener:options.standalone?null:opener,
   close(){closed++;if(options.closeThrows)throw Error('blocked');},
   ZXing:{BrowserMultiFormatReader:Reader,DecodeHintType:{POSSIBLE_FORMATS:1,TRY_HARDER:2},BarcodeFormat:{}},addEventListener:(n,fn)=>events[n]=fn}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,el,events,messages,opener,
  counts:()=>({stopped,reset,focused,closed}),
  found:value=>callback({getText:()=>value}),
  ack(accepted,overrides={}){events.message({origin:target,source:opener,data:{type:'TFI_SCAN_ACK',state,accepted},...overrides});},
  tick(ms){for(const [id,t] of Array.from(timers)){if(t.ms===ms&&timers.has(id)){timers.delete(id);t.fn();}}},
  timerCount:()=>timers.size};
}
(async()=>{
 // A decode alone must never close the scanner or claim delivery.
 const h=harness();assert(h.ctx.allowedTarget(target));assert(!h.ctx.allowedTarget('https://evil.example'));assert(!h.ctx.allowedTarget('https://script.googleusercontent.com.evil.example'));
 h.ack(true);assert.equal(h.counts().closed,0);
 await h.ctx.startScan();h.found('TEST-SERIAL-001');
 assert.equal(h.messages[0].data.value,'TEST-SERIAL-001');assert.equal(h.messages[0].origin,target);
 assert.equal(h.counts().stopped,1);assert.equal(h.counts().reset,1);assert.equal(h.el('video').srcObject,null);assert.equal(h.counts().closed,0);
 assert(h.el('delivery').textContent.includes('Esperando confirmación'));
 h.ack(true,{source:{}});h.ack(true,{origin:'https://evil.example'});
 h.ack(true,{data:{type:'TFI_SCAN_ACK',state:'b'.repeat(32),accepted:true}});h.ack('true');
 assert.equal(h.counts().closed,0);
 // Verified acceptance immediately requests return, without a button tap.
 h.ack(true);assert.equal(h.counts().focused,1);assert.equal(h.counts().closed,1);
 assert(h.el('resultTitle').textContent.includes('Máquina recibida'));assert(!h.el('return').classList.contains('hidden'));
 h.tick(3000);assert(!h.el('delivery').textContent.includes('No llegó'));
 h.tick(800);assert(h.el('status').textContent.includes('Máquina recibida en mantenimiento'));assert(h.el('delivery').textContent.includes('toque Volver'));
 h.ack(true);assert.equal(h.counts().closed,1);
 // Focus can fail for the Apps Script iframe. Close must still run independently.
 const deniedFocus=harness({focusThrows:true});await deniedFocus.ctx.startScan();deniedFocus.found('ABC');deniedFocus.ack(true);assert.equal(deniedFocus.counts().closed,1);
 const deniedClose=harness({closeThrows:true});await deniedClose.ctx.startScan();deniedClose.found('ABC');deniedClose.ack(true);deniedClose.tick(800);assert(deniedClose.el('status').textContent.includes('Máquina recibida'));assert(!deniedClose.el('return').classList.contains('hidden'));
 // Unknown codes stay open with an explanation and a rescan route.
 const unknown=harness();await unknown.ctx.startScan();unknown.found('UNKNOWN');unknown.ack(false);assert.equal(unknown.counts().closed,0);assert(unknown.el('result').classList.contains('warning'));assert(unknown.el('delivery').textContent.includes('no identifica una sola máquina'));
 await unknown.ctx.startScan();assert(!unknown.el('result').classList.contains('warning'));unknown.found('VALID');unknown.ack(true);assert.equal(unknown.counts().closed,1);
 // No response / blocked sender / standalone scans must not imply delivery.
 const late=harness();await late.ctx.startScan();late.found('ABC');late.tick(3000);assert(late.el('status').textContent.includes('sin confirmar'));assert.equal(late.counts().closed,0);late.ack(true);assert.equal(late.counts().closed,1);
 const restart=harness();await restart.ctx.startScan();restart.found('OLD');await restart.ctx.startScan();restart.ack(true);assert.equal(restart.counts().closed,0);
 const failed=harness({postThrows:true});await failed.ctx.startScan();failed.found('ABC');failed.ack(true);assert.equal(failed.counts().closed,0);assert(failed.el('delivery').textContent.includes('No se pudo enviar'));
 const solo=harness({standalone:true});await solo.ctx.startScan();solo.found('ABC');assert.equal(solo.counts().closed,0);assert(solo.el('delivery').textContent.includes('Copie el código'));
 // Return timers must not overwrite the next scan or a page being left.
 await h.ctx.startScan();assert.equal(h.timerCount(),1);h.ctx.document.hidden=true;h.events.visibilitychange();assert.equal(h.counts().stopped,2);assert.equal(h.counts().reset,2);
 h.ctx.document.hidden=false;await h.ctx.startScan();h.tick(60000);assert.equal(h.counts().stopped,3);assert.equal(h.counts().reset,3);
 const leaving=harness();await leaving.ctx.startScan();leaving.found('ABC');leaving.events.pagehide();assert.equal(leaving.timerCount(),0);leaving.ack(true);assert.equal(leaving.counts().closed,0);
 assert(!/type=.file|fetch\(|XMLHttpRequest|localStorage|sessionStorage|console\.log|https:\/\/cdn/.test(source));
 const html=fs.readFileSync(__dirname+'/index.html','utf8'),crypto=require('crypto'),vendor=fs.readFileSync(__dirname+'/vendor/zxing-0.23.0.min.js');
 assert(html.includes("connect-src 'none'"));assert(!/onclick=|<script[^>]*https?:/.test(html));
 assert(html.includes('scanner.js?v=0.1.3'));assert(html.includes('sha384-'+crypto.createHash('sha384').update(vendor).digest('base64')));
 const zx=require(__dirname+'/vendor/zxing-0.23.0.min.js');
 assert.equal(typeof zx.BrowserMultiFormatReader,'function');assert.equal(typeof zx.BrowserMultiFormatReader.prototype.decodeFromConstraints,'function');
 const f=JSON.parse(fs.readFileSync(__dirname+'/ean13-fixture.json','utf8'));
 const pixels=Uint8ClampedArray.from(Array.from({length:f.height},()=>f.row).flat());
 const image=new zx.BinaryBitmap(new zx.HybridBinarizer(new zx.RGBLuminanceSource(pixels,f.width,f.height)));
 const decoder=new zx.MultiFormatReader();decoder.setHints(new Map());assert.equal(decoder.decode(image).getText(),f.expected);
 console.log('PASS verified-ACK auto-return, spoof/rejection/no-ACK safety, denied focus/close fallback, camera shutdown, local decode, CSP and vendor integrity.');
})().catch(e=>{console.error(e);process.exitCode=1;});
