const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/scanner.js','utf8');
const target='https://n-sample-script.googleusercontent.com',state='a'.repeat(32);
function harness(options={}){
 const nodes=new Map(),events={},messages=[],timers=new Map();
 let nextTimer=0,stopped=0,reset=0,callback,focused=0,closed=0,cameraRequests=0;
 function el(id){
  if(!nodes.has(id)){
   const classes=new Set();nodes.set(id,{textContent:'',disabled:false,addEventListener(n,fn){this[n]=fn;},srcObject:null,
    classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),contains:n=>classes.has(n)}});
  }return nodes.get(id);
 }
 const opener={closed:!!options.openerClosed,postMessage(data,origin){if(options.postThrows)throw Error('blocked');messages.push({data,origin});},focus(){focused++;if(options.focusThrows)throw Error('blocked');}};
 class Reader{
  decodeFromConstraints(constraints,video,fn){cameraRequests++;assert.equal(constraints.audio,false);assert.equal(constraints.video.facingMode.ideal,'environment');callback=fn;if(options.cameraError)return Promise.reject({name:options.cameraError});video.srcObject={getTracks:()=>[{stop(){stopped++;}}]};return Promise.resolve();}
  reset(){reset++;}
 }
 const ctx={console,URLSearchParams,Map,Date,Promise,
  setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  location:{hash:options.appLaunch?'#'+new URLSearchParams({state,target:options.target||target}):'',pathname:'/'},history:{replaceState(){}},navigator:{mediaDevices:{getUserMedia(){}}},
  document:{hidden:!!options.hidden,getElementById:el,addEventListener:(n,fn)=>events[n]=fn},
  window:{isSecureContext:true,opener:options.standalone?null:opener,
   close(){closed++;if(options.closeThrows)throw Error('blocked');},
   ZXing:{BrowserMultiFormatReader:Reader,DecodeHintType:{POSSIBLE_FORMATS:1,TRY_HARDER:2},BarcodeFormat:{CODE_39:'C39',QR_CODE:'QR'}},addEventListener:(n,fn)=>events[n]=fn}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 // Most bridge tests launch manually; set the same valid session without running startup.
 if(!options.appLaunch){ctx.scanState=state;ctx.scanTarget=target;}
 return {ctx,el,events,messages,opener,
  counts:()=>({stopped,reset,focused,closed,cameraRequests}),
  found:value=>callback({getText:()=>value}),
  // Bridge tests: after the plate-first window, any code is accepted.
  foundAny(value){this.tick(8000);callback({getText:()=>value});},
  ack(accepted,overrides={}){events.message({origin:target,source:opener,data:{type:'TFI_SCAN_ACK',state,accepted},...overrides});},
  tick(ms){for(const [id,t] of Array.from(timers)){if(t.ms===ms&&timers.has(id)){timers.delete(id);t.fn();}}},
  timerCount:()=>timers.size};
}
(async()=>{
 // One automatic attempt for an app launch; no camera on an ordinary public visit.
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 const auto=harness({appLaunch:true});await flush();assert.equal(auto.counts().cameraRequests,1);assert(auto.el('start').classList.contains('hidden'));
 auto.ctx.document.hidden=true;auto.events.visibilitychange();assert.equal(auto.counts().stopped,1);
 auto.ctx.document.hidden=false;auto.events.visibilitychange();await flush();assert.equal(auto.counts().cameraRequests,1);
 auto.el('start').click();await flush();assert.equal(auto.counts().cameraRequests,2);
 const publicVisit=harness();await flush();assert.equal(publicVisit.counts().cameraRequests,0);
 const closedOpener=harness({appLaunch:true,openerClosed:true});await flush();assert.equal(closedOpener.counts().cameraRequests,0);
 const badLaunch=harness({appLaunch:true,target:'https://evil.example'});await flush();assert.equal(badLaunch.counts().cameraRequests,0);
 const background=harness({appLaunch:true,hidden:true});await flush();assert.equal(background.counts().cameraRequests,0);background.ctx.document.hidden=false;background.events.visibilitychange();await flush();assert.equal(background.counts().cameraRequests,1);
 const denied=harness({appLaunch:true,cameraError:'NotAllowedError'});await flush();assert.equal(denied.counts().cameraRequests,1);assert(!denied.el('start').disabled);assert(!denied.el('start').classList.contains('hidden'));assert(denied.el('status').textContent.includes('Toque Abrir cámara'));
 denied.ctx.document.hidden=true;denied.events.visibilitychange();denied.ctx.document.hidden=false;denied.events.visibilitychange();await flush();assert.equal(denied.counts().cameraRequests,1);
 const stopped=harness({appLaunch:true});await flush();stopped.el('stop').click();stopped.ctx.document.hidden=false;stopped.events.visibilitychange();await flush();assert.equal(stopped.counts().cameraRequests,1);assert(!stopped.el('start').classList.contains('hidden'));
 // A decode alone must never close the scanner or claim delivery.
 const h=harness();assert(h.ctx.allowedTarget(target));assert(!h.ctx.allowedTarget('https://evil.example'));assert(!h.ctx.allowedTarget('https://script.googleusercontent.com.evil.example'));
 h.ack(true);assert.equal(h.counts().closed,0);
 await h.ctx.startScan();h.foundAny('TEST-SERIAL-001');
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
 h.tick(800);assert(h.el('status').textContent.includes('Máquina recibida en el formulario'));assert(h.el('delivery').textContent.includes('toque Volver'));
 h.ack(true);assert.equal(h.counts().closed,1);
 // Focus can fail for the Apps Script iframe. Close must still run independently.
 const deniedFocus=harness({focusThrows:true});await deniedFocus.ctx.startScan();deniedFocus.foundAny('ABC');deniedFocus.ack(true);assert.equal(deniedFocus.counts().closed,1);
 const deniedClose=harness({closeThrows:true});await deniedClose.ctx.startScan();deniedClose.foundAny('ABC');deniedClose.ack(true);deniedClose.tick(800);assert(deniedClose.el('status').textContent.includes('Máquina recibida'));assert(!deniedClose.el('return').classList.contains('hidden'));
 // Unknown codes stay open with an explanation and a rescan route.
 const unknown=harness();await unknown.ctx.startScan();unknown.foundAny('UNKNOWN');unknown.ack(false);assert.equal(unknown.counts().closed,0);assert(unknown.el('result').classList.contains('warning'));assert(unknown.el('delivery').textContent.includes('no identifica una sola máquina'));
 await unknown.ctx.startScan();assert(!unknown.el('result').classList.contains('warning'));unknown.foundAny('VALID');unknown.ack(true);assert.equal(unknown.counts().closed,1);
 // No response / blocked sender / standalone scans must not imply delivery.
 const late=harness();await late.ctx.startScan();late.foundAny('ABC');late.tick(3000);assert(late.el('status').textContent.includes('sin confirmar'));assert.equal(late.counts().closed,0);late.ack(true);assert.equal(late.counts().closed,1);
 const restart=harness();await restart.ctx.startScan();restart.foundAny('OLD');await restart.ctx.startScan();restart.ack(true);assert.equal(restart.counts().closed,0);
 const failed=harness({postThrows:true});await failed.ctx.startScan();failed.foundAny('ABC');failed.ack(true);assert.equal(failed.counts().closed,0);assert(failed.el('delivery').textContent.includes('No se pudo enviar'));
 const solo=harness({standalone:true});await solo.ctx.startScan();solo.foundAny('ABC');assert.equal(solo.counts().closed,0);assert(solo.el('delivery').textContent.includes('Copie el código'));
 // Return timers must not overwrite the next scan or a page being left.
 await h.ctx.startScan();assert.equal(h.timerCount(),2);h.ctx.document.hidden=true;h.events.visibilitychange();assert.equal(h.counts().stopped,2);assert.equal(h.counts().reset,2);
 h.ctx.document.hidden=false;await h.ctx.startScan();h.tick(60000);assert.equal(h.counts().stopped,3);assert.equal(h.counts().reset,3);
 const leaving=harness();await leaving.ctx.startScan();leaving.foundAny('ABC');leaving.events.pagehide();assert.equal(leaving.timerCount(),0);leaving.ack(true);assert.equal(leaving.counts().closed,0);

 // v0.1.6 plate first: a sticker seen first is held; the plate wins inside the window; sticker used when the window ends.
 const p1=harness();await p1.ctx.startScan();p1.found('39967');assert.equal(p1.messages.length,0);assert(p1.el('status').textContent.includes('Sigo buscando la placa'));
 p1.found('CAT00320EMYK30153');assert.equal(p1.messages[0].data.value,'CAT00320EMYK30153');
 const p2=harness();await p2.ctx.startScan();p2.found('39967');p2.found('https://agendate.link/core/maquina/abc');assert.equal(p2.messages.length,0);p2.tick(8000);assert.equal(p2.messages[0].data.value,'39967');
 const p3=harness();await p3.ctx.startScan();p3.tick(8000);assert.equal(p3.messages.length,0);assert(p3.el('status').textContent.includes('No se pudo leer la placa'));p3.found('40010');assert.equal(p3.messages[0].data.value,'40010');
 const p4=harness();await p4.ctx.startScan();assert(!p4.el('any').classList.contains('hidden'));p4.el('any').click();p4.found('40010');assert.equal(p4.messages[0].data.value,'40010');
 const p5=harness();await p5.ctx.startScan();p5.found('MYK30153');assert.equal(p5.messages[0].data.value,'MYK30153');
 for(const [v,plate] of [['CAT00320CMYK11426',true],['cat00950jtn201001',true],['TN200735',true],['MYK11426',true],['39967',false],['40010',false],['https://agendate.link/core/maquina/c139',false],['7591196000017',false],['TFI-MACHINE:1234abcd',false]])assert.equal(p1.ctx.isPlateCode(v),plate,v);
 // Restarting or stopping clears the plate timer and any held sticker.
 const p6=harness();await p6.ctx.startScan();p6.found('39967');await p6.ctx.startScan();p6.tick(8000);assert.equal(p6.messages.length,0);
 // Only Code 39 and QR are searched (speed): the reader is built with exactly these formats.
 assert(/POSSIBLE_FORMATS,\[zx\.BarcodeFormat\.CODE_39,zx\.BarcodeFormat\.QR_CODE\]\)/.test(source));
 // Fallback order: a Holt sticker wins over a QR link seen earlier.
 const p7=harness();await p7.ctx.startScan();p7.found('https://agendate.link/core/maquina/abc');p7.found('39935');p7.tick(8000);assert.equal(p7.messages[0].data.value,'39935');
 const p8=harness();await p8.ctx.startScan();p8.found('39935');p8.found('https://agendate.link/core/maquina/abc');p8.tick(8000);assert.equal(p8.messages[0].data.value,'39935');
 // Torch button only when the camera reports torch support.
 assert(p1.el('torch').classList.contains('hidden'));
 assert(!/type=.file|fetch\(|XMLHttpRequest|localStorage|sessionStorage|console\.log|https:\/\/cdn/.test(source));
 const html=fs.readFileSync(__dirname+'/index.html','utf8'),crypto=require('crypto'),vendor=fs.readFileSync(__dirname+'/vendor/zxing-0.23.0.min.js');
 assert(html.includes("connect-src 'none'"));assert(!/onclick=|<script[^>]*https?:/.test(html));
 assert(html.includes('scanner.js?v=0.1.8'));assert(!html.includes('PRUEBAS'));assert(html.includes('sha384-'+crypto.createHash('sha384').update(vendor).digest('base64')));
 const zx=require(__dirname+'/vendor/zxing-0.23.0.min.js');
 assert.equal(typeof zx.BrowserMultiFormatReader,'function');assert.equal(typeof zx.BrowserMultiFormatReader.prototype.decodeFromConstraints,'function');
 const f=JSON.parse(fs.readFileSync(__dirname+'/ean13-fixture.json','utf8'));
 const pixels=Uint8ClampedArray.from(Array.from({length:f.height},()=>f.row).flat());
 const image=new zx.BinaryBitmap(new zx.HybridBinarizer(new zx.RGBLuminanceSource(pixels,f.width,f.height)));
 const decoder=new zx.MultiFormatReader();decoder.setHints(new Map());assert.equal(decoder.decode(image).getText(),f.expected);
 console.log('PASS app-launch camera auto-start, manual fallback without permission loops, background/stop handling, verified-ACK auto-return, spoof/rejection/no-ACK safety, camera shutdown, local decode, CSP and vendor integrity.');
})().catch(e=>{console.error(e);process.exitCode=1;});
