import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const PROJECT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = new Set(['index.html','styles.css','script.js','night.js','voice-session.js','voice.js','music.js',
  'assets/night-forest.png','assets/moon-deer.png','assets/moon-rabbit.png','assets/ember-flowers.png','assets/forest.svg']);
const MIME = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml' };
const ANIMALS = {
  deer: { voice:'cedar', persona:'당신은 달빛 숲에 사는 사슴입니다. 차분하고 다정한 숲 안내자처럼 느긋하게 말하세요.' },
  rabbit: { voice:'marin', persona:'당신은 달빛 숲에 사는 토끼입니다. 밝고 호기심 많은 친구처럼 자연스럽게 말하세요.' },
};
function reply(res, status, data) {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8' });res.end(JSON.stringify(data));
}
async function bodyJSON(req) {
  let text='', bytes=0;
  for await (const chunk of req) {
    bytes+=Buffer.byteLength(chunk);
    if(bytes>65536) throw Object.assign(new Error('요청이 너무 큽니다.'),{status:413});
    text+=chunk;
  }
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('올바른 JSON 요청이 필요합니다.'),{status:400}); }
}
export function createHandler({apiKey='',model='gpt-realtime-2.1',fetchImpl=fetch,timeoutMs=20000,maxPending=2,rootDir=PROJECT}={}) {
  let pending=0;
  let recent=[];
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Permissions-Policy','microphone=(self)');
    const host=req.headers.host||'';
    if(!/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(host)) return reply(res,403,{error:'로컬 주소로 접속해 주세요.'});
    const origin=`http://${host}`;
    let url;
    try { url=new URL(req.url,origin); } catch { return reply(res,400,{error:'잘못된 주소입니다.'}); }
    if(url.pathname==='/api/config' && req.method==='GET') return reply(res,200,{voiceAvailable:Boolean(apiKey)});
    if(url.pathname==='/api/session' && req.method==='POST') {
      if(req.headers.origin!==origin) return reply(res,403,{error:'같은 작품 화면에서 연결해 주세요.'});
      if(!apiKey) return reply(res,503,{error:'서버에 OPENAI_API_KEY를 설정한 뒤 다시 시작해 주세요.'});
      if(!(req.headers['content-type']||'').startsWith('application/json')) return reply(res,415,{error:'JSON 요청이 필요합니다.'});
      let input;
      try { input=await bodyJSON(req); } catch(error) { return reply(res,error.status||400,{error:error.message}); }
      if(!input || typeof input.animal!=='string' || !Object.hasOwn(ANIMALS,input.animal) || typeof input.sdp!=='string' || !/^v=0\r?\n/.test(input.sdp) || !input.sdp.includes('m=audio ')) {
        return reply(res,400,{error:'대화 상대와 마이크 연결 정보를 확인해 주세요.'});
      }
      recent=recent.filter(t=>Date.now()-t<60000);
      if(pending>=maxPending || recent.length>=10) return reply(res,429,{error:'연결 요청이 많습니다. 잠시 뒤 다시 시작해 주세요.'});
      recent.push(Date.now());pending++;
      const abort=new AbortController();let timedOut=false;
      const timer=setTimeout(()=>{timedOut=true;abort.abort();},timeoutMs);
      const disconnected=()=>{if(!res.writableEnded)abort.abort();};
      req.once('aborted',disconnected);res.once('close',disconnected);
      try {
        const animal=ANIMALS[input.animal];
        const session={type:'realtime',model,output_modalities:['audio'],max_output_tokens:300,
          instructions:`${animal.persona} 기본 언어는 한국어입니다. 관객과 1~3문장씩 짧게 대화하고 질문을 한 번에 하나만 하세요. 실제 동물이 아닌 미디어아트 속 AI 캐릭터입니다. 보거나 듣지 못한 것을 관찰했다고 말하지 마세요. 개인정보를 요청하지 마세요.`,
          audio:{input:{noise_reduction:{type:'near_field'},turn_detection:{type:'semantic_vad',eagerness:'medium',create_response:true,interrupt_response:true}},output:{voice:animal.voice}},
        };
        const form=new FormData();form.set('sdp',input.sdp);form.set('session',JSON.stringify(session));
        const upstream=await fetchImpl('https://api.openai.com/v1/realtime/calls',{
          method:'POST',headers:{Authorization:`Bearer ${apiKey}`},body:form,signal:abort.signal,
        });
        if(!upstream.ok) {
          await upstream.body?.cancel();
          return reply(res,502,{error:upstream.status===429?'음성 서비스 사용 한도에 도달했습니다. 잠시 뒤 다시 시도해 주세요.':'음성 서비스에 연결하지 못했습니다. API 키와 모델 사용 권한을 확인해 주세요.'});
        }
        const sdp=await upstream.text();
        if(!/^v=0\r?\n/.test(sdp)) return reply(res,502,{error:'음성 서비스의 연결 응답이 올바르지 않습니다.'});
        reply(res,200,{sdp});
      } catch {
        reply(res,timedOut?504:502,{error:timedOut?'음성 연결 시간이 초과되었습니다. 다시 시작해 주세요.':'음성 연결이 끊겼습니다. 인터넷 연결을 확인해 주세요.'});
      } finally { clearTimeout(timer);req.off('aborted',disconnected);res.off('close',disconnected);pending--; }
      return;
    }
    if(req.method!=='GET' && req.method!=='HEAD') return reply(res,405,{error:'지원하지 않는 요청입니다.'});
    let name;
    try { name=decodeURIComponent(url.pathname).slice(1)||'index.html'; } catch { return reply(res,404,{error:'파일을 찾을 수 없습니다.'}); }
    if(!PUBLIC.has(name)) return reply(res,404,{error:'파일을 찾을 수 없습니다.'});
    try {
      const location=await realpath(path.join(rootDir,name));
      const base=await realpath(rootDir);
      if(!location.startsWith(base+path.sep)) return reply(res,404,{error:'파일을 찾을 수 없습니다.'});
      const data=await readFile(location);
      res.writeHead(200,{'Content-Type':MIME[path.extname(name)]||'application/octet-stream','Content-Length':data.length});
      res.end(req.method==='HEAD'?undefined:data);
    } catch { reply(res,404,{error:'파일을 찾을 수 없습니다.'}); }
  };
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  if(existsSync(path.join(PROJECT,'.env'))) process.loadEnvFile(path.join(PROJECT,'.env'));
  const port=Number(process.env.PORT||8766);
  if(!Number.isInteger(port)||port<1||port>65535) throw new Error('PORT must be 1–65535');
  const apiKey=process.env.OPENAI_API_KEY?.trim()||'';
  const server=http.createServer(createHandler({apiKey,model:process.env.OPENAI_REALTIME_MODEL||'gpt-realtime-2.1'}));
  server.requestTimeout=30000;server.headersTimeout=10000;
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'포트를 사용 중입니다. PORT를 바꿔 실행해 주세요.':`서버 실행 실패: ${error.code}`);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`작품: http://127.0.0.1:${port}\n음성 API 키: ${apiKey?'설정됨':'미설정 — 음악과 작품 감상은 사용 가능'}`));
}
