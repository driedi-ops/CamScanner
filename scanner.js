'use strict';
var scanReader=null,scanRun=0,scanTimer=null,scanValue='',scanState='',scanTarget='';
var scanWaiting=false,scanDelivered=false,scanAckTimer=null,scanReturnTimer=null,scanAutoPending=false;
// Plate first: for PLATE_MS only the CAT plate (PIN/serial) is accepted. A Holt sticker or QR seen meanwhile is kept
// and used when that time runs out; with nothing seen, any code is accepted from then on.
var PLATE_MS=5000,scanPhase='placa',scanFallback='',scanPhaseTimer=null,scanTrack=null,torchOn=false;
function isPlateCode(v){
 var k=String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 if(/^CAT[0-9A-Z]{14}$/.test(k))return true; // PIN completo: CAT00320CMYK11426
 if(/^[0-9A-Z]{17}$/.test(k)&&/[A-Z]/.test(k)&&/[0-9]/.test(k))return true; // PIN de 17 sin prefijo CAT
 return /^[A-Z0-9]{3}[0-9]{5}$/.test(k)&&/[A-Z]/.test(k); // serial: MYK11426, TN200735
}
var el=function(id){return document.getElementById(id);};
function allowedTarget(origin){return /^https:\/\/(?:[a-z0-9-]+-)?script\.googleusercontent\.com$/.test(origin);}
(function(){
 var params=new URLSearchParams(location.hash.slice(1)),state=params.get('state')||'',target=params.get('target')||'';
 if(/^[a-f0-9]{32}$/.test(state)&&allowedTarget(target)){scanState=state;scanTarget=target;}
 history.replaceState(null,'',location.pathname);
})();
function loadDecoder(){
 return window.ZXing?Promise.resolve(window.ZXing):Promise.reject(new Error('decoder'));
}
function stopScan(note){
 scanRun++;if(scanTimer)clearTimeout(scanTimer);scanTimer=null;if(scanPhaseTimer)clearTimeout(scanPhaseTimer);scanPhaseTimer=null;
 scanTrack=null;torchOn=false;el('torch').classList.add('hidden');el('torch').textContent='Encender linterna';el('any').classList.add('hidden');
 if(scanReader){scanReader.reset();scanReader=null;}
 var video=el('video');if(video.srcObject){video.srcObject.getTracks().forEach(function(t){t.stop();});video.srcObject=null;}
 el('start').disabled=false;el('start').classList.remove('hidden');el('stop').classList.add('hidden');if(note)el('status').textContent=note;
}
function clearDeliveryTimers(){
 if(scanAckTimer)clearTimeout(scanAckTimer);scanAckTimer=null;
 if(scanReturnTimer)clearTimeout(scanReturnTimer);scanReturnTimer=null;
}
function cameraError(error){
 if(error&&error.message==='decoder')return 'No se pudo cargar el lector. Revise la conexión y vuelva a intentar.';
 if(error&&['NotAllowedError','SecurityError'].indexOf(error.name)>=0)return 'Toque Abrir cámara. Si sigue bloqueada, permita la cámara para este sitio en los ajustes del navegador y vuelva a intentar.';
 if(error&&error.name==='NotFoundError')return 'No se encontró una cámara en este dispositivo.';
 if(error&&error.name==='NotReadableError')return 'Otra aplicación está usando la cámara. Ciérrela y vuelva a intentar.';
 return 'No se pudo abrir la cámara. Abra este enlace en Safari o Chrome y vuelva a intentar.';
}
async function startScan(){
 scanAutoPending=false;
 clearDeliveryTimers();scanWaiting=false;scanDelivered=false;
 stopScan();scanValue='';el('return').classList.add('hidden');el('result').classList.add('hidden');el('result').classList.remove('pending','warning');el('camera').classList.remove('hidden');el('start').classList.remove('hidden');el('copy').textContent='Copiar código';
 if(!window.isSecureContext||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){el('status').textContent='Abra este lector en una pestaña HTTPS de Safari o Chrome para usar la cámara.';return;}
 var run=scanRun;el('start').disabled=true;el('start').classList.add('hidden');el('stop').classList.remove('hidden');el('status').textContent='Abriendo cámara…';
 try{
  var zx=await loadDecoder();if(run!==scanRun)return;
  var hints=new Map();hints.set(zx.DecodeHintType.POSSIBLE_FORMATS,[zx.BarcodeFormat.CODE_39,zx.BarcodeFormat.CODE_128,zx.BarcodeFormat.QR_CODE,zx.BarcodeFormat.DATA_MATRIX,zx.BarcodeFormat.EAN_13,zx.BarcodeFormat.EAN_8,zx.BarcodeFormat.ITF,zx.BarcodeFormat.UPC_A,zx.BarcodeFormat.UPC_E]);
  hints.set(zx.DecodeHintType.TRY_HARDER,true);
  var reader=new zx.BrowserMultiFormatReader(hints,250);scanReader=reader;
  scanPhase='placa';scanFallback='';
  await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}},el('video'),function(result){if(run===scanRun&&result)onDecoded(result.getText());});
  if(run!==scanRun){reader.reset();return;}
  setupTrack();
  el('status').textContent='Buscando la placa CAT… Mantenga el teléfono quieto.';el('hint').textContent='Apunte a la placa CAT. Luz de lado, no de frente.';
  el('any').classList.remove('hidden');
  scanPhaseTimer=setTimeout(function(){scanPhaseTimer=null;if(run===scanRun)acceptAnyCode(true);},PLATE_MS);
  scanTimer=setTimeout(function(){stopScan('Aún no se pudo leer. Limpie la placa, evite reflejos y vuelva a intentar.');},60000);
 }catch(error){if(run===scanRun)stopScan(cameraError(error));}
}
function onDecoded(value){
 value=String(value||'').trim();if(!value||value.length>512)return;
 if(scanPhase==='placa'&&!isPlateCode(value)){
  if(!scanFallback){scanFallback=value;el('status').textContent='Leí un sticker. Sigo buscando la placa unos segundos…';}
  return;
 }
 foundCode(value);
}
// After the plate time (or on tap): use a sticker already seen, otherwise accept the next code of any kind.
function acceptAnyCode(timedOut){
 if(scanPhaseTimer)clearTimeout(scanPhaseTimer);scanPhaseTimer=null;
 scanPhase='cualquiera';el('any').classList.add('hidden');
 if(scanFallback){foundCode(scanFallback);return;}
 el('status').textContent=timedOut?'No se pudo leer la placa. Apunte al sticker Holt o al QR.':'Apunte al sticker Holt o al QR.';
 el('hint').textContent='Apunte al sticker Holt o al QR';
}
// Linterna y enfoque: solo si el navegador lo permite (Chrome en Android sí; Safari en iPhone no ofrece linterna).
function setupTrack(){
 var video=el('video'),tracks=video.srcObject&&video.srcObject.getVideoTracks?video.srcObject.getVideoTracks():[];
 scanTrack=tracks[0]||null;if(!scanTrack||!scanTrack.getCapabilities)return;
 var caps={};try{caps=scanTrack.getCapabilities()||{};}catch(e){}
 if(caps.focusMode&&caps.focusMode.indexOf('continuous')>=0){try{scanTrack.applyConstraints({advanced:[{focusMode:'continuous'}]}).catch(function(){});}catch(e){}}
 if(caps.torch)el('torch').classList.remove('hidden');
}
async function toggleTorch(){
 if(!scanTrack)return;
 try{await scanTrack.applyConstraints({advanced:[{torch:!torchOn}]});torchOn=!torchOn;el('torch').textContent=torchOn?'Apagar linterna':'Encender linterna';}
 catch(e){el('torch').classList.add('hidden');el('status').textContent='Este teléfono no permite la linterna desde la página. Use otra luz, de lado.';}
}
function autoStartScan(){
 if(!scanAutoPending||document.hidden)return;
 // Tapping Escanear in the app already expresses intent. Try once; never retry a denial automatically.
 scanAutoPending=false;startScan();
}
function foundCode(value){
 value=String(value||'').trim();if(!value||value.length>512)return;
 clearDeliveryTimers();stopScan();scanValue=value;scanWaiting=false;scanDelivered=false;
 el('value').textContent=value;el('resultTitle').textContent='Código leído';el('result').classList.remove('hidden','pending','warning');el('camera').classList.add('hidden');el('start').classList.add('hidden');el('status').textContent='Lectura terminada. Cámara apagada.';
 el('delivery').textContent='Copie el código y péguelo en Buscar por serial o número Holt en el formulario.';
 if(window.opener&&!window.opener.closed&&scanState&&scanTarget){
  scanWaiting=true;el('result').classList.add('pending');el('status').textContent='Código leído. Confirmando la máquina…';el('delivery').textContent='Esperando confirmación del formulario…';
  try{
   window.opener.postMessage({type:'TFI_SCAN_RESULT',state:scanState,value:value},scanTarget);
   scanAckTimer=setTimeout(function(){
    scanAckTimer=null;el('result').classList.remove('pending');el('result').classList.add('warning');el('return').classList.remove('hidden');el('status').textContent='Código leído; recepción sin confirmar.';
    el('delivery').textContent='No llegó la confirmación. Vuelva al formulario y revise si aparece la máquina. Si no aparece, copie este código y péguelo en la búsqueda.';
   },3000);
  }catch(e){scanWaiting=false;el('result').classList.remove('pending');el('result').classList.add('warning');el('delivery').textContent='No se pudo enviar el código. Cópielo y péguelo en la búsqueda del formulario.';el('status').textContent='Código leído; no se pudo enviar.';}
 }
}
window.addEventListener('message',function(event){
 var d=event.data;if(!scanWaiting||!scanValue||event.origin!==scanTarget||event.source!==window.opener||!d||d.type!=='TFI_SCAN_ACK'||d.state!==scanState||typeof d.accepted!=='boolean')return;
 scanWaiting=false;clearDeliveryTimers();el('result').classList.remove('pending','warning');el('return').classList.remove('hidden');
 if(!d.accepted){el('result').classList.add('warning');el('resultTitle').textContent='Máquina sin identificar';el('status').textContent='Código recibido; máquina sin identificar.';el('delivery').textContent='El código llegó al formulario, pero no identifica una sola máquina. Escanee otra etiqueta o vuelva y busque por serial o Holt.';return;}
 scanDelivered=true;el('resultTitle').textContent='✓ Máquina recibida';el('status').textContent='Máquina recibida. Volviendo al formulario…';el('delivery').textContent='La máquina ya está seleccionada en el formulario. Revise el serial y toque Usar esta máquina.';
 returnToApp();
});
async function copyCode(){try{await navigator.clipboard.writeText(scanValue);el('copy').textContent='Código copiado';}catch(e){el('delivery').textContent='Mantenga pulsado el código para copiarlo y péguelo en el formulario.';}}
window.addEventListener('pagehide',function(){stopScan();clearDeliveryTimers();scanWaiting=false;scanAutoPending=false;});
document.addEventListener('visibilitychange',function(){if(document.hidden)stopScan();else autoStartScan();});

function returnToApp(){
 if(!window.opener||!scanState||!scanTarget)return;
 if(scanReturnTimer)clearTimeout(scanReturnTimer);
 // If the browser keeps this tab open, leave an explicit success and a tap target.
 scanReturnTimer=setTimeout(function(){
  scanReturnTimer=null;el('return').classList.remove('hidden');
  el('status').textContent=scanDelivered?'✓ Máquina recibida en el formulario.':'Vuelva al formulario para revisar el código.';
  el('delivery').textContent=scanDelivered?'La máquina ya está seleccionada. Si esta pestaña sigue abierta, toque Volver al formulario. Si el navegador la mantiene abierta, ciérrela para volver a la app.':'Si esta pestaña sigue abierta, ciérrela para volver al formulario y revisar el código.';
 },800);
 // Apps Script opens us from an iframe. A denied focus request must not prevent close.
 try{window.opener.focus();}catch(e){}
 try{window.close();}catch(e){}
}
el('start').addEventListener('click',startScan);
el('stop').addEventListener('click',function(){stopScan('Cámara detenida. Puede volver a abrirla.');});
el('copy').addEventListener('click',copyCode);
el('again').addEventListener('click',startScan);
el('return').addEventListener('click',returnToApp);
el('torch').addEventListener('click',toggleTorch);
el('any').addEventListener('click',function(){acceptAnyCode(false);});
// Plain visits keep the manual button. Only an app-launched scan starts automatically.
if(scanState&&scanTarget&&window.opener&&!window.opener.closed){scanAutoPending=true;autoStartScan();}
