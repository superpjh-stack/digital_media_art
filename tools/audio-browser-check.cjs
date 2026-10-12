const {spawn}=require('child_process');const fs=require('fs');
const child=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--disable-gpu','--no-first-run','--user-data-dir=/tmp/forest-audio-review','--remote-debugging-pipe'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let id=0,buffer='',session;const pending=new Map();const errors=[];child.stdio[4].on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\0'))>=0){const msg=JSON.parse(buffer.slice(0,i));buffer=buffer.slice(i+1);if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);if(pending.has(msg.id)){pending.get(msg.id)(msg);pending.delete(msg.id);}}});
const send=(method,params={},sid=session)=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,m=>m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result));child.stdio[3].write(JSON.stringify({id:n,method,params,...(sid?{sessionId:sid}:{})})+'\0');});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const results=[];
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const check=async(name,expr)=>{const result=await evaluate(expr);results.push({name,result});if(!result)throw Error(name);};
const click=async selector=>{const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});};
const screenshot=async name=>{const shot=await send('Page.captureScreenshot');fs.writeFileSync('evidence/'+name+'.png',Buffer.from(shot.data,'base64'));};
(async()=>{
 results.push(await send('Browser.getVersion'));
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});session=(await send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Emulation.setFocusEmulationEnabled',{enabled:true});
 await send('Page.navigate',{url:'http://127.0.0.1:8766'});await sleep(700);await evaluate(`Promise.all([...document.images].map(i=>i.decode()))`);
 for(const [width,height]of [[1280,720],[1366,768],[1440,900],[1920,1080],[390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(120);
  await check('sound controls bounds '+width,`[...document.querySelectorAll('.sound-controls button,.controls button,#music-volume,.artist-credit')].every(e=>{const r=e.getBoundingClientRect();return r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})`);
  await screenshot('audio-forest-'+width+'x'+height);
  await click('#voice-toggle');await sleep(100);
  await check('voice panel bounds '+width,`(()=>{const r=document.querySelector('#voice-panel').getBoundingClientRect();const f=document.querySelector('.art-footer').getBoundingClientRect();return r.x>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=f.top+2})()`);
  await screenshot('audio-panel-'+width+'x'+height);await click('#voice-close');
 }
 await click('#voice-toggle');await click('#voice-start');await sleep(400);
 await check('missing key honest error',`forestVoice.state.phase==='error'&&document.querySelector('#voice-status').textContent.includes('API 키')&&!forestVoice.current`);
 await screenshot('audio-key-required');await click('#voice-close');
 await click('#music-toggle');await sleep(2400);
 await check('music actual context running',`forestMusic.playing&&forestMusic.context.state==='running'`);
 await check('music actual signal nonzero',`(async()=>{const a=forestMusic.context.createAnalyser();a.fftSize=2048;forestMusic.master.connect(a);await new Promise(r=>setTimeout(r,100));const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);forestMusic.master.disconnect(a);a.disconnect();return data.some(v=>Math.abs(v)>.0001)&&data.every(v=>Math.abs(v)<1)})()`);
 await evaluate(`document.querySelector('#music-volume').value=50;document.querySelector('#music-volume').dispatchEvent(new Event('input'))`);
 await check('music slider',`forestMusic.volume===.5`);
 // Mock transport only: no real API call or physical microphone. Real browser audio graph is exercised.
 await evaluate(`(()=>{
 window.mockAudio=new AudioContext();const out=mockAudio.createMediaStreamDestination();const osc=mockAudio.createOscillator();const gain=mockAudio.createGain();gain.gain.value=.08;osc.connect(gain);gain.connect(out);osc.start();mockAudio.resume();window.mockStream=out.stream;
 class Channel extends EventTarget{constructor(){super();this.readyState='open';this.sent=[];}send(s){this.sent.push(JSON.parse(s));}close(){this.readyState='closed';}message(data){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(data)}));}}
 class Peer extends EventTarget{constructor(){super();this.connectionState='new';this.channel=new Channel();}createDataChannel(){return this.channel;}addTrack(){}async createOffer(){return {type:'offer',sdp:'v=0\\r\\nm=audio 9'};}async setLocalDescription(){}async setRemoteDescription(){this.connectionState='connected';this.dispatchEvent(new Event('connectionstatechange'));this.channel.message({type:'session.created'});const e=new Event('track');e.streams=[mockStream];this.dispatchEvent(e);}close(){this.connectionState='closed';}}
 forestVoice.fetchImpl=async url=>({ok:true,json:async()=>url==='/api/config'?{voiceAvailable:true}:{sdp:'v=0\\r\\n'}});
 forestVoice.getUserMedia=async()=>{window.mockMic=mockStream.clone();return mockMic;};forestVoice.createPeer=()=>new Peer();
 })()`);
 await click('#voice-toggle');await click('#voice-start');await sleep(500);
 await check('mock call ready and music ducked',`forestVoice.state.phase==='listening'&&forestMusic.ducked&&forestMusic.effectiveVolume===.1`);
 await evaluate(`forestVoice.current.channel.message({type:'output_audio_buffer.started'});forestVoice.current.channel.message({type:'response.output_audio_transcript.delta',delta:'안녕하세요. 달빛 숲에 온 걸 환영해요.'})`);
 await sleep(200);await check('mock voice caption and visual amplitude',`document.querySelector('#voice-transcript').textContent.includes('달빛 숲')&&Number(document.querySelector('.deer').style.getPropertyValue('--voice-level'))>0`);
 await screenshot('audio-mock-speaking');
 await click('#voice-mute');await check('mock microphone mute',`forestVoice.state.muted&&mockMic.getAudioTracks().every(t=>!t.enabled)`);
 await click('#voice-stop');await check('mock stop tracks and music restoration',`!forestVoice.current&&mockMic.getTracks().every(t=>t.readyState==='ended')&&!forestMusic.ducked&&forestMusic.effectiveVolume===.5`);
 await evaluate(`window.originalPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('blocked','NotAllowedError'))}`);
 await click('#voice-start');await sleep(200);await check('blocked playback recovery shown',`!document.querySelector('#voice-play').hidden&&document.querySelector('#voice-status').textContent.includes('소리 재생')`);
 await evaluate(`HTMLMediaElement.prototype.play=originalPlay`);await click('#voice-play');await sleep(100);await check('playback recovery',`document.querySelector('#voice-play').hidden`);
 await evaluate(`Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))`);
 await check('hidden tab stops microphone and music',`!forestVoice.current&&mockMic.getTracks().every(t=>t.readyState==='ended')&&!forestMusic.playing`);
 await evaluate(`delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))`);
 await click('#voice-close');await check('music stopped',`!forestMusic.playing&&!forestMusic.context&&forestMusic.timer===null`);
 await evaluate(`mockStream.getTracks().forEach(t=>t.stop());mockAudio.close()`);
 await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await send('Page.navigate',{url:require('url').pathToFileURL(require('path').resolve('index.html')).href});await sleep(600);
 await click('#voice-toggle');await click('#voice-start');await check('file voice explains server',`document.querySelector('#voice-status').textContent.includes('8766')&&!forestVoice.current`);await click('#voice-close');await click('#music-toggle');await sleep(200);await check('offline music works',`forestMusic.playing`);await click('#music-toggle');
 results.push({name:'runtime errors',errors});if(errors.length)throw Error('runtime errors');
})().catch(e=>{results.push({error:e.message,errors});process.exitCode=1}).finally(async()=>{fs.writeFileSync('evidence/audio-browser-checks.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await send('Browser.close',{},undefined).catch(()=>{});child.kill();});
