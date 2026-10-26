'use strict';
var scanReader=null,scanRun=0,scanTimer=null,scanValue='',scanState='',scanTarget='';
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
 el('start').disabled=false;el('stop').classList.add('hidden');if(note)el('status').textContent=note;
}
function cameraError(error){
 if(error&&error.message==='decoder')return 'No se pudo cargar el lector. Revise la conexión y vuelva a intentar.';
 if(error&&['NotAllowedError','SecurityError'].indexOf(error.name)>=0)return 'Permita la cámara en los ajustes de este sitio y vuelva a intentar. Abra el lector en su propia pestaña.';
 if(error&&error.name==='NotFoundError')return 'No se encontró una cámara en este dispositivo.';
 if(error&&error.name==='NotReadableError')return 'Otra aplicación está usando la cámara. Ciérrela y vuelva a intentar.';
 return 'No se pudo abrir la cámara. Abra este enlace en Safari o Chrome y vuelva a intentar.';
}
async function startScan(){
 stopScan();scanValue='';el('return').classList.add('hidden');el('result').classList.add('hidden');el('camera').classList.remove('hidden');
 if(!window.isSecureContext||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){el('status').textContent='Abra este lector en una pestaña HTTPS de Safari o Chrome para usar la cámara.';return;}
 var run=scanRun;el('start').disabled=true;el('stop').classList.remove('hidden');el('status').textContent='Abriendo cámara…';
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
function foundCode(value){
 value=String(value||'').trim();if(!value||value.length>512)return;
 stopScan();scanValue=value;el('value').textContent=value;el('result').classList.remove('hidden');el('camera').classList.add('hidden');el('status').textContent='Lectura terminada. Cámara apagada.';
 el('delivery').textContent='Vuelva a mantenimiento. Si el código no aparece allí, cópielo y péguelo en Buscar por serial o número Holt.';
 if(window.opener&&scanState&&scanTarget){
  window.opener.postMessage({type:'TFI_SCAN_RESULT',state:scanState,value:value},scanTarget);
 }
}
window.addEventListener('message',function(event){
 var d=event.data;if(event.origin!==scanTarget||event.source!==window.opener||!d||d.type!=='TFI_SCAN_ACK'||d.state!==scanState)return;
 el('return').classList.remove('hidden');
 el('delivery').textContent=d.accepted?'Máquina enviada. Vuelva a mantenimiento y confirme el serial.':'Código enviado. No coincide con una sola máquina; búsquela por serial o Holt.';
});
async function copyCode(){try{await navigator.clipboard.writeText(scanValue);el('copy').textContent='Código copiado';}catch(e){el('delivery').textContent='Mantenga pulsado el código para copiarlo y péguelo en mantenimiento.';}}
window.addEventListener('pagehide',function(){stopScan();});
document.addEventListener('visibilitychange',function(){if(document.hidden)stopScan();});

function returnToApp(){
 if(!window.opener||!scanTarget)return;
 try{window.opener.focus();window.close();}catch(e){el('delivery').textContent='Vuelva a la pestaña de mantenimiento.';}
}
el('start').addEventListener('click',startScan);
el('stop').addEventListener('click',function(){stopScan('Cámara detenida. Puede volver a abrirla.');});
el('copy').addEventListener('click',copyCode);
el('again').addEventListener('click',startScan);
el('return').addEventListener('click',returnToApp);
