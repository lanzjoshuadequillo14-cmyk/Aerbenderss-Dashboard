// =========================================================
// IMPORTS
// Firebase config, sensor status helpers, and Firebase SDK functions
// =========================================================
import{db,auth,BASE_PATH}from'./firebase.js';
import { getFirmwareStatus, describeFirmwareStatus, escapeHtml } from './sensor-status.js';
import{ref,onValue,get}from"https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import{signOut,onAuthStateChanged}from"https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// =========================================================
// AUTHENTICATION
// Redirect to the registration page when the user is not signed in
// =========================================================
onAuthStateChanged(auth,user=>{
if(!user)window.location.href='Registration.html';
});

// =========================================================
// LOGOUT BUTTON
// Signs the user out and sends them back to the registration page
// =========================================================
document.getElementById('btn-logout')?.addEventListener('click',async e=>{
e.preventDefault();
try{
await signOut(auth);
window.location.href='Registration.html';
}catch(err){
console.error("Logout error:",err);
}
});

// =========================================================
// SIDEBAR + DEVICE SELECTOR SETUP
// Grabs sidebar elements and loads the saved AeroCube ID (or the default one)
// =========================================================
const menuToggle=document.getElementById('menuToggle');
const sidebar=document.getElementById('sidebar');
const overlay=document.getElementById('sidebarOverlay');
const savedAeroCubeId=localStorage.getItem('aerocube-id')||BASE_PATH.split('/').pop();
const aeroCubePath='/Aerocubes/'+savedAeroCubeId;
const deviceSelectorForm=document.getElementById('device-selector-form');
const aerocubeIdInput=document.getElementById('aerocube-id');
const deviceName=document.getElementById('device-name');

// Show the saved ID in the input field
if(aerocubeIdInput)aerocubeIdInput.value=savedAeroCubeId;

// Save a new AeroCube ID (letters, numbers, _ and - only) and reload the page
deviceSelectorForm?.addEventListener('submit',e=>{
e.preventDefault();
const cubeId=aerocubeIdInput.value.trim();
const validId=/^[A-Za-z0-9_-]+$/;
if(!validId.test(cubeId))return;
localStorage.setItem('aerocube-id',cubeId);
window.location.reload();
});

// =========================================================
// MOBILE MENU BEHAVIOR
// Open/close the sidebar via button, overlay, link click, Escape key, or resize
// =========================================================
function toggleMenu(){
sidebar?.classList.toggle('open');
overlay?.classList.toggle('active');
}

menuToggle?.addEventListener('click',toggleMenu);
overlay?.addEventListener('click',toggleMenu);

// Close the menu after tapping a nav link
sidebar?.querySelectorAll('a.nav-item').forEach(link=>{
link.addEventListener('click',()=>{
if(sidebar.classList.contains('open'))toggleMenu();
});
});

// Close the menu with the Escape key
document.addEventListener('keydown',e=>{
if(e.key==='Escape'&&sidebar?.classList.contains('open'))toggleMenu();
});

// Close the menu when the window grows to desktop width
window.addEventListener('resize',()=>{
if(window.innerWidth>768&&sidebar?.classList.contains('open'))toggleMenu();
});

// =========================================================
// DOM REFERENCES FOR SENSOR READINGS
// Elements that display CO2, PM, VOC, temperature, humidity and statuses
// =========================================================
const valCo2=document.getElementById('val-co2');
const co2GaugeCanvas=document.getElementById('co2-gauge-canvas');
const co2GaugeStatus=document.getElementById('co2-gauge-status');
const valPm25=document.getElementById('val-pm25');
const valPm25Current=document.getElementById('val-pm25-current');
const valPm25Avg24h=document.getElementById('val-pm25-24h');
const valVoc=document.getElementById('val-voc');
const vocGaugeCanvas=document.getElementById('voc-gauge-canvas');
const valPm10=document.getElementById('val-pm10');
const valTemp=document.getElementById('val-temp');
const valHumidity=document.getElementById('val-humidity');
const valPm1=document.getElementById('val-pm1');
const valPm4=document.getElementById('val-pm4');
const statusCo2=document.getElementById('status-co2');
const statusPm25Avg24h=document.getElementById('status-pm25-24h');
const statusVoc=document.getElementById('status-voc');
let vocGauge=null;
let co2Gauge=null;
const CO2_GAUGE_MAX=3000;
// Chart.js annotation plugin (draws the vertical line on the CO2 bar)
const chartAnnotationPlugin=window['chartjs-plugin-annotation'];

if(chartAnnotationPlugin&&typeof Chart!=='undefined'){
Chart.register(chartAnnotationPlugin);
}

// =========================================================
// CO2 GAUGE - POINTER PLUGIN
// Draws the small white triangle above the bar at the current CO2 value
// =========================================================
const co2GaugePointerPlugin={
id:'co2GaugePointer',
afterDraw(chart){
const value=Number(chart.$co2Value);
const xScale=chart.scales?.x;
const yScale=chart.scales?.y;
if(!Number.isFinite(value)||!xScale||!yScale)return;
const x=xScale.getPixelForValue(Math.min(CO2_GAUGE_MAX,Math.max(0,value)));
const y=yScale.top-2;
const ctx=chart.ctx;
ctx.save();
ctx.beginPath();
ctx.moveTo(x,y);
ctx.lineTo(x-5,y-7);
ctx.lineTo(x+5,y-7);
ctx.closePath();
ctx.fillStyle='#f8fafc';
ctx.shadowColor='rgba(248,250,252,.55)';
ctx.shadowBlur=6;
ctx.fill();
ctx.restore();
}
};

// =========================================================
// CO2 GAUGE - CREATE CHART
// Horizontal stacked bar: green (harmless), yellow (elevated), red (unacceptable)
// =========================================================
function createCO2Gauge(){
if(!co2GaugeCanvas||typeof Chart==='undefined'||!chartAnnotationPlugin)return;
co2Gauge=new Chart(co2GaugeCanvas,{
type:'bar',
data:{
labels:['CO₂'],
datasets:[
{label:'Harmless',data:[1000],backgroundColor:'#10b981',borderSkipped:false,borderRadius:{topLeft:7,bottomLeft:7},barPercentage:1,categoryPercentage:1},
{label:'Elevated',data:[1000],backgroundColor:'#f59e0b',borderSkipped:false,barPercentage:1,categoryPercentage:1},
{label:'Unacceptable',data:[1000],backgroundColor:'#ef4444',borderSkipped:false,borderRadius:{topRight:7,bottomRight:7},barPercentage:1,categoryPercentage:1}
]
},
options:{
responsive:true,
maintainAspectRatio:false,
indexAxis:'y',
animation:false,
layout:{padding:{top:12,right:0,bottom:0,left:0}},
plugins:{
legend:{display:false},
tooltip:{enabled:false},
annotation:{annotations:{co2Value:{
type:'line',
xMin:0,
xMax:0,
borderColor:'#f8fafc',
borderWidth:2,
drawTime:'afterDatasetsDraw'
}}}
},
scales:{
x:{min:0,max:CO2_GAUGE_MAX,stacked:true,display:false,grid:{display:false}},
y:{stacked:true,display:false,grid:{display:false}}
}
},
plugins:[co2GaugePointerPlugin]
});
}

// =========================================================
// CO2 GAUGE - UPDATE
// Updates the status badge (<=1000 harmless, <=2000 elevated, else unacceptable)
// and moves the marker line/pointer on the bar
// =========================================================
function updateCO2Gauge(newValue){
const value=toNum(newValue);
if(co2GaugeStatus){
co2GaugeStatus.className='co2-gauge-badge';
if(value===undefined){
co2GaugeStatus.textContent='No data';
}else if(value<=1000){
co2GaugeStatus.classList.add('harmless');
co2GaugeStatus.textContent='✓ HARMLESS';
}else if(value<=2000){
co2GaugeStatus.classList.add('elevated');
co2GaugeStatus.textContent='⚠ ELEVATED';
}else{
co2GaugeStatus.classList.add('unacceptable');
co2GaugeStatus.textContent='✖ UNACCEPTABLE';
}
}
if(co2Gauge){
co2Gauge.$co2Value=value;
const annotation=co2Gauge.options.plugins.annotation.annotations.co2Value;
annotation.xMin=value===undefined?0:Math.min(CO2_GAUGE_MAX,Math.max(0,value));
annotation.xMax=annotation.xMin;
annotation.display=value!==undefined;
co2Gauge.update('none');
}
}

// Expose globally and build the CO2 gauge on load
window.updateCO2Gauge=updateCO2Gauge;
createCO2Gauge();

// =========================================================
// VOC GAUGE - NEEDLE PLUGIN
// Applies the yellow-to-red gradient and draws the triangular needle
// =========================================================
const vocGaugeNeedlePlugin={
id:'vocGaugeNeedle',
// Paint the "Deterioration" arc with a gradient before drawing
beforeDatasetsDraw(chart){
const {ctx,chartArea}=chart;
const meta=chart.getDatasetMeta(0);
const arc=meta.data[1];
if(!arc||!chartArea)return;
arc.options.backgroundColor=ctx.createLinearGradient(chartArea.left,0,chartArea.right,0);
arc.options.backgroundColor.addColorStop(0,'#facc15');
arc.options.backgroundColor.addColorStop(.5,'#f97316');
arc.options.backgroundColor.addColorStop(1,'#ef4444');
},
// Draw the needle at the angle that matches the current VOC value (0-500)
afterDatasetsDraw(chart){
const value=Number(chart.$vocValue);
if(!Number.isFinite(value))return;
const arc=chart.getDatasetMeta(0).data[0];
if(!arc)return;
const props=arc.getProps(['x','y','innerRadius','outerRadius','startAngle'],true);
const totalSweep=chart.config.options.circumference*Math.PI/180;
const ratio=Math.min(500,Math.max(0,value))/500;
const angle=props.startAngle+totalSweep*ratio;
const tipRadius=props.innerRadius+15.5;
const baseRadius=props.innerRadius-1;
const tipX=props.x+Math.cos(angle)*tipRadius;
const tipY=props.y+Math.sin(angle)*tipRadius;
const baseX=props.x+Math.cos(angle)*baseRadius;
const baseY=props.y+Math.sin(angle)*baseRadius;
const sideRadius=7.5;
const sideX=Math.cos(angle+Math.PI/2)*sideRadius;
const sideY=Math.sin(angle+Math.PI/2)*sideRadius;
const ctx=chart.ctx;
ctx.save();
ctx.beginPath();
ctx.moveTo(tipX,tipY);
ctx.lineTo(baseX+sideX,baseY+sideY);
ctx.lineTo(baseX-sideX,baseY-sideY);
ctx.closePath();
ctx.fillStyle='#050505';
ctx.strokeStyle='#f8fafc';
ctx.lineWidth=3;
ctx.lineJoin='round';
ctx.shadowColor='rgba(0,0,0,.35)';
ctx.shadowBlur=3;
ctx.fill();
ctx.stroke();
ctx.restore();
}
};

// =========================================================
// VOC GAUGE - CREATE CHART
// Half-doughnut: 0-100 baseline (green), 100-500 deterioration (gradient)
// =========================================================
function createVOCGauge(){
if(!vocGaugeCanvas||typeof Chart==='undefined')return;
vocGauge=new Chart(vocGaugeCanvas,{
type:'doughnut',
data:{labels:['Normal Baseline','Deterioration'],datasets:[{
data:[100,400],
backgroundColor:['#22c55e','#f97316'],
borderWidth:0,
spacing:2
}]},
options:{
responsive:true,
maintainAspectRatio:false,
rotation:-90,
circumference:180,
cutout:'72%',
plugins:{legend:{display:false},tooltip:{enabled:false}},
animation:{duration:500}
},
plugins:[vocGaugeNeedlePlugin]
});
}

// =========================================================
// VOC GAUGE - UPDATE
// Updates the number, the status badge (<100 improvement, =100 baseline,
// >100 deterioration), and redraws the needle
// =========================================================
function updateVOCGauge(newValue){
const value=toNum(newValue);
if(valVoc){
valVoc.textContent=value===undefined?'--':fmt(value,0);
}
if(!statusVoc)return;
statusVoc.className='voc-status-badge';
if(value===undefined){
statusVoc.innerText='--';
}else if(value<100){
statusVoc.classList.add('improvement');
statusVoc.innerText='✓ IMPROVEMENT';
}else if(value===100){
statusVoc.classList.add('normal');
statusVoc.innerText='✓ NORMAL BASELINE';
}else{
statusVoc.classList.add('deterioration');
statusVoc.innerText='⚠ DETERIORATION';
}
if(vocGauge){
vocGauge.$vocValue=value;
vocGauge.update('none');
}
}

// Expose globally and build the VOC gauge on load
window.updateVOCGauge=updateVOCGauge;

createVOCGauge();

// =========================================================
// STATUS ELEMENT MAPS + DEVICE STATUS ELEMENTS
// Links each metric to its status pill and card, plus connection indicators
// =========================================================
const sensorStatusElements={
co2:statusCo2,
voc:statusVoc,
pm25avg:statusPm25Avg24h
};
const sensorStatusCards={co2:'card-co2',voc:'card-voc',pm25avg:'card-pm25-24h'};
const pm25HistoryNote=document.getElementById('pm25-history-note');

const deviceIndicator=document.getElementById('device-indicator');
const deviceLastSeen=document.getElementById('device-last-seen');
const deviceConnBadge=document.getElementById('device-connection-badge');
const deviceStatusText=document.getElementById('device-status-text');
const notificationButton=document.getElementById('btn-notifications');
const recContent=document.getElementById('recommendations-content');
const insightText=document.getElementById('insight-text');


// =========================================================
// APP STATE
// Tracks notification states, connection state, and latest data
// =========================================================
const notificationStates={};
let previousConnectionState=null;
let firstReadingHandled=false;
let latestTelemetry=null;
let latestPm25Avg24h=null;
let pm25HistoryReady=false;

// =========================================================
// NOTIFICATION BUTTON
// Updates the button label/style based on browser notification permission
// =========================================================
function updateNotificationButton(){
if(!notificationButton||!('Notification'in window))return;
if(Notification.permission==='granted'){
notificationButton.classList.add('enabled');
notificationButton.classList.remove('denied');
notificationButton.innerHTML='<i data-lucide="bell-ring"></i><span>Notifications Enabled</span>';
}else if(Notification.permission==='denied'){
notificationButton.classList.add('denied');
notificationButton.classList.remove('enabled');
notificationButton.innerHTML='<i data-lucide="bell-off"></i><span>Notifications Blocked</span>';
}
if(window.lucide)lucide.createIcons();
}

// =========================================================
// ALERT SETTINGS
// Reminder timing, value-change thresholds, and which tones trigger alerts
// =========================================================
const ALERT_REMINDER_MS=5*60*1000;
const ALERT_VALUE_INTERVALS={
co2:100,
voc:50,
pm25avg:15
};
const ALERT_TONES={normal:true,attention:true,critical:true};
const ALERT_ON_FIRST_NORMAL=false;
const alertLastSent={};
const alertLastValue={};

// Display names used inside alerts
const ALERT_INFO={
co2:{name:'CO₂'},
voc:{name:'VOC Index'},
pm25avg:{name:'24-hour average PM2.5'}
};

// =========================================================
// ALERT MESSAGE BUILDERS
// Finds the recommendation for a status and builds the notification text
// =========================================================
function getAdvice(metricKey,status){
const group=metricKey==='pm25avg'?'pm25':metricKey;
const recommendationKey=contentStatusKey(metricKey,status);
const rec=(recommendationSettings[group]||{})[recommendationKey]||
(recommendationSettings[group]||{})[status.key]||
(recommendationSettings[group]||{})[status.tone];
return rec?normalizeRecommendationValue(rec):'';
}

function notificationBody(metricKey,status,value){
const info=ALERT_INFO[metricKey];
const advice=getAdvice(metricKey,status);
const reading=info.name+' is '+value+'.';
return advice
?reading+'\n\nRecommended action:\n'+advice
:reading;
}

// =========================================================
// TOAST (IN-PAGE) NOTIFICATIONS
// Creates a popup message in the top-right corner that auto-closes after 9s
// =========================================================
function showToast(title,body,tone='critical'){
let stack=document.getElementById('toast-stack');
if(!stack){
stack=document.createElement('div');
stack.id='toast-stack';
document.body.appendChild(stack);
}
const toast=document.createElement('div');
toast.className='toast toast-'+tone;
const h=document.createElement('strong');
const p=document.createElement('p');
h.textContent=title;
p.textContent=body;
toast.append(h,p);
stack.appendChild(toast);
const close=()=>{
toast.classList.add('hide');
setTimeout(()=>toast.remove(),300);
};
toast.addEventListener('click',close);
setTimeout(close,9000);
}

// =========================================================
// SYSTEM (BROWSER) NOTIFICATIONS
// Uses the service worker when available, otherwise a regular Notification
// =========================================================
async function showSystemNotification(title,body,tag){
if(!('Notification'in window)||Notification.permission!=='granted')return;
const options={
body,
tag,
renotify:true,
icon:'logo/aerocube%20logo.png',
vibrate:[200,100,200]
};
try{
if('serviceWorker'in navigator){
const reg=await Promise.race([
navigator.serviceWorker.ready,
new Promise(resolve=>setTimeout(()=>resolve(null),1500))
]);
if(reg&&reg.showNotification){
await reg.showNotification(title,options);
return;
}
}
new Notification(title,options);
}catch(err){
console.warn('Notification failed:',err);
}
}

// =========================================================
// SEND NOTIFICATION
// Shows a toast, vibrates on critical alerts, and sends a system notification
// =========================================================
async function sendNotification(title,body,tag='aerocube-alert',tone='critical'){
showToast(title,body,tone);
if(tone==='critical'&&navigator.vibrate)navigator.vibrate([200,100,200]);
await showSystemNotification(title,body,tag);
}

// =========================================================
// NOTIFICATION BUTTON CLICK
// Requests permission, shows a test notification, or explains how to unblock
// =========================================================
notificationButton?.addEventListener('click',async()=>{
if(!('Notification'in window)){
window.alert('This browser does not support notifications. On iPhone, add the app to your Home Screen first (iOS 16.4+).');
return;
}
if(Notification.permission==='default')await Notification.requestPermission();
updateNotificationButton();
if(Notification.permission==='granted'){
sendNotification(
'AeroCube notifications are on',
'You will be alerted when the firmware reports changes to CO₂, VOC Index or 24-hour PM2.5 statuses.',
'aerocube-test',
'normal'
);
}else if(Notification.permission==='denied'){
window.alert('Notifications are blocked. Allow them in your browser or site settings, then reload the page.');
}
});

updateNotificationButton();

// =========================================================
// UI HELPERS
// Status pills, card border colors, and reading rendering
// =========================================================
function setStatusPill(element,state,label){
if(!element)return;
element.className='card-status '+(state||'');
element.innerText=label;
}

function setCardVisual(cardId,state){
const card=document.getElementById(cardId);
if(!card)return;
card.classList.remove('border-normal','border-attention','border-critical');
if(state)card.classList.add('border-'+state);
}

function renderReading(element,value,unit='',digits=1){
if(!element)return;
const number=toNum(value);
const suffix=unit?' <span>'+unit+'</span>':'';
element.innerHTML=(number===undefined?'--':fmt(number,digits))+suffix;
}

// =========================================================
// RENDER TELEMETRY
// Writes every sensor value from Firebase onto the dashboard
// =========================================================
function renderTelemetryReadings(data){
renderReading(valCo2,data.co2,'ppm',0);
updateCO2Gauge(data.co2);
updateVOCGauge(data.VOCidx);
renderReading(valTemp,data.temp,'°C');
renderReading(valHumidity,data.humidity,'%');
renderReading(valPm25Current,data.pm?.pm2p5,'',0);
renderReading(valPm1,data.pm?.pm1p0,'µg/m³');
renderReading(valPm25,data.pm?.pm2p5,'µg/m³');
renderReading(valPm4,data.pm?.pm4p0,'µg/m³');
renderReading(valPm10,data.pm?.pm10p0,'µg/m³');
}

// =========================================================
// UPDATE SENSOR STATUSES
// Sets each status pill and card border color from firmware statuses
// =========================================================
function updateSensorStatuses(data){
Object.entries(sensorStatusElements).forEach(([metric,element])=>{
if(metric==='voc'){
updateVOCGauge(data.VOCidx);
const vocValue=toNum(data.VOCidx);
if(sensorStatusCards[metric])setCardVisual(
sensorStatusCards[metric],
vocValue===undefined?null:(vocValue<=100?'normal':'attention')
);
return;
}
const status=metric==='pm25avg'
?getPm25AverageStatus()
:getFirmwareStatus(data,metric);
setStatusPill(element,status.tone,status.label);
if(sensorStatusCards[metric])setCardVisual(sensorStatusCards[metric],status.tone);
});
}

// =========================================================
// DEVICE ONLINE CHECK + TIME FORMATTING
// Device is online if data arrived within the last 60 seconds
// =========================================================
function checkDeviceOnline(lastSeen){
if(!lastSeen)return false;
return Math.floor((Date.now()-lastSeen)/1000)<60;
}

function timeAgo(timestamp){
if(!timestamp)return'--';
const diff=Math.floor((Date.now()-timestamp)/1000);
if(diff<60)return diff+' seconds ago';
if(diff<3600)return Math.floor(diff/60)+' minutes ago';
if(diff<86400)return Math.floor(diff/3600)+' hours ago';
return Math.floor(diff/86400)+' days ago';
}

// =========================================================
// CLEAR STALE DATA
// Resets readings, statuses and messages when the device goes offline
// =========================================================
function clearStaleSensorData(){
firstReadingHandled=false;
Object.keys(notificationStates).forEach(key=>{notificationStates[key]=null;});
Object.keys(alertLastValue).forEach(key=>{delete alertLastValue[key];});
renderTelemetryReadings({});
renderReading(valPm25Avg24h,undefined,'µg/m³');
Object.entries(sensorStatusElements).forEach(([metric,element])=>{
if(metric==='voc')updateVOCGauge(undefined);
else setStatusPill(element,null,'No data');
});
Object.values(sensorStatusCards).forEach(cardId=>setCardVisual(cardId,null));
if(pm25HistoryNote)pm25HistoryNote.textContent='Waiting for telemetry and PM2.5 history.';
if(!latestTelemetry){
if(insightText)insightText.innerHTML='<div>Waiting for telemetry data...</div>';
if(recContent)recContent.innerHTML='<div>Waiting for telemetry data...</div>';
}
}

// =========================================================
// PM2.5 24-HOUR AVERAGE STATUS
// Compares the rolling average to the WHO 24-hour guideline (15 µg/m³)
// =========================================================
function getPm25AverageStatus(){
if(!pm25HistoryReady){
return describeFirmwareStatus('pm25avg',null,'Collecting Data');
}
const withinGuideline=latestPm25Avg24h<=15;
return describeFirmwareStatus(
'pm25avg',
withinGuideline?'Within WHO 24-hour AQG':'Above WHO 24-hour AQG'
);
}

// =========================================================
// DEVICE CONNECTION STATUS
// Updates the connected/disconnected UI and alerts when the state changes
// =========================================================
function updateDeviceConnectionStatus(lastSeen){
const online=checkDeviceOnline(lastSeen);
deviceLastSeen.innerText=lastSeen?'Last data received: '+timeAgo(lastSeen):'Last data received: --';
deviceIndicator.className='device-indicator '+(online?'connected':'disconnected');
deviceConnBadge.className='badge badge-device '+(online?'online':'offline');
deviceStatusText.innerText=online?'CONNECTED':'DISCONNECTED';
if(previousConnectionState!==null&&previousConnectionState!==online){
sendNotification(
online?'AeroCube connected':'AeroCube disconnected',
online?'Live sensor data has resumed.':'No sensor data has been received for over 60 seconds.',
'aerocube-connection',
online?'normal':'critical'
);
}
previousConnectionState=online;
if(!online)clearStaleSensorData();
}

// =========================================================
// METRIC STATE NOTIFICATIONS
// Sends an alert when a status changes, when the value moves enough,
// or as a reminder for critical states
// =========================================================
function notifyMetricState(metricKey,status,value){
const info=ALERT_INFO[metricKey];
if(!info)return;
if(metricKey==='pm25avg'&&!pm25HistoryReady)return;
const prev=notificationStates[metricKey];
const numericValue=Number.parseFloat(String(value));
notificationStates[metricKey]=status.raw?status:null;
if(!status.tone)return;
const now=Date.now();
// Same status as before: only alert on a big value change or critical reminder
if(prev?.label===status.label){
const valueInterval=ALERT_VALUE_INTERVALS[metricKey];
const valueChanged=Number.isFinite(numericValue)&&
Number.isFinite(alertLastValue[metricKey])&&
Math.abs(numericValue-alertLastValue[metricKey])>=valueInterval;
const criticalReminder=status.tone==='critical'&&ALERT_TONES.critical&&
now-(alertLastSent[metricKey]||0)>=ALERT_REMINDER_MS;
if(valueChanged||criticalReminder){
alertLastSent[metricKey]=now;
if(Number.isFinite(numericValue))alertLastValue[metricKey]=numericValue;
sendNotification(
info.name+': '+status.label,
notificationBody(metricKey,status,value),
'aerocube-'+metricKey,status.tone
);
}
return;
}
// Status changed: alert (skips the very first "normal" unless enabled)
if(Number.isFinite(numericValue))alertLastValue[metricKey]=numericValue;
if(!prev&&status.tone==='normal'&&!ALERT_ON_FIRST_NORMAL)return;
if(!ALERT_TONES[status.tone])return;
alertLastSent[metricKey]=now;
sendNotification(
info.name+': '+status.label,
notificationBody(metricKey,status,value),
'aerocube-'+metricKey,status.tone
);
}

// =========================================================
// FIRST READING SUMMARY
// One-time notification when CO2 and VOC are both normal on first load
// =========================================================
function announceFirstReading(){
if(firstReadingHandled)return;
const statuses=['co2','voc'].map(key=>notificationStates[key]);
if(statuses.some(status=>!status?.tone))return;
firstReadingHandled=true;
if(!ALERT_TONES.normal||!statuses.every(status=>status.tone==='normal'))return;
sendNotification(
'Current firmware sensor statuses',
'CO₂: '+statuses[0].label+'. VOC Index: '+statuses[1].label+'.',
'aerocube-summary','normal'
);
}

// =========================================================
// DEBUG HELPER
// Run aeroTest('co2', 'Elevated', 1500) in the console to simulate an alert
// =========================================================
window.aeroTest=function(metric,status,value){
if(!ALERT_INFO[metric]||typeof status!=='string'){
console.log("Use: aeroTest('co2' | 'voc' | 'pm25avg', firmwareStatus, reading)");
return;
}
const result=describeFirmwareStatus(metric,status);
notifyMetricState(metric,result,value??'--');
console.log(metric,result.label,value);
};

// =========================================================
// NUMBER FORMATTING + FIREBASE PUSH ID TIMESTAMPS
// fmt rounds numbers; push IDs hide a timestamp in their first 8 characters
// =========================================================
const fmt=(v,d=1)=>typeof v==='number'?Number(v.toFixed(d)):v;
const PUSH_CHARS='-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

// Decode the creation time from a Firebase push ID
function getTimestampFromPushId(pushId){
let time=0;
for(let i=0;i<8;i++){
const index=PUSH_CHARS.indexOf(pushId.charAt(i));
if(index<0)return 0;
time=time*64+index;
}
return time;
}

// Convert seconds/milliseconds/date strings into milliseconds
function normalizeTimestamp(raw){
if(raw===undefined||raw===null||raw==='')return 0;
let value=Number(raw);
if(Number.isNaN(value))value=Date.parse(raw);
if(Number.isNaN(value)||value<=0)return 0;
return value<1e12?value*1000:value;
}

// =========================================================
// TREND SETTINGS + RECENT READINGS BUFFER
// Keeps the last hour of readings in memory for trend/statistics
// =========================================================
const TREND_WINDOW_MIN=15;
const KEEP_MS=60*60*1000;
const PM25_WINDOW_MS=24*60*60*1000;

// Minimum change over the trend window to count as "up" or "down"
const TREND_MIN_CHANGE={
co2:50,
voc:10,
pm25:5
};

let recentReadings=[];

// Safely convert a value to a finite number (or undefined)
function toNum(v){
if(v===undefined||v===null||v==='')return undefined;
const n=Number(v);
return Number.isFinite(n)?n:undefined;
}

// Save a reading at most every 10 seconds and drop anything older than 1 hour
function recordReading(data){
const now=Date.now();
const last=recentReadings[recentReadings.length-1];
if(last&&now-last.t<10000)return;
recentReadings.push({
t:now,
co2:toNum(data.co2),
voc:toNum(data.VOCidx),
pm25:toNum(data.pm?.pm2p5)
});
recentReadings=recentReadings.filter(r=>r.t>=now-KEEP_MS);
}

// Fill the buffer with past readings from Firebase history
function seedRecentReadings(seed){
if(!seed.length)return;
seed.sort((a,b)=>a.t-b.t);
const lastSeed=seed[seed.length-1].t;
recentReadings=seed.concat(recentReadings.filter(r=>r.t>lastSeed)).filter(r=>r.t>=Date.now()-KEEP_MS);
}

// Get readings for one metric within the last `ms` milliseconds
function seriesOf(key,ms){
const cut=Date.now()-ms;
return recentReadings.filter(r=>r.t>=cut&&typeof r[key]==='number');
}

// =========================================================
// TREND CALCULATION
// Linear regression over the last 15 minutes -> direction up/down/steady
// =========================================================
function trendOf(key){
const pts=seriesOf(key,TREND_WINDOW_MIN*60000);
if(pts.length<4)return null;
const spanMin=(pts[pts.length-1].t-pts[0].t)/60000;
if(spanMin<3)return null;
const t0=pts[0].t;
const xs=pts.map(p=>(p.t-t0)/60000);
const ys=pts.map(p=>p[key]);
const n=xs.length;
const mx=xs.reduce((a,b)=>a+b)/n;
const my=ys.reduce((a,b)=>a+b)/n;
const den=xs.reduce((a,x)=>a+(x-mx)**2,0);
const slope=den?xs.reduce((a,x,i)=>a+(x-mx)*(ys[i]-my),0)/den:0;
const change=slope*TREND_WINDOW_MIN;
const dir=Math.abs(change)<TREND_MIN_CHANGE[key]?'steady':change>0?'up':'down';
return{slope,change,dir};
}

// =========================================================
// HOURLY STATISTICS
// Average, max and min over the last hour (needs 5+ points over 5+ minutes)
// =========================================================
function hourStats(key){
const pts=seriesOf(key,KEEP_MS);
if(pts.length<5||pts[pts.length-1].t-pts[0].t<5*60000)return null;
const vals=pts.map(p=>p[key]);
return{
avg:vals.reduce((a,b)=>a+b)/vals.length,
max:Math.max(...vals),
min:Math.min(...vals)
};
}

// =========================================================
// PM2.5 HISTORY PARSING
// Turns Firebase history into a sorted list of valid PM2.5 readings
// =========================================================
function getCurrentPm25Session(history,now){
const readings=[];
for(const key in history){
const log=history[key];
let timestamp=normalizeTimestamp(log.timestamp||log.time||log.created_at);
if(!timestamp&&key.startsWith('-'))timestamp=getTimestampFromPushId(key);
if(!timestamp||timestamp>now)continue;
const rawPm25=log.pm?.pm2p5;
if(rawPm25===undefined||rawPm25===null||rawPm25==='')continue;
const value=Number(rawPm25);
if(!Number.isFinite(value))continue;
readings.push({timestamp,value,log});
}
readings.sort((a,b)=>a.timestamp-b.timestamp);
return readings;
}

// =========================================================
// PM2.5 ROLLING 24-HOUR AVERAGE
// Loads history, seeds the trend buffer, averages the last 24h, and
// marks history "ready" only after a full 24 hours has been collected
// =========================================================
async function updatePm25Average24h(){
if(!valPm25Avg24h)return;
let message='Waiting for 24-hour PM2.5 history.';
let average=null;
let historyReady=false;
try{
const snapshot=await get(ref(db,aeroCubePath+'/history'));
const now=Date.now();
if(snapshot.exists()){
const history=snapshot.val();
// Seed the 1-hour buffer from history
const seed=[];
for(const key in history){
const log=history[key];
let timestamp=normalizeTimestamp(log.timestamp||log.time||log.created_at);
if(!timestamp&&key.startsWith('-'))timestamp=getTimestampFromPushId(key);
if(!timestamp||timestamp>now)continue;
if(timestamp>=now-KEEP_MS){
seed.push({t:timestamp,co2:toNum(log.co2),voc:toNum(log.VOCidx),pm25:toNum(log.pm?.pm2p5)});
}
}
seedRecentReadings(seed);
// Keep only readings inside the 24-hour window
const session=getCurrentPm25Session(history,now);
const readings=session.filter(item=>item.timestamp>=now-PM25_WINDOW_MS);
// Add the newest live reading if it is not in history yet
const latestValue=toNum(latestTelemetry?.pm?.pm2p5);
const latestTimestamp=normalizeTimestamp(latestTelemetry?.timestamp)||now;
if(latestValue!==undefined&&latestTimestamp<=now&&latestTimestamp>=now-PM25_WINDOW_MS&&
!readings.some(item=>item.timestamp===latestTimestamp)){
readings.push({timestamp:latestTimestamp,value:latestValue});
}
readings.sort((a,b)=>a.timestamp-b.timestamp);
// Calculate the average and decide if 24 hours have been collected
if(readings.length){
average=readings.reduce((sum,item)=>sum+item.value,0)/readings.length;
// The rolling window normally spans slightly less than 24 hours between samples.
// Check collection duration against the unfiltered history, not the window.
const firstTimestamp=session[0]?.timestamp??readings[0].timestamp;
const collectedMs=readings[readings.length-1].timestamp-firstTimestamp;
historyReady=collectedMs>=PM25_WINDOW_MS;
message=historyReady
?'Rolling 24-hour average calculated from recorded PM2.5 readings.'
:'Rolling PM2.5 average calculated from '+fmt(collectedMs/(60*60*1000))+' hours of available readings.';
}
}
}catch(error){
console.error('Unable to calculate 24-hour PM2.5 average:',error);
message='Unable to load PM2.5 history.';
}
// Store the result, render it, and refresh dependent sections
latestPm25Avg24h=average;
pm25HistoryReady=historyReady;
renderReading(valPm25Avg24h,latestPm25Avg24h,'µg/m³');
if(pm25HistoryNote)pm25HistoryNote.textContent=message;
if(latestTelemetry&&previousConnectionState!==false){
updateSensorStatuses(latestTelemetry);
updateInsights(latestTelemetry);
updateRecommendations(latestTelemetry);
}
}

// =========================================================
// INSIGHT LABELS
// Display names, units and decimals for each metric in the insights card
// =========================================================
const INSIGHT_COPY={
co2:{
label:'CO₂',name:'CO₂',unit:' ppm',digits:0
},
voc:{
label:'VOC Index',name:'VOC Index',unit:'',digits:0
},
pm25avg:{
label:'24-hour PM2.5',name:'24-hour PM2.5 average',unit:' µg/m³',digits:1
}
};

// =========================================================
// INSIGHT STYLES
// Injects the colors for status words (normal / attention / critical) once
// =========================================================
function ensureInsightStyles(){
if(document.getElementById('insight-level-style'))return;
const st=document.createElement('style');
st.id='insight-level-style';
st.textContent=
'.ins-s{font-weight:700}'+
'.ins-s.normal{color:var(--accent-green,#10b981)}'+
'.ins-s.attention{color:var(--accent-yellow,#FACC15)}'+
'.ins-s.critical{color:var(--accent-red,#ef4444)}';
document.head.appendChild(st);
}

// =========================================================
// CONTENT RENDERING HELPERS
// Builds the HTML blocks used by insights and recommendations
// =========================================================
const statusTag=(state,text)=>'<span class="ins-s '+state+'">'+text+'</span>';

// Splits "text ... source: xyz" into body and source
function splitSource(text){
const match=String(text||'').match(/^(.*?)(?:\s+)?source:\s*(.+)$/i);
return match
?{body:match[1].trim(),source:match[2].trim()}
:{body:String(text||''),source:''};
}

// One content card: heading, paragraph, and optional source line
const contentLine=(label,body)=>{
const content=splitSource(body);
return'<div class="content-item">'+
'<div class="content-heading">'+label+':</div>'+
'<p>'+escapeHtml(content.body)+'</p>'+
(content.source?'<small class="content-source">source: '+escapeHtml(content.source)+'</small>':'')+
'</div>';
};

// Insight card: label + colored status + scientific explanation
const insightLine=(label,tag,reading,meaning)=>{
const scientific=splitSource(meaning);
return contentLine(escapeHtml(label)+' — '+tag,[reading,scientific.body].filter(Boolean).join(' ')+
(scientific.source?' source: '+scientific.source:''));
};

// =========================================================
// SCIENTIFIC CONTENT STORAGE + ALIASES
// Firebase paths for insight/recommendation text and the key names
// that map to each metric and status
// =========================================================
const SCIENTIFIC_CONTENT_PATHS={
insight:'/Infos/insight',
recommendations:'/Infos/actionableRecommendation'
};

const scientificContent={
insight:{co2:{},voc:{},pm25:{}},
recommendations:{co2:{},voc:{},pm25:{}}
};

// Alternative metric key names that may appear in Firebase
const contentMetricAliases={
co2:['co2'],
voc:['voc','vocIdx'],
pm25:['pm25','pm','pm25avg','pm2p5_WHO24hAQG']
};

// Alternative status key names that may appear in Firebase
const contentStatusAliases={
harmless:['normal','harmless'],
elevated:['elevated'],
unacceptable:['unacceptable'],
improvement:['improvement'],
normal_baseline:['baseline','normalBaseline','normal_baseline'],
deterioration:['deterioration'],
within_who_24_hour_aqg:['within_WHO24hAQG','within_who_24_hour_aqg'],
above_who_24_hour_aqg:['above_WHO24hAQG','above_who_24_hour_aqg']
};

// =========================================================
// SCIENTIFIC CONTENT NORMALIZATION
// Cleans Firebase content into { metric: { status: text } }
// =========================================================

// Reads text from a string or an object, and appends its source if present
function scientificContentValue(value){
if(typeof value==='string')return value;
if(!value||typeof value!=='object')return undefined;
const text=value.text||value.description||value.recommendation||value.insight;
if(typeof text!=='string')return undefined;
const source=value.source||value.sources||value.reference;
return typeof source==='string'&&source.trim()
?text+' Source: '+source
:text;
}

// Matches a key to a known status using the alias table
function canonicalContentStatus(key){
const normalized=key.replace(/([a-z])([A-Z])/g,'$1_$2').toLowerCase();
for(const [state,aliases] of Object.entries(contentStatusAliases)){
if(aliases.some(alias=>alias.replace(/([a-z])([A-Z])/g,'$1_$2').toLowerCase()===normalized))return state;
}
return undefined;
}

// Matches a prefixed key (e.g. "co2_normal") to the exact status for that metric
function canonicalContentKey(metric,key){
const normalized=key.replace(/([a-z])([A-Z])/g,'$1_$2').toLowerCase();
const suffix=normalized.replace(/^.*?_/, '');
if(metric==='co2'){
if(suffix==='normal'||suffix==='harmless')return'harmless';
if(suffix==='elevated')return'elevated';
if(suffix==='unacceptable')return'unacceptable';
}
if(metric==='voc'){
if(suffix==='improvement')return'improvement';
if(suffix==='baseline'||suffix==='normal_baseline')return'normal_baseline';
if(suffix==='deterioration')return'deterioration';
}
if(metric==='pm25'){
if(suffix==='within_who24h_aqg'||suffix==='within_who_24_hour_aqg')return'within_who_24_hour_aqg';
if(suffix==='above_who24h_aqg'||suffix==='above_who_24_hour_aqg')return'above_who_24_hour_aqg';
}
return undefined;
}

// Converts a firmware status key into the key used in Firebase content
function contentStatusKey(metric,status){
if(metric==='co2'&&status.key==='normal')return'harmless';
if(metric==='voc'&&status.key==='baseline')return'normal_baseline';
if(metric==='pm25avg'&&status.key==='within_who_24_hour_aqg')return'within_who_24_hour_aqg';
if(metric==='pm25avg'&&status.key==='above_who_24_hour_aqg')return'above_who_24_hour_aqg';
return status.key;
}

// Builds the final { co2, voc, pm25 } content object from raw Firebase data
function normalizeScientificContent(remote){
const normalized={co2:{},voc:{},pm25:{}};
if(!remote||typeof remote!=='object')return normalized;

Object.entries(contentMetricAliases).forEach(([metric,aliases])=>{
// Collect groups by exact alias name and by prefixed keys
const groups=aliases.map(alias=>remote[alias]).filter(group=>group&&typeof group==='object');
Object.entries(remote).forEach(([key,value])=>{
if(aliases.some(alias=>key.toLowerCase().startsWith(alias.toLowerCase()+'_'))){
groups.push({[key]:value});
}
});
// Save the text under its exact status key and general status
groups.forEach(group=>{
Object.entries(group).forEach(([key,value])=>{
const exactStatus=canonicalContentKey(metric,key);
const status=canonicalContentStatus(key.replace(/^.*?_/,''))||canonicalContentStatus(key);
const text=scientificContentValue(value);
if(text){
if(exactStatus)normalized[metric][exactStatus]=text;
if(status&&!normalized[metric][status])normalized[metric][status]=text;
}
});
});
});
return normalized;
}

// =========================================================
// UPDATE INSIGHTS CARD
// Builds one insight block per metric using its current firmware status
// =========================================================
function updateInsights(data){
if(!data||!insightText)return;
ensureInsightStyles();
const lines=[];
[
['co2',toNum(data.co2)],
['voc',toNum(data.VOCidx)],
['pm25avg',latestPm25Avg24h]
].forEach(([key,value])=>{
const copy=INSIGHT_COPY[key];
// Hide the PM2.5 insight until 24 hours of history exist
if(key==='pm25avg'&&!pm25HistoryReady)return;
const status=key==='pm25avg'
?getPm25AverageStatus()
:getFirmwareStatus(data,key);
const hasValue=typeof value==='number';
if(!hasValue&&!status.raw&&key!=='pm25avg')return;
const reading='';
const contentGroup=key==='pm25avg'?'pm25':key;
const firebaseStatusKey=contentStatusKey(key,status);
const meaning=scientificContent.insight[contentGroup][firebaseStatusKey]||
scientificContent.insight[contentGroup][status.key]||'';
lines.push(insightLine(
copy.label,statusTag(status.tone||'',escapeHtml(status.label)),
escapeHtml(reading),
meaning
));
});
// Placeholder while PM2.5 history is still being collected
if(!pm25HistoryReady){
lines.push('<div class="content-item"><strong>WHO PM2.5 24-hour AQG:</strong><p>Collecting PM2.5 data. The insights will appear after a full 24 hours of history.</p></div>');
}
insightText.innerHTML=lines.length?lines.join(''):'<div>Waiting for telemetry data...</div>';
}

// =========================================================
// LIVE TELEMETRY LISTENER
// Runs every time the device sends new data to Firebase
// =========================================================
onValue(ref(db,aeroCubePath+'/telemetry'),snapshot=>{
const data=snapshot.val();
if(!data){clearStaleSensorData();return;}
latestTelemetry=data;
renderTelemetryReadings(data);
updateSensorStatuses(data);
// Check each metric and send alerts if needed
[
['co2',toNum(data.co2),' ppm'],
['voc',toNum(data.VOCidx),''],
['pm25avg',latestPm25Avg24h,' µg/m³']
].forEach(([metric,value,unit])=>{
const status=metric==='pm25avg'
?getPm25AverageStatus()
:getFirmwareStatus(data,metric);
if(value!==undefined&&value!==null){
notifyMetricState(metric,status,fmt(value)+unit);
}else if(!status.raw){
notificationStates[metric]=null;
}
});
announceFirstReading();
recordReading(data);
updateInsights(data);
updateRecommendations(data);
updatePm25Average24h();
if(window.lucide)lucide.createIcons();
});

// =========================================================
// DEVICE METADATA LISTENER
// Tracks the device's last-seen time and refreshes the connection status
// =========================================================
let latestLastSeen=null;

onValue(ref(db,aeroCubePath+'/metadata'),snapshot=>{
const meta=snapshot.val();
latestLastSeen=meta?meta.lastSeen:null;
updateDeviceConnectionStatus(latestLastSeen);
});

// Re-check the connection every 15 seconds (detects when data stops)
setInterval(()=>{
updateDeviceConnectionStatus(latestLastSeen);
},15000);

// =========================================================
// RECOMMENDATION SETTINGS
// Firebase paths and default (empty) recommendation structure
// =========================================================
const RECOMMENDATIONS_PATHS=[
aeroCubePath+'/settings/recommendations',
aeroCubePath+'/settings/recommendation'
];

const DEFAULT_RECOMMENDATIONS={co2:{},voc:{},pm25:{}};

let recommendationSettings=DEFAULT_RECOMMENDATIONS;

// =========================================================
// RECOMMENDATION NORMALIZATION
// Accepts a string or an object (text/description/recommendation) and merges groups
// =========================================================
function normalizeRecommendationValue(value){
if(typeof value==='string')return value;
if(value&&typeof value==='object'){
if(typeof value.text==='string')return value.text;
if(typeof value.description==='string')return value.description;
if(typeof value.recommendation==='string')return value.recommendation;
}
return undefined;
}

function mergeRecommendationGroup(defaultGroup,remoteGroup){
const merged={...defaultGroup};
if(!remoteGroup||typeof remoteGroup!=='object')return merged;

Object.keys(remoteGroup).forEach(key=>{
const value=normalizeRecommendationValue(remoteGroup[key]);
if(value)merged[key]=value;
});

return merged;
}

// Builds the final { co2, voc, pm25 } recommendations from all remote sources
function normalizeRecommendations(remote){
if(!remote||typeof remote!=='object')return {co2:{},voc:{},pm25:{}};

const normalized={
co2:remote.co2||{},
voc:remote.voc||{},
pm25:remote.pm25||remote.pm||remote.pm25avg||{}
};
const scientific=normalizeScientificContent(remote);
normalized.co2={...scientific.co2,...normalized.co2};
normalized.voc={...scientific.voc,...normalized.voc};
normalized.pm25={...scientific.pm25,...normalized.pm25};

return{
co2:mergeRecommendationGroup(DEFAULT_RECOMMENDATIONS.co2,normalized.co2),
voc:mergeRecommendationGroup(DEFAULT_RECOMMENDATIONS.voc,normalized.voc),
pm25:mergeRecommendationGroup(DEFAULT_RECOMMENDATIONS.pm25,normalized.pm25)
};
}

// =========================================================
// RECOMMENDATION SOURCES MERGING
// Three Firebase sources are merged together (deep merge)
// =========================================================
const remoteRecommendations=[null,null,null];

function mergeRemoteContent(base,addition){
const merged={...base};
Object.entries(addition||{}).forEach(([key,value])=>{
if(value&&typeof value==='object'&&!Array.isArray(value)&&
merged[key]&&typeof merged[key]==='object'&&!Array.isArray(merged[key])){
merged[key]=mergeRemoteContent(merged[key],value);
}else{
merged[key]=value;
}
});
return merged;
}

// Combine all sources, store them, and refresh the recommendations card
function applyRecommendationSettings(){
const remote=remoteRecommendations.reduce((merged,current)=>mergeRemoteContent(merged,current),{});
recommendationSettings=normalizeRecommendations(remote);

if(latestTelemetry&&previousConnectionState!==false){
updateRecommendations(latestTelemetry);
}
}

// =========================================================
// FIREBASE LISTENERS FOR RECOMMENDATIONS + INSIGHTS CONTENT
// Re-render when any of these paths change
// =========================================================
onValue(ref(db,RECOMMENDATIONS_PATHS[0]),snapshot=>{
remoteRecommendations[0]=snapshot.val();
applyRecommendationSettings();
});

onValue(ref(db,RECOMMENDATIONS_PATHS[1]),snapshot=>{
remoteRecommendations[1]=snapshot.val();
applyRecommendationSettings();
});

onValue(ref(db,SCIENTIFIC_CONTENT_PATHS.recommendations),snapshot=>{
remoteRecommendations[2]=snapshot.val();
applyRecommendationSettings();
});

onValue(ref(db,SCIENTIFIC_CONTENT_PATHS.insight),snapshot=>{
scientificContent.insight=normalizeScientificContent(snapshot.val());
if(latestTelemetry&&previousConnectionState!==false){
updateInsights(latestTelemetry);
}
});

// =========================================================
// RECOMMENDATION LOOKUP
// Finds the recommendation text matching a metric's current status
// =========================================================
function getSensorRecommendation(data,metric,group){
const status=metric==='pm25avg'
?getPm25AverageStatus()
:getFirmwareStatus(data,metric);
let text;
if(status.raw&&status.tone){
const firebaseStatusKey=contentStatusKey(metric,status);
text=recommendationSettings[group][firebaseStatusKey]||
recommendationSettings[group][status.tone];
}
return{...status,text};
}

// Builds one recommendation card with a colored status label
function recommendationLine(label,text,tone){
const separator=label.indexOf(' — ');
const metricLabel=separator<0?label:label.slice(0,separator);
const statusLabel=separator<0?'':label.slice(separator+3);
const styledLabel=escapeHtml(metricLabel)+
(statusLabel?' — '+statusTag(tone||'',escapeHtml(statusLabel)):'');
return contentLine(styledLabel,text);
}

// =========================================================
// UPDATE RECOMMENDATIONS CARD
// Shows recommendations for CO2, VOC and (once ready) 24-hour PM2.5
// =========================================================
function updateRecommendations(data){
if(!recContent||!data)return;
const metrics=[
['co2','co2','CO₂'],
['voc','voc','VOC Index']
];
if(pm25HistoryReady)metrics.push(['pm25avg','pm25','24-hour PM2.5']);
const lines=metrics.map(([metric,group,label])=>{
const recommendation=getSensorRecommendation(data,metric,group);
return recommendationLine(label+' — '+recommendation.label,recommendation.text,recommendation.tone);
});
// Placeholder while PM2.5 history is still being collected
if(!pm25HistoryReady){
lines.push('<div class="content-item"><strong>WHO PM2.5 24-hour AQG:</strong><p>Collecting PM2.5 data. The recommendation will appear after a full 24 hours of history.</p></div>');
}
recContent.innerHTML=lines.join('');
}

// =========================================================
// INITIAL PM2.5 LOAD + HISTORY LISTENER
// Calculates the 24-hour average on load and whenever history changes
// =========================================================
updatePm25Average24h();

onValue(ref(db,aeroCubePath+'/history'),()=>{
updatePm25Average24h();
});

// =========================================================
// DASHBOARD CLOCK
// Shows the current local time and date, updated every second
// =========================================================
const clockTime=document.getElementById('clock-time');
const clockDate=document.getElementById('clock-date');

function updateClock(){
const now=new Date();
if(clockTime)clockTime.textContent=now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
if(clockDate)clockDate.textContent=now.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}

updateClock();
setInterval(updateClock,1000);