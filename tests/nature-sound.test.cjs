const {test}=require('node:test');const assert=require('node:assert/strict');
const {spatialMix,ForestAmbience}=require('../nature-sound.js');
test('water is louder by the pond and birds by the trees; values stay bounded',()=>{
 assert.ok(spatialMix(.47,.84).water>spatialMix(.47,.2).water*3);
 assert.ok(spatialMix(.73,.36).birds>spatialMix(.73,.95).birds*3);
 assert.ok(spatialMix(.2,.2).wind>spatialMix(.2,.95).wind);
 for(const [x,y]of [[-2,3],[NaN,Infinity],[0,0],[1,1]])for(const [key,value]of Object.entries(spatialMix(x,y))){assert.ok(Number.isFinite(value));assert.ok(value>= (key.endsWith('Pan')?-1:0)&&value<=1);}
 assert.ok(spatialMix(0,.5).birdPan>spatialMix(1,.5).birdPan);
});
const param=()=>({value:0,setValueAtTime(v){this.value=v},exponentialRampToValueAtTime(v){this.value=v},setTargetAtTime(v){this.value=v}});
class Node {constructor(){this.gain=param();this.pan=param();this.frequency=param();this.Q=param();this.stopped=false;}connect(){}disconnect(){}start(){}stop(){this.stopped=true}}
function context(){return {sampleRate:100,currentTime:0,createGain:()=>new Node(),createStereoPanner:()=>new Node(),createBufferSource:()=>new Node(),createBiquadFilter:()=>new Node(),createOscillator:()=>new Node(),createBuffer:(n,size)=>({getChannelData:()=>new Float32Array(size)})};}
test('ambient sources stop together and disposed engine cannot schedule birds',()=>{
 const c=context(),a=new ForestAmbience(c,new Node());assert.equal(a.nodes.size,2);
 c.currentTime=2.1;a.schedule();assert.equal(a.nodes.size,5);const nodes=[...a.nodes];
 a.stop();a.stop();assert.ok(nodes.every(n=>n.stopped));assert.equal(a.nodes.size,0);c.currentTime=100;a.schedule();assert.equal(a.nodes.size,0);
});
