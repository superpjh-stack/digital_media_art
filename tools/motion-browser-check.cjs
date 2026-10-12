const {spawn}=require('child_process');const fs=require('fs');
const child=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--disable-gpu','--no-first-run','--user-data-dir=/tmp/forest-motion-review','--remote-debugging-pipe'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let id=0,buffer='',session;const pending=new Map();const errors=[];child.stdio[4].on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\0'))>=0){const msg=JSON.parse(buffer.slice(0,i));buffer=buffer.slice(i+1);if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);if(pending.has(msg.id)){pending.get(msg.id)(msg);pending.delete(msg.id);}}});
const send=(method,params={},sid=session)=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,m=>m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result));child.stdio[3].write(JSON.stringify({id:n,method,params,...(sid?{sessionId:sid}:{})})+'\0');});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const results=[];
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const check=async(name,expr)=>{const result=await evaluate(expr);results.push({name,result});if(!result)throw Error(name);};
const click=async selector=>{const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});};
const screenshot=async name=>{const shot=await send('Page.captureScreenshot');fs.writeFileSync('evidence/'+name+'.png',Buffer.from(shot.data,'base64'));};
(async()=>{
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});session=(await send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Emulation.setFocusEmulationEnabled',{enabled:true});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.rings=0;const ellipse=CanvasRenderingContext2D.prototype.ellipse;CanvasRenderingContext2D.prototype.ellipse=function(...a){window.rings++;return ellipse.apply(this,a);};`});
 await send('Page.navigate',{url:process.env.FOREST_TEST_URL||'http://127.0.0.1:8766/'});await sleep(1000);await evaluate(`Promise.all([...document.images].map(i=>i.decode()))`);
 await click('.deer');await click('.rabbit');await sleep(650);
 await check('both animals take steps',`[...document.querySelectorAll('.creature')].every(e=>e.dataset.walking==='true'&&parseFloat(e.style.transform.slice(10))>0)`);
 await screenshot('motion-two-steps');await sleep(2700);
 await check('animals rest at their new positions',`[...document.querySelectorAll('.creature')].every(e=>e.dataset.walking==='false'&&parseFloat(e.style.transform.slice(10))>0)`);
 await click('.deer');await sleep(3200);
 await check('next two steps return deer without drifting',`Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.deer')).transform).m41)<.1`);
 await evaluate('window.rings=0');await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:500,y:720});await sleep(300);
 await check('hover water generates rings without click','window.rings>0');await screenshot('motion-water-hover');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:500,y:200});await sleep(2600);await evaluate('window.rings=0');await sleep(200);
 await check('water settles after pointer leaves','window.rings===0');
 await click('#motion-toggle');await sleep(100);await evaluate('window.rings=0');await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:600,y:725});await sleep(300);
 await check('reduced motion stops steps and ripples',`window.rings===0&&[...document.querySelectorAll('.creature')].every(e=>e.dataset.walking==='false'&&Math.abs(new DOMMatrix(getComputedStyle(e).transform).m41)<.1)`);
 await click('#motion-toggle');
 for(const [width,height] of [[390,844],[1280,720]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(150);await click('.deer');await click('.rabbit');await sleep(800);
  await check('walking animals remain in bounds '+width,`[...document.querySelectorAll('.creature')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})`);
  await screenshot('motion-layout-'+width);
 }
 if(errors.length)throw Error(JSON.stringify(errors));results.push({name:'runtime errors',result:errors});fs.writeFileSync('evidence/motion-browser-checks.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>child.kill());
