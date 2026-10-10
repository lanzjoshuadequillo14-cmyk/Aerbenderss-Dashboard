import{db,auth,BASE_PATH}from'./firebase.js';
import{ref,get,remove}from"https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
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
console.error('Logout error:',err);
}
});
const menuToggle=document.getElementById('menuToggle');
const sidebar=document.getElementById('sidebar');
const overlay=document.getElementById('sidebarOverlay');
const aeroCubePath='/Aerocubes/'+(localStorage.getItem('aerocube-id')||BASE_PATH.split('/').pop());
menuToggle?.addEventListener('click',()=>{
sidebar.classList.toggle('open');
overlay.classList.toggle('active');
});
overlay?.addEventListener('click',()=>{
sidebar.classList.remove('open');
overlay.classList.remove('active');
});
const METRIC_CONFIG={
co2:{
label:'CO₂ (ppm)',
color:'#10b981',
path:'co2',
unit:' ppm',
zones:[
{name:'Normal',min:0,max:1000,color:'#22c55e'},
{name:'Elevated',min:1000,max:1500,color:'#eab308'},
{name:'High',min:1500,max:Infinity,color:'#ef4444'}
]
},
voc:{
label:'VOC Index',
color:'#f59e0b',
path:'VOCidx',
unit:'',
zones:[
{name:'Normal',min:0,max:150,color:'#22c55e'},
{name:'Elevated',min:150,max:250,color:'#eab308'},
{name:'High',min:250,max:Infinity,color:'#ef4444'}
]
},
pm25:{
label:'PM2.5 (µg/m³)',
color:'#38bdf8',
path:'pm.pm2p5',
unit:' µg/m³',
zones:[
{name:'Good',min:0,max:15,color:'#22c55e'},
{name:'Elevated',min:15,max:25,color:'#eab308'},
{name:'High',min:25,max:Infinity,color:'#ef4444'}
]
},
temp:{
label:'Temperature (°C)',
color:'#38bdf8',
path:'temp',
unit:' °C',
zones:[
{name:'Cold',min:-50,max:18,color:'#60a5fa'},
{name:'Comfortable',min:18,max:26,color:'#22c55e'},
{name:'Warm',min:26,max:30,color:'#f97316'},
{name:'Hot',min:30,max:Infinity,color:'#ef4444'}
]
},
humidity:{
label:'Humidity (%)',
color:'#a855f7',
path:'humidity',
unit:' %',
zones:[
{name:'Dry',min:0,max:30,color:'#f97316'},
{name:'Comfortable',min:30,max:60,color:'#22c55e'},
{name:'Humid',min:60,max:70,color:'#eab308'},
{name:'Very humid',min:70,max:Infinity,color:'#ef4444'}
]
}
};
METRIC_CONFIG.co2.desc='Carbon dioxide concentration measured in ppm. Higher values may indicate insufficient ventilation.';
METRIC_CONFIG.voc.desc='VOC Index shows changes in volatile organic compounds compared with the sensor baseline.';
METRIC_CONFIG.pm25.desc='Fine particulate matter concentration measured in µg/m³. Graph points show individual PM2.5 sensor readings.';
METRIC_CONFIG.temp.desc='Room temperature measured in degrees Celsius.';
METRIC_CONFIG.humidity.desc='Relative humidity measures the amount of moisture in the air.';
const RANGE_TITLES={
'24h':'Time — last 24 hours',
'7d':'Date — last 7 days',
'month':'Date — last month'
};
const HOUR_MS=60*60*1000;
const DAY_MS=24*HOUR_MS;
const GAP_FACTOR=3;
const MIN_GAP_MS=10*60*1000;
let currentTimeRange='24h';
let allHistoryData=[];
let gapThresholdMs=MIN_GAP_MS;
const chartInstances={};
function getZone(config,value){
return config.zones.find(zone=>value>=zone.min&&value<zone.max)||null;
}
function zoneGradient(chart,config,alpha){
if(!config.zones.length)return config.color+(alpha||'');
const{ctx,chartArea,scales}=chart;
if(!chartArea||!scales.y)return config.color;
const y=scales.y;
const span=y.max-y.min;
if(!(span>0))return config.color;
const frac=value=>Math.min(1,Math.max(0,(value-y.min)/span));
const gradient=ctx.createLinearGradient(0,chartArea.bottom,0,chartArea.top);
config.zones.forEach(zone=>{
const start=frac(Math.max(zone.min,y.min));
const end=frac(Math.min(zone.max,y.max));
if(end<=start)return;
const color=zone.color+(alpha||'');
gradient.addColorStop(start,color);
gradient.addColorStop(end,color);
});
return gradient;
}
function getTimestampFromPushId(pushId){
const PUSH_CHARS='-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
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
function getValueByPath(obj,path){
const parts=path.split('.');
let current=obj;
for(const part of parts){
if(current===null||current===undefined)return undefined;
current=current[part];
}
return current;
}
function getMetricValue(item,config){
const raw=getValueByPath(item,config.path);
if(raw===undefined||raw===null||raw==='')return null;
const value=parseFloat(raw);
return Number.isFinite(value)?value:null;
}
function getTimeWindow(range){
const end=Date.now();
let start;
if(range==='24h'){
start=end-DAY_MS;
}else if(range==='7d'){
start=end-7*DAY_MS;
}else if(range==='month'){
const date=new Date(end);
date.setMonth(date.getMonth()-1);
start=date.getTime();
}else{
start=allHistoryData.length?allHistoryData[0].timestamp:end-DAY_MS;
}
return{start,end};
}
function filterByTimeRange(data,range){
const{start,end}=getTimeWindow(range);
return data.filter(item=>item.timestamp>0&&item.timestamp>=start&&item.timestamp<=end);
}
function computeGapThreshold(entries){
const intervals=[];
for(let i=1;i<entries.length;i++){
const difference=entries[i].timestamp-entries[i-1].timestamp;
if(difference>0)intervals.push(difference);
}
if(intervals.length===0)return MIN_GAP_MS;
intervals.sort((a,b)=>a-b);
const median=intervals[Math.floor(intervals.length/2)];
return Math.max(median*GAP_FACTOR,MIN_GAP_MS);
}
function buildSeries(filtered,config,windowRange){
const points=[];
const gaps=[];
let previousTimestamp=null;
if(filtered.length&&filtered[0].timestamp-windowRange.start>gapThresholdMs){
gaps.push({
from:windowRange.start,
to:filtered[0].timestamp
});
}
for(const item of filtered){
if(previousTimestamp!==null&&item.timestamp-previousTimestamp>gapThresholdMs){
points.push({
x:previousTimestamp+(item.timestamp-previousTimestamp)/2,
y:null
});
gaps.push({
from:previousTimestamp,
to:item.timestamp
});
}
points.push({
x:item.timestamp,
y:getMetricValue(item,config)
});
previousTimestamp=item.timestamp;
}
if(previousTimestamp!==null&&windowRange.end-previousTimestamp>gapThresholdMs){
gaps.push({
from:previousTimestamp,
to:windowRange.end
});
}
return{points,gaps};
}
document.getElementById('btn-clear-history')?.addEventListener('click',async()=>{
const confirmed=window.confirm('Clear all history for this AeroCube? This cannot be undone.');
if(!confirmed)return;
try{
await remove(ref(db,aeroCubePath+'/history'));
allHistoryData=[];
renderAllCharts();
}catch(error){
console.error('Error clearing history:',error);
window.alert('Unable to clear history. Please try again.');
}
});
const zonesAndGapsPlugin={
id:'zonesAndGaps',
beforeDatasetsDraw(chart){
const meta=chart.$meta;
if(!meta)return;
const{ctx,chartArea,scales}=chart;
const x=scales.x;
const y=scales.y;
ctx.save();
ctx.beginPath();
ctx.rect(chartArea.left,chartArea.top,chartArea.width,chartArea.height);
ctx.clip();
ctx.font='600 10px sans-serif';
ctx.textAlign='right';
ctx.textBaseline='top';
for(const zone of meta.zones){
const top=y.getPixelForValue(Math.min(zone.max,y.max));
const bottom=y.getPixelForValue(Math.max(zone.min,y.min));
if(!(bottom>top))continue;
ctx.fillStyle=zone.color+'14';
ctx.fillRect(chartArea.left,top,chartArea.width,bottom-top);
if(bottom-top>16){
ctx.fillStyle=zone.color+'b3';
ctx.fillText(zone.name,chartArea.right-6,top+4);
}
}
for(const gap of meta.gaps){
const left=Math.max(x.getPixelForValue(gap.from),chartArea.left);
const right=Math.min(x.getPixelForValue(gap.to),chartArea.right);
const width=Math.max(right-left,2);
ctx.fillStyle='rgba(148,163,184,0.12)';
ctx.fillRect(left,chartArea.top,width,chartArea.height);
ctx.strokeStyle='rgba(148,163,184,0.35)';
ctx.setLineDash([4,4]);
ctx.strokeRect(left,chartArea.top,width,chartArea.height);
ctx.setLineDash([]);
if(width>64){
ctx.fillStyle='rgba(148,163,184,0.9)';
ctx.textAlign='center';
ctx.textBaseline='middle';
ctx.fillText('No data',left+width/2,chartArea.top+chartArea.height/2);
ctx.textAlign='right';
ctx.textBaseline='top';
}
}
ctx.restore();
},
afterDatasetsDraw(chart){
const meta=chart.$meta||{};
const{ctx,chartArea,scales}=chart;
const mark=(point,above)=>{
if(!point)return;
const px=scales.x.getPixelForValue(point.x);
const py=scales.y.getPixelForValue(point.y);
if(px<chartArea.left||px>chartArea.right)return;
ctx.save();
ctx.beginPath();
ctx.arc(px,py,5,0,Math.PI*2);
ctx.fillStyle='#ffffff';
ctx.fill();
ctx.lineWidth=2;
ctx.strokeStyle=point.ring;
ctx.stroke();
ctx.font='600 11px sans-serif';
ctx.textBaseline='middle';
const width=ctx.measureText(point.label).width+12;
const boxX=Math.min(Math.max(px-width/2,chartArea.left),chartArea.right-width);
let boxY=above?py-22:py+22;
boxY=Math.min(Math.max(boxY,chartArea.top+9),chartArea.bottom-9);
ctx.fillStyle='rgba(19,26,39,0.92)';
ctx.fillRect(boxX,boxY-9,width,18);
ctx.fillStyle='#ffffff';
ctx.textAlign='left';
ctx.fillText(point.label,boxX+6,boxY);
ctx.restore();
};
mark(meta.peak,true);
mark(meta.latest,false);
}
};
const fmtNum=value=>Number(value).toLocaleString('en-US',{
maximumFractionDigits:1
});
function levelKey(config){
if(!config.zones.length)return'';
const unit=config.unit;
return config.zones.map((zone,index)=>{
let range;
if(index===0){
range='< '+fmtNum(zone.max)+unit;
}else if(!isFinite(zone.max)){
range=fmtNum(zone.min)+unit+'+';
}else{
range=fmtNum(zone.min)+'–'+fmtNum(zone.max)+unit;
}
return'<span><i style="background:'+zone.color+'"></i>'+zone.name+' '+range+'</span>';
}).join('');
}
function timeAgo(ms){
const minutes=Math.round((Date.now()-ms)/60000);
if(minutes<1)return'just now';
if(minutes<60)return minutes+' min ago';
if(minutes<1440)return Math.round(minutes/60)+' h ago';
return Math.round(minutes/1440)+' days ago';
}
function formatDateTime(timestamp){
return new Date(timestamp).toLocaleString('en-US',{
month:'numeric',
day:'numeric',
year:'numeric',
hour:'numeric',
minute:'2-digit',
second:'2-digit',
hour12:true
});
}
function formatTick(value){
const date=new Date(value);
if(currentTimeRange==='24h'){
return date.toLocaleTimeString('en-US',{
hour:'numeric',
minute:'2-digit',
hour12:true
});
}
if(currentTimeRange==='7d'){
return date.toLocaleDateString('en-US',{
weekday:'short',
day:'numeric'
});
}
return date.toLocaleDateString('en-US',{
month:'short',
day:'numeric'
});
}
function renderStats(metricKey,config,last,top){
const element=document.getElementById('stats-'+metricKey);
if(!element)return;
const getColor=value=>{
const zone=getZone(config,value);
return zone?zone.color:config.color;
};
element.innerHTML=
'<span>Latest: <b style="color:'+getColor(last.y)+'">'+
fmtNum(last.y)+config.unit+
'</b> · '+timeAgo(last.x)+'</span>'+
'<span>Peak: <b style="color:'+getColor(top.y)+'">'+
fmtNum(top.y)+config.unit+
'</b> · '+formatDateTime(top.x)+'</span>';
}
function renderDescription(metricKey,config){
const canvas=document.getElementById('chart-'+metricKey);
if(!canvas||document.getElementById('desc-'+metricKey))return;
if(!document.getElementById('chart-desc-style')){
const style=document.createElement('style');
style.id='chart-desc-style';
style.textContent=
'.chart-desc{margin:0 0 10px;font-size:12px;line-height:1.5;color:#94a3b8}'+
'.chart-desc-stats{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:8px;font-size:12px}'+
'.chart-desc-stats b{font-weight:700}'+
'.chart-desc-key{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:6px;font-size:11px}'+
'.chart-desc-key i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px}';
document.head.appendChild(style);
}
const box=document.createElement('div');
box.id='desc-'+metricKey;
box.className='chart-desc';
box.innerHTML=
config.desc+
'<div class="chart-desc-stats" id="stats-'+metricKey+'"></div>'+
'<div class="chart-desc-key">'+levelKey(config)+'</div>';
(canvas.closest('.chart-wrapper')||canvas.parentElement).insertAdjacentElement('beforebegin',box);
}
function buildTicks(min,max){
const ticks=[];
if(currentTimeRange==='24h'){
const step=4*HOUR_MS;
for(let time=Math.ceil(min/HOUR_MS)*HOUR_MS;time<=max;time+=step){
ticks.push({value:time});
}
}else{
const stepDays=currentTimeRange==='month'?5:1;
const date=new Date(min);
date.setHours(24,0,0,0);
while(date.getTime()<=max){
ticks.push({value:date.getTime()});
date.setDate(date.getDate()+stepDays);
}
}
return ticks;
}
function makePointRadius(count){
return context=>{
if(count<=50)return 3;
const data=context.dataset.data;
const index=context.dataIndex;
const previousMissing=!data[index-1]||data[index-1].y===null;
const nextMissing=!data[index+1]||data[index+1].y===null;
return previousMissing&&nextMissing?3:0;
};
}
function renderMetricSummary(metricKey,filteredData){
const config=METRIC_CONFIG[metricKey];
const values=filteredData.map(item=>({
value:getMetricValue(item,config),
timestamp:item.timestamp
})).filter(item=>item.value!==null);
const averageElement=document.getElementById('average-'+metricKey);
const highestElement=document.getElementById('highest-'+metricKey);
const lowestElement=document.getElementById('lowest-'+metricKey);
if(!averageElement||!highestElement||!lowestElement)return;
if(values.length===0){
averageElement.innerText='--';
highestElement.innerText='--';
lowestElement.innerText='--';
return;
}
const average=values.reduce((sum,item)=>sum+item.value,0)/values.length;
const highest=values.reduce((result,item)=>item.value>result.value?item:result);
const lowest=values.reduce((result,item)=>item.value<result.value?item:result);
const unit=config.unit;
averageElement.innerText=average.toFixed(1)+unit;
highestElement.innerText=highest.value+unit+' · '+formatDateTime(highest.timestamp);
lowestElement.innerText=lowest.value+unit+' · '+formatDateTime(lowest.timestamp);
}
async function loadHistoryData(){
try{
const snapshot=await get(ref(db,aeroCubePath+'/history'));
if(!snapshot.exists()){
allHistoryData=[];
renderAllCharts();
return;
}
const historyObj=snapshot.val();
const entries=[];
for(const key in historyObj){
const log=historyObj[key];
let timestamp=normalizeTimestamp(log.timestamp||log.time||log.created_at);
if(!timestamp&&key.startsWith('-')){
timestamp=getTimestampFromPushId(key);
}
if(!timestamp)continue;
entries.push({
...log,
timestamp
});
}
entries.sort((a,b)=>a.timestamp-b.timestamp);
allHistoryData=entries;
gapThresholdMs=computeGapThreshold(entries);
renderAllCharts();
}catch(err){
console.error('Error loading history:',err);
allHistoryData=[];
renderAllCharts();
}
}
function renderChart(metricKey,filtered,windowRange){
const config=METRIC_CONFIG[metricKey];
const canvas=document.getElementById('chart-'+metricKey);
const emptyState=document.getElementById('empty-'+metricKey);
if(!canvas||!emptyState)return;
renderDescription(metricKey,config);
const showEmpty=()=>{
const stats=document.getElementById('stats-'+metricKey);
if(stats)stats.innerHTML='';
canvas.style.display='none';
emptyState.style.display='flex';
if(window.lucide)lucide.createIcons();
};
if(filtered.length===0){
showEmpty();
return;
}
const{points,gaps}=buildSeries(filtered,config,windowRange);
const realValues=points.filter(point=>point.y!==null).map(point=>point.y);
if(realValues.length===0){
showEmpty();
return;
}
canvas.style.display='block';
emptyState.style.display='none';
const realPoints=points.filter(point=>point.y!==null);
const lastPoint=realPoints[realPoints.length-1];
const topPoint=realPoints.reduce((a,b)=>b.y>a.y?b:a);
const lastZone=getZone(config,lastPoint.y);
const samePoint=lastPoint.x===topPoint.x;
const latestColor=lastZone?lastZone.color:config.color;
const peak={
x:topPoint.x,
y:topPoint.y,
ring:samePoint?latestColor:'#ef4444',
label:(samePoint?'Latest & peak ':'Peak ')+fmtNum(topPoint.y)+config.unit
};
const latest=samePoint?null:{
x:lastPoint.x,
y:lastPoint.y,
ring:latestColor,
label:'Latest '+fmtNum(lastPoint.y)+config.unit
};
renderStats(metricKey,config,lastPoint,topPoint);
const average=realValues.reduce((sum,value)=>sum+value,0)/realValues.length;
const averagePoints=[
{x:windowRange.start,y:average},
{x:windowRange.end,y:average}
];
const xTitle=RANGE_TITLES[currentTimeRange]+' · grey area = no sensor data';
const ctx=canvas.getContext('2d');
const pointRadius=makePointRadius(filtered.length);
if(chartInstances[metricKey]){
const chart=chartInstances[metricKey];
chart.$meta={
zones:config.zones,
gaps,
peak,
latest
};
chart.data.datasets[0].data=points;
chart.data.datasets[0].pointRadius=pointRadius;
chart.data.datasets[1].data=averagePoints;
chart.data.datasets[1].label='Average: '+average.toFixed(1)+config.unit;
chart.options.scales.x.min=windowRange.start;
chart.options.scales.x.max=windowRange.end;
chart.options.scales.x.title.text=xTitle;
chart.update('none');
return;
}
const chart=new Chart(ctx,{
type:'line',
plugins:[zonesAndGapsPlugin],
data:{
datasets:[
{
label:config.label,
data:points,
borderColor:context=>zoneGradient(context.chart,config,''),
backgroundColor:context=>zoneGradient(context.chart,config,'33'),
borderWidth:2,
tension:0.35,
fill:true,
spanGaps:false,
pointRadius,
pointHoverRadius:6,
pointBackgroundColor:context=>{
const value=context.parsed&&context.parsed.y;
const zone=value===null||value===undefined?null:getZone(config,value);
return zone?zone.color:config.color;
},
pointBorderColor:context=>{
const value=context.parsed&&context.parsed.y;
const zone=value===null||value===undefined?null:getZone(config,value);
return zone?zone.color:config.color;
}
},
{
label:'Average: '+average.toFixed(1)+config.unit,
data:averagePoints,
borderColor:'#94a3b8',
borderWidth:1.5,
borderDash:[6,4],
pointRadius:0,
pointHoverRadius:0,
fill:false
}
]
},
options:{
responsive:true,
maintainAspectRatio:false,
interaction:{
mode:'nearest',
axis:'x',
intersect:false
},
plugins:{
legend:{
display:true,
position:'top',
align:'end',
labels:{
color:'#94a3b8',
boxWidth:14,
boxHeight:2,
font:{
size:11
},
filter:item=>item.datasetIndex===1
}
},
tooltip:{
backgroundColor:'#131a27',
borderColor:'#1e293b',
borderWidth:1,
titleColor:'#94a3b8',
bodyColor:'#ffffff',
padding:12,
cornerRadius:8,
filter:item=>item.datasetIndex===0&&item.parsed.y!==null,
callbacks:{
title:items=>items.length?formatDateTime(items[0].parsed.x):'',
labelColor:item=>{
const zone=getZone(config,item.parsed.y);
const color=zone?zone.color:config.color;
return{
borderColor:color,
backgroundColor:color
};
},
label:item=>{
const zone=getZone(config,item.parsed.y);
return item.parsed.y.toFixed(1)+config.unit+(zone?' · '+zone.name:'');
}
}
}
},
scales:{
x:{
type:'linear',
min:windowRange.start,
max:windowRange.end,
bounds:'ticks',
afterBuildTicks:scale=>{
scale.ticks=buildTicks(scale.min,scale.max);
},
title:{
display:true,
text:xTitle,
color:'#64748b',
font:{
size:11
},
padding:{
top:8
}
},
ticks:{
color:'#94a3b8',
autoSkip:true,
maxRotation:0,
minRotation:0,
font:{
size:11
},
callback:value=>formatTick(value)
},
grid:{
color:'rgba(255,255,255,0.04)'
}
},
y:{
beginAtZero:true,
title:{
display:true,
text:config.label,
color:'#94a3b8',
font:{
size:11
}
},
ticks:{
color:'#94a3b8',
font:{
size:11
}
},
grid:{
color:'rgba(255,255,255,0.06)'
}
}
}
}
});
chart.$meta={
zones:config.zones,
gaps,
peak,
latest
};
chartInstances[metricKey]=chart;
}
function renderAllCharts(){
const windowRange=getTimeWindow(currentTimeRange);
const filtered=filterByTimeRange(allHistoryData,currentTimeRange);
['co2','voc','pm25'].forEach(metricKey=>{
renderMetricSummary(metricKey,filtered);
});
Object.keys(METRIC_CONFIG).forEach(metricKey=>{
renderChart(metricKey,filtered,windowRange);
});
if(window.lucide)lucide.createIcons();
}
document.querySelectorAll('[data-range]').forEach(btn=>{
btn.addEventListener('click',()=>{
document.querySelectorAll('[data-range]').forEach(button=>{
button.classList.remove('active');
});
btn.classList.add('active');
currentTimeRange=btn.dataset.range;
renderAllCharts();
});
});
loadHistoryData();