import{db,auth,BASE_PATH}from'./firebase.js';
import{ref,onValue,update,get}from"https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import{signOut,onAuthStateChanged}from"https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
onAuthStateChanged(auth,user=>{
if(!user)window.location.href='Registration.html';
});
document.getElementById('btn-logout')?.addEventListener('click',async e=>{
e.preventDefault();
try{
await signOut(auth);
window.location.href='Registration.html';
}catch(err){
console.error("Logout error:",err);
}
});
const menuToggle=document.getElementById('menuToggle');
const sidebar=document.getElementById('sidebar');
const overlay=document.getElementById('sidebarOverlay');
const savedAeroCubeId=localStorage.getItem('aerocube-id')||BASE_PATH.split('/').pop();
const aeroCubePath='/Aerocubes/'+savedAeroCubeId;
const deviceSelectorForm=document.getElementById('device-selector-form');
const aerocubeIdInput=document.getElementById('aerocube-id');
const deviceName=document.getElementById('device-name');
if(aerocubeIdInput)aerocubeIdInput.value=savedAeroCubeId;
if(deviceName)deviceName.innerText=savedAeroCubeId;
deviceSelectorForm?.addEventListener('submit',e=>{
e.preventDefault();
const cubeId=aerocubeIdInput.value.trim();
const validId=/^[A-Za-z0-9_-]+$/;
if(!validId.test(cubeId))return;
localStorage.setItem('aerocube-id',cubeId);
window.location.reload();
});
function toggleMenu(){
sidebar?.classList.toggle('open');
overlay?.classList.toggle('active');
}
menuToggle?.addEventListener('click',toggleMenu);
overlay?.addEventListener('click',toggleMenu);
sidebar?.querySelectorAll('a.nav-item').forEach(link=>{
link.addEventListener('click',()=>{
if(sidebar.classList.contains('open'))toggleMenu();
});
});
document.addEventListener('keydown',e=>{
if(e.key==='Escape'&&sidebar?.classList.contains('open'))toggleMenu();
});
window.addEventListener('resize',()=>{
if(window.innerWidth>768&&sidebar?.classList.contains('open'))toggleMenu();
});
const valCo2=document.getElementById('val-co2');
const valPm25=document.getElementById('val-pm25');
const valPm25Avg24h=document.getElementById('val-pm25-24h');
const valVoc=document.getElementById('val-voc');
const valPm10=document.getElementById('val-pm10');
const valTemp=document.getElementById('val-temp');
const valHumidity=document.getElementById('val-humidity');
const valPm1=document.getElementById('val-pm1');
const valPm4=document.getElementById('val-pm4');
const statusCo2=document.getElementById('status-co2');
const statusPm25Avg24h=document.getElementById('status-pm25-24h');
const statusVoc=document.getElementById('status-voc');
const aqBanner=document.getElementById('aq-banner');
const aqBannerStatus=document.getElementById('aq-banner-status');
const aqBannerDesc=document.getElementById('aq-banner-desc');
const deviceIndicator=document.getElementById('device-indicator');
const deviceLastSeen=document.getElementById('device-last-seen');
const deviceConnBadge=document.getElementById('device-connection-badge');
const deviceStatusText=document.getElementById('device-status-text');
const switchBuzzer=document.getElementById('switch-buzzer');
const textBuzzer=document.getElementById('text-buzzer');
const notificationButton=document.getElementById('btn-notifications');
const recContent=document.getElementById('recommendations-content');
const insightText=document.getElementById('insight-text');
const notificationStates={};
let previousConnectionState=null;
let firstReadingHandled=false;
let latestTelemetry=null;
let latestPm25Avg24h=null;
let pm25HistoryReady=false;
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
const ALERT_REMINDER_MS=5*60*1000;
const ALERT_STATES={good:true,elevated:true,poor:true};
const ALERT_ON_FIRST_GOOD=false;
const USE_FIREBASE_RECOMMENDATIONS=false;
const ALERT_GOOD_SUMMARY='Keep up your normal ventilation.';
const alertLastSent={};
const ALERT_INFO={
co2:{
name:'CO₂',
ranges:{
good:'below 1000 ppm',
elevated:'1000 to 1499 ppm',
poor:'1500 ppm or more'
},
meaning:{
good:'within the configured good range',
elevated:'elevated',
poor:'high'
},
action:{
good:'Keep ventilating as usual.',
elevated:'Open a window or turn on ventilation.',
poor:'Improve ventilation by opening windows or doors when appropriate.'
}
},
voc:{
name:'VOC Index',
ranges:{
good:'below 150',
elevated:'150 to 249',
poor:'250 or more'
},
meaning:{
good:'within the configured good range',
elevated:'elevated',
poor:'high'
},
action:{
good:'Keep ventilating as usual.',
elevated:'Avoid sprays, paint and strong cleaners. Let fresh air in.',
poor:'Reduce potential VOC sources and improve ventilation.'
}
},
pm25avg:{
name:'24-hour average PM2.5',
ranges:{
good:'15 µg/m³ or lower',
elevated:'above 15 up to 25 µg/m³',
poor:'above 25 µg/m³'
},
meaning:{
good:'within the configured good range',
elevated:'above the configured good range',
poor:'above the configured poor threshold'
},
action:{
good:'Maintain current conditions and continue monitoring.',
elevated:'Reduce potential sources such as dust, smoke, cooking emissions, or incense.',
poor:'Reduce or remove nearby particulate sources and improve indoor air conditions.'
}
}
};
const ALERT_WORDS={good:'good',elevated:'elevated',poor:'poor'};
function getAdvice(metricKey,state){
if(USE_FIREBASE_RECOMMENDATIONS){
const rec=(recommendationSettings[metricKey]||{})[state];
if(rec)return typeof rec==='string'?rec:rec.text;
}
return ALERT_INFO[metricKey].action[state];
}
function showToast(title,body,state='poor'){
let stack=document.getElementById('toast-stack');
if(!stack){
stack=document.createElement('div');
stack.id='toast-stack';
document.body.appendChild(stack);
}
const toast=document.createElement('div');
toast.className='toast toast-'+state;
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
async function sendNotification(title,body,tag='aerocube-alert',state='poor'){
showToast(title,body,state);
if(state==='poor'&&navigator.vibrate)navigator.vibrate([200,100,200]);
await showSystemNotification(title,body,tag);
}
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
'You will be alerted when CO₂, VOC Index or the 24-hour average PM2.5 changes between the configured ranges.',
'aerocube-test',
'good'
);
}else if(Notification.permission==='denied'){
window.alert('Notifications are blocked. Allow them in your browser or site settings, then reload the page.');
}
});
updateNotificationButton();
const THRESHOLDS={
co2:{elevated:1000,poor:1500},
voc:{elevated:150,poor:250},
pm25avg:{elevated:15,poor:25}
};
function setCardVisual(cardId,state){
const card=document.getElementById(cardId);
if(!card)return;
card.classList.remove('border-good','border-elevated','border-poor');
if(state)card.classList.add('border-'+state);
}
function setStatusPill(element,state,label){
if(!element)return;
element.className='card-status '+(state||'');
element.innerText=label;
}
function getCo2Status(co2){
if(co2>=THRESHOLDS.co2.poor)return{state:'poor',label:'POOR'};
if(co2>=THRESHOLDS.co2.elevated)return{state:'elevated',label:'ELEVATED'};
return{state:'good',label:'NORMAL'};
}
function getVocStatus(voc){
if(voc>=THRESHOLDS.voc.poor)return{state:'poor',label:'POOR'};
if(voc>=THRESHOLDS.voc.elevated)return{state:'elevated',label:'ELEVATED'};
return{state:'good',label:'NORMAL'};
}
function getPm25AverageStatus(value){
if(value>THRESHOLDS.pm25avg.poor)return{state:'poor',label:'POOR'};
if(value>THRESHOLDS.pm25avg.elevated)return{state:'elevated',label:'ELEVATED'};
return{state:'good',label:'GOOD'};
}
function getAirQualityBannerInfo(statusStr){
const s=(statusStr||'').toUpperCase();
if(s==='GOOD'){
return{
state:'good',
label:'GOOD',
desc:'All monitored parameters are currently within the defined thresholds.'
};
}
if(s==='ELEVATED'){
return{
state:'elevated',
label:'ELEVATED',
desc:'One or more monitored parameters have exceeded the elevated threshold.'
};
}
if(s==='POOR'){
return{
state:'poor',
label:'POOR',
desc:'One or more monitored parameters have reached the poor-air-quality threshold.'
};
}
return{
state:null,
label:'--',
desc:'Awaiting data from AeroCube device...'
};
}
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
function clearStaleSensorData(){
firstReadingHandled=false;
notificationStates.co2=null;
notificationStates.voc=null;
valCo2.innerHTML='-- <span>ppm</span>';
valPm25.innerHTML='-- <span>µg/m³</span>';
valVoc.innerText='--';
valPm10.innerHTML='-- <span>µg/m³</span>';
valTemp.innerHTML='-- <span>°C</span>';
valHumidity.innerHTML='-- <span>%</span>';
valPm1.innerHTML='-- <span>µg/m³</span>';
valPm4.innerHTML='-- <span>µg/m³</span>';
setStatusPill(statusCo2,'','No data');
setStatusPill(statusVoc,'','No data');
setCardVisual('card-co2',null);
setCardVisual('card-voc',null);
aqBanner.className='aq-status-banner';
aqBannerStatus.innerText='NO DATA';
aqBannerDesc.innerText='Waiting for data from AeroCube device...';
if(insightText)insightText.innerHTML='<div>Waiting for telemetry data...</div>';
if(recContent)recContent.innerHTML='<div>Waiting for telemetry data...</div>';
}
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
online?'good':'poor'
);
}
previousConnectionState=online;
if(!online)clearStaleSensorData();
}
function notifyMetricState(metricKey,state,value){
const info=ALERT_INFO[metricKey];
if(!info)return;
const now=Date.now();
const prev=notificationStates[metricKey];
notificationStates[metricKey]=state;
if(prev===state){
if(state==='poor'&&ALERT_STATES.poor&&now-(alertLastSent[metricKey]||0)>=ALERT_REMINDER_MS){
alertLastSent[metricKey]=now;
sendNotification(
info.name+' is still poor',
info.name+' is '+value+'.\n'+getAdvice(metricKey,'poor'),
'aerocube-'+metricKey,
'poor'
);
}
return;
}
if(!prev&&state==='good'&&!ALERT_ON_FIRST_GOOD)return;
if(!ALERT_STATES[state])return;
alertLastSent[metricKey]=now;
const range=info.ranges[state];
const word=ALERT_WORDS[state];
const advice=getAdvice(metricKey,state);
const todo=state==='good'?advice:'What to do: '+advice;
let title;
let body;
if(state==='elevated'&&prev==='poor'){
title=info.name+' is getting better';
body=info.name+' is now '+value+', down from poor.\nIt is still elevated ('+range+').\n'+todo;
}else{
title=info.name+' is '+word;
body=info.name+' is now '+value+'.\n'+word.charAt(0).toUpperCase()+word.slice(1)+' means '+range+'.\n'+todo;
}
sendNotification(title,body,'aerocube-'+metricKey,state);
}
function announceFirstReading(){
if(firstReadingHandled)return;
const states=['co2','voc'].map(k=>notificationStates[k]).filter(Boolean);
if(states.length<2)return;
firstReadingHandled=true;
if(!ALERT_STATES.good)return;
if(states.every(st=>st==='good')){
sendNotification(
'Current CO₂ and VOC readings are good',
'CO₂ and VOC Index are currently in the configured good ranges.\n'+ALERT_GOOD_SUMMARY,
'aerocube-summary',
'good'
);
}
}
window.aeroTest=function(metric,value){
const getters={
co2:getCo2Status,
voc:getVocStatus,
pm25avg:getPm25AverageStatus
};
if(!getters[metric]||typeof value!=='number'){
console.log("Use: aeroTest('co2' | 'voc' | 'pm25avg', number)");
return;
}
const s=getters[metric](value);
const displayValue=metric==='co2'?value+' ppm':metric==='pm25avg'?value+' µg/m³':value;
notifyMetricState(metric,s.state,displayValue);
console.log(metric,value,'->',s.state);
};
const fmt=(v,d=1)=>typeof v==='number'?Number(v.toFixed(d)):v;
const PUSH_CHARS='-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
function getTimestampFromPushId(pushId){
let time=0;
for(let i=0;i<8;i++){
const index=PUSH_CHARS.indexOf(pushId.charAt(i));
if(index<0)return 0;
time=time*64+index;
}
return time;
}
function normalizeTimestamp(raw){
if(raw===undefined||raw===null||raw==='')return 0;
let value=Number(raw);
if(Number.isNaN(value))value=Date.parse(raw);
if(Number.isNaN(value)||value<=0)return 0;
return value<1e12?value*1000:value;
}
const TREND_WINDOW_MIN=15;
const KEEP_MS=60*60*1000;
const TREND_MIN_CHANGE={
co2:50,
voc:10,
temp:0.5,
humidity:3,
pm25:5
};
let recentReadings=[];
function toNum(v){
if(v===undefined||v===null||v==='')return undefined;
const n=Number(v);
return Number.isFinite(n)?n:undefined;
}
function recordReading(data){
const now=Date.now();
const last=recentReadings[recentReadings.length-1];
if(last&&now-last.t<10000)return;
recentReadings.push({
t:now,
co2:toNum(data.co2),
voc:toNum(data.VOCidx),
temp:toNum(data.temp),
humidity:toNum(data.humidity),
pm25:toNum(data.pm?.pm2p5)
});
recentReadings=recentReadings.filter(r=>r.t>=now-KEEP_MS);
}
function seedRecentReadings(seed){
if(!seed.length)return;
seed.sort((a,b)=>a.t-b.t);
const lastSeed=seed[seed.length-1].t;
recentReadings=seed.concat(recentReadings.filter(r=>r.t>lastSeed)).filter(r=>r.t>=Date.now()-KEEP_MS);
}
function seriesOf(key,ms){
const cut=Date.now()-ms;
return recentReadings.filter(r=>r.t>=cut&&typeof r[key]==='number');
}
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
async function updatePm25Average24h(){
if(!valPm25Avg24h||!statusPm25Avg24h)return;
try{
const snapshot=await get(ref(db,aeroCubePath+'/history'));
if(!snapshot.exists()){
latestPm25Avg24h=null;
pm25HistoryReady=false;
valPm25Avg24h.innerHTML='-- <span>µg/m³</span>';
setStatusPill(statusPm25Avg24h,'','No history available');
setCardVisual('card-pm25-24h',null);
if(latestTelemetry){
updateInsights(latestTelemetry);
updateRecommendations(latestTelemetry);
}
return;
}
const now=Date.now();
const cutoff=now-24*60*60*1000;
const history=snapshot.val();
const readings=[];
const seed=[];
let oldestTimestamp=Infinity;
for(const key in history){
const log=history[key];
let timestamp=normalizeTimestamp(log.timestamp||log.time||log.created_at);
if(!timestamp&&key.startsWith('-'))timestamp=getTimestampFromPushId(key);
if(!timestamp)continue;
if(timestamp<oldestTimestamp)oldestTimestamp=timestamp;
if(timestamp>=now-KEEP_MS&&timestamp<=now){
seed.push({
t:timestamp,
co2:toNum(log.co2),
voc:toNum(log.VOCidx),
temp:toNum(log.temp),
humidity:toNum(log.humidity),
pm25:toNum(log.pm?.pm2p5)
});
}
if(timestamp<cutoff||timestamp>now)continue;
const rawPm25=log.pm?.pm2p5;
if(rawPm25===undefined||rawPm25===null||rawPm25==='')continue;
const pm25=Number(rawPm25);
if(Number.isFinite(pm25))readings.push({timestamp,value:pm25});
}
seedRecentReadings(seed);
const hasFull24Hours=oldestTimestamp!==Infinity&&oldestTimestamp<=cutoff;
if(!hasFull24Hours||readings.length===0){
latestPm25Avg24h=null;
pm25HistoryReady=false;
valPm25Avg24h.innerHTML='-- <span>µg/m³</span>';
setStatusPill(statusPm25Avg24h,'','Collecting 24-hour history');
setCardVisual('card-pm25-24h',null);
if(latestTelemetry){
updateInsights(latestTelemetry);
updateRecommendations(latestTelemetry);
}
return;
}
const average=readings.reduce((sum,item)=>sum+item.value,0)/readings.length;
latestPm25Avg24h=average;
pm25HistoryReady=true;
const status=getPm25AverageStatus(average);
valPm25Avg24h.innerHTML=fmt(average)+' <span>µg/m³</span>';
setStatusPill(statusPm25Avg24h,status.state,status.label);
setCardVisual('card-pm25-24h',status.state);
notifyMetricState('pm25avg',status.state,fmt(average)+' µg/m³');
if(latestTelemetry){
updateInsights(latestTelemetry);
updateRecommendations(latestTelemetry);
}
}catch(error){
console.error('Unable to calculate 24-hour PM2.5 average:',error);
latestPm25Avg24h=null;
pm25HistoryReady=false;
valPm25Avg24h.innerHTML='-- <span>µg/m³</span>';
setStatusPill(statusPm25Avg24h,'','Unable to load history');
setCardVisual('card-pm25-24h',null);
}
}
const STATE_LABEL={
good:'Good',
elevated:'Elevated',
poor:'High'
};
const INSIGHT_COPY={
co2:{
label:'Air Freshness (CO₂)',
name:'CO₂',
unit:' ppm',
digits:0,
meaning:{
good:'the air is fresh',
elevated:'the air is getting stuffy',
poor:'the air is very stuffy, which can cause sleepiness and headaches'
}
},
voc:{
label:'Odors & Chemicals (VOC)',
name:'VOC Index',
unit:'',
digits:0,
meaning:{
good:'there are no strong fumes or smells',
elevated:'fumes or strong smells are building up',
poor:'there are a lot of fumes in the air, which can irritate your eyes, nose and throat'
}
},
pm25avg:{
label:'24-Hour PM2.5',
meaning:{
good:'there has been little dust or smoke over the last day',
elevated:'there was more dust or smoke than recommended over the last day',
poor:'there was a lot of dust or smoke in the air over the last day'
}
}
};
function ensureInsightStyles(){
if(document.getElementById('insight-level-style'))return;
const st=document.createElement('style');
st.id='insight-level-style';
st.textContent='.ins-s{font-weight:700}'+
'.ins-s.good{color:var(--accent-green,#10b981)}'+
'.ins-s.elevated{color:var(--accent-yellow,#FACC15)}'+
'.ins-s.poor{color:var(--accent-red,#ef4444)}';
document.head.appendChild(st);
}
const statusTag=(state,text)=>'<span class="ins-s '+state+'">'+text+'</span>';
const insightLine=(label,tag,body)=>'<div><strong>'+label+':</strong> '+tag+' — '+body+'</div>';
function trendSentence(key,unit,digits,value,state){
const tr=trendOf(key);
if(!tr)return'';
if(tr.dir==='steady')return'It has been steady for the last '+TREND_WINDOW_MIN+' minutes.';
const up=tr.dir==='up';
const amount=(tr.change>0?'+':'')+fmt(tr.change,digits)+unit;
let sentence='It is '+(up?'rising':'falling')+' ('+amount+' in '+TREND_WINDOW_MIN+' minutes)';
const t=THRESHOLDS[key];
if(t&&up&&state!=='poor'){
const target=state==='good'?t.elevated:t.poor;
const mins=(target-value)/tr.slope;
if(mins>0&&mins<=90){
sentence+=' and could reach the '+(state==='good'?'elevated':'high')+' level ('+target+unit+') in about '+Math.max(1,Math.round(mins))+' minutes';
}
}else if(t&&!up&&state==='elevated'){
const mins=(value-(t.elevated-1))/Math.abs(tr.slope);
if(mins>0&&mins<=90){
sentence+=' and should be back in the good range in about '+Math.max(1,Math.round(mins))+' minutes';
}
}
return sentence+'.';
}
function pastHourSentence(key,unit,digits){
const hs=hourStats(key);
if(!hs)return'';
return'Past hour: average '+fmt(hs.avg,digits)+unit+', highest '+fmt(hs.max,digits)+unit+'.';
}
const joinSentences=(...parts)=>parts.filter(Boolean).join(' ');
function updateInsights(data){
if(!data||!insightText)return;
ensureInsightStyles();
const states={};
const lines=[];
if(data.temp!==undefined){
const t=data.temp;
const state=t>=30?'poor':t<=18?'elevated':'good';
const word=t>=30?'Hot':t<=18?'Cold':'Comfortable';
const text=t>=30
?'which is very hot and can be uncomfortable and tiring.'
:t<=18
?'which is quite cold.'
:'which is comfortable.';
lines.push(insightLine(
'Temperature',
statusTag(state,word),
joinSentences(
'The room is '+fmt(t)+' °C, '+text,
trendSentence('temp',' °C',1,t,state),
pastHourSentence('temp',' °C',1)
)
));
}
if(data.humidity!==undefined){
const h=data.humidity;
const state=h>=70?'poor':h<=30?'elevated':'good';
const word=h>=70?'Very humid':h<=30?'Very dry':'Comfortable';
const text=h>=70
?'so the air is very damp. Mold and dust mites grow easily in damp air.'
:h<=30
?'so the air is very dry, which can irritate your skin and throat.'
:'so the moisture in the air is comfortable.';
lines.push(insightLine(
'Humidity',
statusTag(state,word),
joinSentences(
'Humidity is '+fmt(h)+'%, '+text,
trendSentence('humidity','%',0,h,state),
pastHourSentence('humidity','%',0)
)
));
}
[
['co2',data.co2,getCo2Status],
['voc',data.VOCidx,getVocStatus]
].forEach(([key,value,getStatus])=>{
if(value===undefined)return;
const copy=INSIGHT_COPY[key];
const state=states[key]=getStatus(value).state;
lines.push(insightLine(
copy.label,
statusTag(state,STATE_LABEL[state]),
joinSentences(
copy.name+' is '+fmt(value,copy.digits)+copy.unit+', so '+copy.meaning[state]+'.',
trendSentence(key,copy.unit,copy.digits,value,state),
pastHourSentence(key,copy.unit,copy.digits),
state==='good'?'':'What to do: '+ALERT_INFO[key].action[state]
)
));
});
if(data.pm?.pm2p5!==undefined){
const currentPm25=Number(data.pm.pm2p5);
lines.push(
'<div><strong>Current PM2.5:</strong> '+
fmt(currentPm25)+
' µg/m³</div>'
);
}
const pm=INSIGHT_COPY.pm25avg;
if(pm25HistoryReady&&latestPm25Avg24h!==null){
const state=states.pm25avg=getPm25AverageStatus(latestPm25Avg24h).state;
const now=data.pm?.pm2p5!==undefined
?' (right now: '+fmt(data.pm.pm2p5)+' µg/m³)'
:'';
lines.push(insightLine(
pm.label,
statusTag(state,STATE_LABEL[state]),
joinSentences(
'The 24-hour average is '+fmt(latestPm25Avg24h)+' µg/m³'+now+', so '+pm.meaning[state]+'.',
state==='good'?'':'What to do: '+ALERT_INFO.pm25avg.action[state]
)
));
}else{
lines.push('<div><strong>'+pm.label+':</strong> AeroCube is collecting enough historical data to calculate the full 24-hour average.</div>');
}
if(states.co2&&states.voc&&states.co2!=='good'&&states.voc!=='good'){
lines.push('<div><strong>Note:</strong> CO₂ and VOC are both up. This usually means a closed room with people or products in use. Fresh air helps both.</div>');
}
if(states.co2&&states.co2!=='good'&&data.humidity!==undefined&&data.humidity>=60){
lines.push('<div><strong>Note:</strong> Breathing adds both CO₂ and moisture to a closed room. Ventilating will help with both.</div>');
}
const names={
co2:'CO₂',
voc:'VOC',
pm25avg:'24-hour PM2.5'
};
const list=st=>Object.keys(states).filter(k=>states[k]===st).map(k=>names[k]);
const poor=list('poor');
const elevated=list('elevated');
let overall='';
if(poor.length){
overall=statusTag('poor','Air needs attention: '+poor.join(' and ')+(poor.length>1?' are':' is')+' high.');
}else if(elevated.length){
overall=statusTag('elevated','Air is okay, but '+elevated.join(' and ')+(elevated.length>1?' are':' is')+' elevated.');
}else if(Object.keys(states).length){
overall=statusTag('good','Your air looks healthy right now.');
}
if(overall)lines.unshift('<div><strong>Overall:</strong> '+overall+'</div>');
insightText.innerHTML=lines.length?lines.join(''):'<div>Waiting for telemetry data...</div>';
}
onValue(ref(db,aeroCubePath+'/telemetry'),snapshot=>{
const data=snapshot.val();
if(!data)return;
const bannerInfo=getAirQualityBannerInfo(data.airQualityStatus);
aqBanner.className='aq-status-banner state-'+(bannerInfo.state||'');
aqBannerStatus.innerText=bannerInfo.label;
aqBannerDesc.innerText=bannerInfo.desc;
if(data.co2!==undefined){
valCo2.innerHTML=data.co2+' <span>ppm</span>';
const s=getCo2Status(data.co2);
setStatusPill(statusCo2,s.state,s.label);
setCardVisual('card-co2',s.state);
notifyMetricState('co2',s.state,data.co2+' ppm');
}
if(data.pm?.pm2p5!==undefined){
valPm25.innerHTML=fmt(data.pm.pm2p5)+' <span>µg/m³</span>';
}
if(data.VOCidx!==undefined){
valVoc.innerText=data.VOCidx;
const s=getVocStatus(data.VOCidx);
setStatusPill(statusVoc,s.state,s.label);
setCardVisual('card-voc',s.state);
notifyMetricState('voc',s.state,data.VOCidx);
}
if(data.pm?.pm10p0!==undefined){
valPm10.innerHTML=fmt(data.pm.pm10p0)+' <span>µg/m³</span>';
}
if(data.temp!==undefined){
valTemp.innerHTML=fmt(data.temp)+' <span>°C</span>';
}
if(data.humidity!==undefined){
valHumidity.innerHTML=data.humidity+' <span>%</span>';
}
if(data.pm){
if(data.pm.pm1p0!==undefined){
valPm1.innerHTML=fmt(data.pm.pm1p0)+' <span>µg/m³</span>';
}
if(data.pm.pm4p0!==undefined){
valPm4.innerHTML=fmt(data.pm.pm4p0)+' <span>µg/m³</span>';
}
}
announceFirstReading();
latestTelemetry=data;
recordReading(data);
updateInsights(data);
updateRecommendations(data);
if(window.lucide)lucide.createIcons();
});
let latestLastSeen=null;
onValue(ref(db,aeroCubePath+'/metadata'),snapshot=>{
const meta=snapshot.val();
latestLastSeen=meta?meta.lastSeen:null;
updateDeviceConnectionStatus(latestLastSeen);
});
setInterval(()=>{
updateDeviceConnectionStatus(latestLastSeen);
},15000);
onValue(ref(db,aeroCubePath+'/controls'),snapshot=>{
const controls=snapshot.val();
if(!controls)return;
if(controls.isBuzzerSilenced!==undefined&&switchBuzzer){
switchBuzzer.checked=!controls.isBuzzerSilenced;
textBuzzer.innerText=controls.isBuzzerSilenced?'SILENCED':'ON';
switchBuzzer.disabled=false;
}
});
function updateControls(partialState){
update(ref(db,aeroCubePath+'/controls'),partialState);
}
switchBuzzer?.addEventListener('change',e=>{
updateControls({
isBuzzerSilenced:!e.target.checked
});
});
const RECOMMENDATIONS_PATHS=[
aeroCubePath+'/settings/recommendations',
aeroCubePath+'/settings/recommendation'
];
const DEFAULT_RECOMMENDATIONS={
temperature:{
hot:'Turn on a fan, open a window to let a breeze in, or use an air conditioner if available.',
cold:'Reduce excessive cooling or increase the room temperature if needed.',
good:'No action needed.'
},
humidity:{
humid:'Improve ventilation, use a fan or dehumidifier if available, and check for moisture sources.',
dry:'If possible, add moisture to the room and avoid excessive cooling.',
good:'No action needed.'
},
co2:{
elevated:'Open a window or door, or turn on ventilation to bring in more fresh air.',
poor:'Improve ventilation immediately by opening windows or doors when appropriate and allow fresh air to circulate.',
good:'Keep the room properly ventilated as it currently is.'
},
voc:{
elevated:'Improve ventilation and reduce possible VOC sources such as sprays, fragrances, paint, smoke, or strong cleaning products.',
poor:'Improve ventilation and identify and reduce possible indoor VOC sources such as solvents, strong fragrances, smoke, or cleaning products.',
good:'No action needed. Continue using household products safely.'
},
pm25:{
elevated:'Reduce possible sources such as dust, smoke, cooking emissions, or incense.',
poor:'Reduce or remove nearby sources of dust, smoke, cooking emissions, or other particulate matter. If outdoor air is contributing, consider closing exterior windows.',
good:'No action needed.'
}
};
let recommendationSettings=DEFAULT_RECOMMENDATIONS;
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
Object.keys(defaultGroup).forEach(key=>{
const value=normalizeRecommendationValue(remoteGroup[key]);
if(value)merged[key]=value;
});
return merged;
}
function normalizeRecommendations(remote){
if(!remote||typeof remote!=='object')return DEFAULT_RECOMMENDATIONS;
const normalized={
temperature:remote.temperature||remote.temp||{},
humidity:remote.humidity||{},
co2:remote.co2||{},
voc:remote.voc||{},
pm25:remote.pm25||remote.pm||remote.pm25avg||{}
};
const flatMap={
temperature_hot:['temperature_hot','temp_hot'],
temperature_cold:['temperature_cold','temp_cold'],
temperature_good:['temperature_good','temp_good'],
humidity_humid:['humidity_humid','humidity_high'],
humidity_dry:['humidity_dry'],
humidity_good:['humidity_good'],
co2_elevated:['co2_elevated'],
co2_poor:['co2_poor','co2_high'],
co2_good:['co2_good'],
voc_elevated:['voc_elevated'],
voc_poor:['voc_poor','voc_high'],
voc_good:['voc_good'],
pm25_elevated:['pm25_elevated','pm_elevated'],
pm25_poor:['pm25_poor','pm_poor','pm_high'],
pm25_good:['pm25_good','pm_good']
};
Object.entries(flatMap).forEach(([target,keys])=>{
const separator=target.indexOf('_');
const group=target.substring(0,separator);
const state=target.substring(separator+1);
for(const key of keys){
const value=normalizeRecommendationValue(remote[key]);
if(value){
if(!normalized[group]||typeof normalized[group]!=='object'){
normalized[group]={};
}
normalized[group][state]=value;
break;
}
}
});
return{
temperature:mergeRecommendationGroup(DEFAULT_RECOMMENDATIONS.temperature,normalized.temperature),
humidity:mergeRecommendationGroup(DEFAULT_RECOMMENDATIONS.humidity,normalized.humidity),
co2:mergeRecommendationGroup(DEFAULT_RECOMMENDATIONS.co2,normalized.co2),
voc:mergeRecommendationGroup(DEFAULT_RECOMMENDATIONS.voc,normalized.voc),
pm25:mergeRecommendationGroup(DEFAULT_RECOMMENDATIONS.pm25,normalized.pm25)
};
}
function escapeHtml(value){
return String(value??'').replace(/[&<>"']/g,ch=>({
'&':'&amp;',
'<':'&lt;',
'>':'&gt;',
'"':'&quot;',
"'":'&#39;'
})[ch]);
}
const remoteRecommendations=[null,null];
function applyRecommendationSettings(){
const remote=remoteRecommendations[0]||remoteRecommendations[1];
recommendationSettings=normalizeRecommendations(remote);
if(latestTelemetry&&previousConnectionState!==false){
updateRecommendations(latestTelemetry);
}
}
onValue(ref(db,RECOMMENDATIONS_PATHS[0]),snapshot=>{
remoteRecommendations[0]=snapshot.val();
applyRecommendationSettings();
});
onValue(ref(db,RECOMMENDATIONS_PATHS[1]),snapshot=>{
remoteRecommendations[1]=snapshot.val();
applyRecommendationSettings();
});
function getTemperatureRecommendation(value){
if(value===undefined||value===null){
return{text:'Waiting for temperature data.'};
}
if(value>=30){
return{text:recommendationSettings.temperature.hot};
}
if(value<=18){
return{text:recommendationSettings.temperature.cold};
}
return{text:recommendationSettings.temperature.good};
}
function getHumidityRecommendation(value){
if(value===undefined||value===null){
return{text:'Waiting for humidity data.'};
}
if(value>=70){
return{text:recommendationSettings.humidity.humid};
}
if(value<=30){
return{text:recommendationSettings.humidity.dry};
}
return{text:recommendationSettings.humidity.good};
}
function getCo2Recommendation(value){
if(value===undefined||value===null){
return{state:null,text:'Waiting for CO₂ data.'};
}
const state=getCo2Status(value).state;
return{
state,
text:recommendationSettings.co2[state]
};
}
function getVocRecommendation(value){
if(value===undefined||value===null){
return{state:null,text:'Waiting for VOC data.'};
}
const state=getVocStatus(value).state;
return{
state,
text:recommendationSettings.voc[state]
};
}
function getPm25Recommendation(data){
const current=data.pm?.pm2p5;
if(pm25HistoryReady&&latestPm25Avg24h!==null){
const state=getPm25AverageStatus(latestPm25Avg24h).state;
const prefix='24-hour average: '+fmt(latestPm25Avg24h)+' µg/m³.';
return{
state,
text:prefix+' '+recommendationSettings.pm25[state]
};
}
if(current!==undefined&&current!==null){
return{
state:null,
text:'Current reading: '+fmt(current)+' µg/m³. Collecting 24-hour history before assigning a PM2.5 recommendation.'
};
}
return{
state:null,
text:'Waiting for PM2.5 data.'
};
}
function recommendationLine(label,text){
return'<div><strong>'+escapeHtml(label)+':</strong> '+escapeHtml(text)+'</div>';
}
function updateRecommendations(data){
if(!recContent||!data)return;
const temperature=getTemperatureRecommendation(data.temp);
const humidity=getHumidityRecommendation(data.humidity);
const co2=getCo2Recommendation(data.co2);
const voc=getVocRecommendation(data.VOCidx);
const pm25=getPm25Recommendation(data);
const states=[
data.temp>=30?'poor':data.temp<=18?'elevated':'good',
data.humidity>=70?'poor':data.humidity<=30?'elevated':'good',
co2.state,
voc.state,
pm25.state
].filter(Boolean);
let overall='No immediate action needed.';
if(states.includes('poor')){
overall='Action is needed for one or more conditions.';
}else if(states.includes('elevated')){
overall='Some conditions need attention.';
}
const lines=[
'<div><strong>Overall:</strong> '+escapeHtml(overall)+'</div>',
recommendationLine('Temperature',temperature.text),
recommendationLine('Humidity',humidity.text),
recommendationLine('Air Freshness (CO₂)',co2.text),
recommendationLine('Odors & Chemicals (VOC)',voc.text),
recommendationLine('PM2.5',pm25.text)
];
recContent.innerHTML=lines.join('');
}
updatePm25Average24h();
onValue(ref(db,aeroCubePath+'/history'),()=>{
updatePm25Average24h();
});