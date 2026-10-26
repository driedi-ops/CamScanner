const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/scanner.js','utf8');const nodes=new Map(),events={},messages=[];let stopped=0,reset=0,callback,timer;
function el(id){if(!nodes.has(id))nodes.set(id,{textContent:'',disabled:false,addEventListener(){},srcObject:null,classList:{add(){},remove(){}}});return nodes.get(id);}
const target='https://n-sample-script.googleusercontent.com',state='a'.repeat(32),opener={postMessage:(data,origin)=>messages.push({data,origin})};
class Reader {decodeFromConstraints(constraints,video,fn){assert.equal(constraints.audio,false);assert.equal(constraints.video.facingMode.ideal,'environment');callback=fn;video.srcObject={getTracks:()=>[{stop(){stopped++;}}]};return Promise.resolve();}reset(){reset++;}}
const ctx={console,URLSearchParams,Map,Date,Promise,setTimeout:fn=>(timer=fn,1),clearTimeout(){timer=null;},location:{hash:'#'+new URLSearchParams({state,target}),pathname:'/'},history:{replaceState(){}},navigator:{mediaDevices:{getUserMedia(){}}},document:{getElementById:el,addEventListener:(n,fn)=>events[n]=fn},window:{isSecureContext:true,opener,ZXing:{BrowserMultiFormatReader:Reader,DecodeHintType:{POSSIBLE_FORMATS:1,TRY_HARDER:2},BarcodeFormat:{}},addEventListener:(n,fn)=>events[n]=fn}};
vm.createContext(ctx);vm.runInContext(source,ctx);
(async()=>{
 assert(ctx.allowedTarget(target));assert(!ctx.allowedTarget('https://evil.example'));assert(!ctx.allowedTarget('https://script.googleusercontent.com.evil.example'));
 await ctx.startScan();callback({getText:()=> 'TEST-SERIAL-001'});assert.equal(messages[0].data.value,'TEST-SERIAL-001');assert.equal(messages[0].origin,target);assert.equal(stopped,1);assert.equal(reset,1);assert.equal(el('video').srcObject,null);
 events.message({origin:target,source:{},data:{type:'TFI_SCAN_ACK',state,accepted:true}});assert(!el('delivery').textContent.startsWith('Máquina enviada'));
 events.message({origin:target,source:opener,data:{type:'TFI_SCAN_ACK',state,accepted:true}});assert(el('delivery').textContent.startsWith('Máquina enviada'));
 await ctx.startScan();ctx.document.hidden=true;events.visibilitychange();assert.equal(stopped,2);assert.equal(reset,2);
 ctx.document.hidden=false;await ctx.startScan();timer();assert.equal(stopped,3);assert.equal(reset,3);
 assert(!/type=.file|fetch\(|XMLHttpRequest|localStorage|sessionStorage|console\.log|https:\/\/cdn/.test(source));
 const html=fs.readFileSync(__dirname+'/index.html','utf8'),crypto=require('crypto'),vendor=fs.readFileSync(__dirname+'/vendor/zxing-0.23.0.min.js');
 assert(html.includes("connect-src 'none'"));assert(!/onclick=|<script[^>]*https?:/.test(html));
 assert(html.includes('sha384-'+crypto.createHash('sha384').update(vendor).digest('base64')));
 const zx=require(__dirname+'/vendor/zxing-0.23.0.min.js');
 assert.equal(typeof zx.BrowserMultiFormatReader,'function');assert.equal(typeof zx.BrowserMultiFormatReader.prototype.decodeFromConstraints,'function');
 const f=JSON.parse(fs.readFileSync(__dirname+'/ean13-fixture.json','utf8'));
 const pixels=Uint8ClampedArray.from(Array.from({length:f.height},()=>f.row).flat());
 const image=new zx.BinaryBitmap(new zx.HybridBinarizer(new zx.RGBLuminanceSource(pixels,f.width,f.height)));
 const decoder=new zx.MultiFormatReader();decoder.setHints(new Map());assert.equal(decoder.decode(image).getText(),f.expected);
 console.log('PASS origin checks, live camera constraints, local decode result, acknowledged delivery, and camera shutdown on result, background and timeout.');
})().catch(e=>{console.error(e);process.exitCode=1;});
