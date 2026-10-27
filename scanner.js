'use strict';
var scanReader=null,scanRun=0,scanTimer=null,scanValue='',scanState='',scanTarget='';
var scanWaiting=false,scanDelivered=false,scanAckTimer=null,scanReturnTimer=null,scanAutoPending=false;
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
 scanRun++;if(scanTimer)clearTimeout(scanTimer);scanTimer=null;
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
  await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}},el('video'),function(result){if(run===scanRun&&result)foundCode(result.getText());});
  if(run!==scanRun){reader.reset();return;}
  el('status').textContent='Buscando código… Mantenga el teléfono quieto.';
  scanTimer=setTimeout(function(){stopScan('Aún no se pudo leer. Limpie la placa, evite reflejos y vuelva a intentar.');},60000);
 }catch(error){if(run===scanRun)stopScan(cameraError(error));}
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
 el('delivery').textContent='Copie el código y péguelo en Buscar por serial o número Holt en mantenimiento.';
 if(window.opener&&!window.opener.closed&&scanState&&scanTarget){
  scanWaiting=true;el('result').classList.add('pending');el('status').textContent='Código leído. Confirmando la máquina…';el('delivery').textContent='Esperando confirmación de mantenimiento…';
  try{
   window.opener.postMessage({type:'TFI_SCAN_RESULT',state:scanState,value:value},scanTarget);
   scanAckTimer=setTimeout(function(){
    scanAckTimer=null;el('result').classList.remove('pending');el('result').classList.add('warning');el('return').classList.remove('hidden');el('status').textContent='Código leído; recepción sin confirmar.';
    el('delivery').textContent='No llegó la confirmación. Vuelva a mantenimiento y revise si aparece la máquina. Si no aparece, copie este código y péguelo en la búsqueda.';
   },3000);
  }catch(e){scanWaiting=false;el('result').classList.remove('pending');el('result').classList.add('warning');el('delivery').textContent='No se pudo enviar el código. Cópielo y péguelo en la búsqueda de mantenimiento.';el('status').textContent='Código leído; no se pudo enviar.';}
 }
}
window.addEventListener('message',function(event){
 var d=event.data;if(!scanWaiting||!scanValue||event.origin!==scanTarget||event.source!==window.opener||!d||d.type!=='TFI_SCAN_ACK'||d.state!==scanState||typeof d.accepted!=='boolean')return;
 scanWaiting=false;clearDeliveryTimers();el('result').classList.remove('pending','warning');el('return').classList.remove('hidden');
 if(!d.accepted){el('result').classList.add('warning');el('resultTitle').textContent='Máquina sin identificar';el('status').textContent='Código recibido; máquina sin identificar.';el('delivery').textContent='El código llegó a mantenimiento, pero no identifica una sola máquina. Escanee otra etiqueta o vuelva y busque por serial o Holt.';return;}
 scanDelivered=true;el('resultTitle').textContent='✓ Máquina recibida';el('status').textContent='Máquina recibida. Volviendo a mantenimiento…';el('delivery').textContent='La máquina ya está seleccionada en mantenimiento. Revise el serial y toque Usar esta máquina.';
 returnToApp();
});
async function copyCode(){try{await navigator.clipboard.writeText(scanValue);el('copy').textContent='Código copiado';}catch(e){el('delivery').textContent='Mantenga pulsado el código para copiarlo y péguelo en mantenimiento.';}}
window.addEventListener('pagehide',function(){stopScan();clearDeliveryTimers();scanWaiting=false;scanAutoPending=false;});
document.addEventListener('visibilitychange',function(){if(document.hidden)stopScan();else autoStartScan();});

function returnToApp(){
 if(!window.opener||!scanState||!scanTarget)return;
 if(scanReturnTimer)clearTimeout(scanReturnTimer);
 // If the browser keeps this tab open, leave an explicit success and a tap target.
 scanReturnTimer=setTimeout(function(){
  scanReturnTimer=null;el('return').classList.remove('hidden');
  el('status').textContent=scanDelivered?'✓ Máquina recibida en mantenimiento.':'Vuelva a mantenimiento para revisar el código.';
  el('delivery').textContent=scanDelivered?'La máquina ya está seleccionada. Si esta pestaña sigue abierta, toque Volver a mantenimiento. Si el navegador la mantiene abierta, ciérrela para volver a la app.':'Si esta pestaña sigue abierta, ciérrela para volver a mantenimiento y revisar el código.';
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
// Plain visits keep the manual button. Only an app-launched scan starts automatically.
if(scanState&&scanTarget&&window.opener&&!window.opener.closed){scanAutoPending=true;autoStartScan();}
