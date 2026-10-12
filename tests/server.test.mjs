import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createHandler } from '../server.mjs';
const sdp = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';
async function request(handler, url, { method = 'GET', body, origin = 'http://127.0.0.1:8766', host = '127.0.0.1:8766' } = {}) {
  const req = Readable.from(body === undefined ? [] : [typeof body === 'string' ? body : JSON.stringify(body)]);
  Object.assign(req, { url, method, headers: { host, origin, 'content-type': 'application/json' } });
  const res = new EventEmitter();
  Object.assign(res, { headers: {}, statusCode: 200, writableEnded: false,
    setHeader(k,v) { this.headers[k.toLowerCase()] = v; },
    writeHead(status, headers = {}) { this.statusCode=status; Object.entries(headers).forEach(([k,v])=>this.setHeader(k,v)); },
    end(data='') { this.body=String(data);this.writableEnded=true; },
  });
  await handler(req,res);return res;
}
test('serves only public assets, no secrets or repository files', async()=>{
 const app=createHandler({apiKey:'secret-test'});
 assert.match((await request(app,'/')).body,/손끝/);
 for(const path of ['/.env','/server.mjs','/.git/config','/README.md','/assets/../.env','/%2e%2e/.env','/assets/GENERATED-ASSETS.md']) assert.equal((await request(app,path)).statusCode,404,path);
 assert.equal((await request(app,'/styles.css?v=1')).statusCode,200);
 assert.equal((await request(app,'/',{host:'evil.example'})).statusCode,403);
 const config=await request(app,'/api/config');assert.deepEqual(JSON.parse(config.body),{voiceAvailable:true});assert.ok(!config.body.includes('secret-test'));
});
test('missing key and invalid request do not contact upstream',async()=>{
 let calls=0;const app=createHandler({apiKey:'',fetchImpl:()=>{calls++;}});
 assert.deepEqual(JSON.parse((await request(app,'/api/config')).body),{voiceAvailable:false});
 assert.equal((await request(app,'/api/session',{method:'POST',body:{animal:'deer',sdp}})).statusCode,503);
 assert.equal(calls,0);
 const ready=createHandler({apiKey:'secret-test',fetchImpl:()=>{calls++;}});
 for(const body of [{animal:'wolf',sdp},{animal:{toString:null},sdp},{animal:'deer',sdp:'not sdp'},'{invalid']) assert.equal((await request(ready,'/api/session',{method:'POST',body})).statusCode,400);
 assert.equal((await request(ready,'/api/session',{method:'POST',body:{animal:'deer',sdp},origin:'http://evil.example'})).statusCode,403);
 assert.equal((await request(ready,'/api/session',{method:'POST',body:'x'.repeat(70000)})).statusCode,413);
 assert.equal(calls,0);
});
test('server owns model, voice and instructions; only SDP returned',async()=>{
 let options;const app=createHandler({apiKey:'secret-test',fetchImpl:async(url,init)=>{assert.equal(url,'https://api.openai.com/v1/realtime/calls');options=init;return new Response(sdp,{status:201});}});
 const r=await request(app,'/api/session',{method:'POST',body:{animal:'rabbit',sdp,model:'ignore'}});
 assert.equal(r.statusCode,200);assert.deepEqual(JSON.parse(r.body),{sdp});
 const session=JSON.parse(options.body.get('session'));
 assert.equal(session.audio.output.voice,'marin');assert.equal(session.model,'gpt-realtime-2.1');assert.match(session.instructions,/토끼/);
 assert.equal(options.headers.Authorization,'Bearer secret-test');assert.ok(!r.body.includes('secret-test'));
});
test('upstream failures are sanitized and timeout is bounded',async()=>{
 const app=createHandler({apiKey:'secret-test',fetchImpl:async()=>new Response('private upstream secret-test',{status:401})});
 const r=await request(app,'/api/session',{method:'POST',body:{animal:'deer',sdp}});assert.equal(r.statusCode,502);assert.ok(!r.body.includes('secret-test'));
 const slow=createHandler({apiKey:'secret-test',timeoutMs:10,fetchImpl:(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))});
 const keepAlive=setTimeout(()=>{},100);const timed=await request(slow,'/api/session',{method:'POST',body:{animal:'deer',sdp}});clearTimeout(keepAlive);assert.equal(timed.statusCode,504);
});
test('concurrent call setup limit is enforced and released',async()=>{
 let release;const app=createHandler({apiKey:'secret-test',maxPending:1,fetchImpl:()=>new Promise(r=>{release=()=>r(new Response(sdp,{status:201}));})});
 const first=request(app,'/api/session',{method:'POST',body:{animal:'deer',sdp}});await new Promise(r=>setImmediate(r));
 assert.equal((await request(app,'/api/session',{method:'POST',body:{animal:'deer',sdp}})).statusCode,429);release();assert.equal((await first).statusCode,200);
});

test('deployment permits only configured HTTPS host and same-origin sessions',async()=>{
 const app=createHandler({publicOrigin:'https://forest.example',apiKey:'test',fetchImpl:async()=>new Response(sdp,{status:201})});
 assert.equal((await request(app,'/',{host:'forest.example'})).statusCode,200);
 assert.equal((await request(app,'/',{host:'other.example'})).statusCode,403);
 for(const origin of ['http://forest.example','https://other.example']) assert.equal((await request(app,'/api/session',{host:'forest.example',origin,method:'POST',body:{animal:'deer',sdp}})).statusCode,403);
 assert.equal((await request(app,'/api/session',{host:'forest.example',origin:'https://forest.example',method:'POST',body:{animal:'deer',sdp}})).statusCode,200);
 assert.equal((await request(app,'/api/config')).statusCode,200);
 for(const publicOrigin of ['http://forest.example','https://forest.example/path','https://user:pass@forest.example']) assert.throws(()=>createHandler({publicOrigin}));
});
