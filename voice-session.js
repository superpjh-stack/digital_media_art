'use strict';
// Browser transport with injectable dependencies for race-condition tests.
(function(global) {
  class ForestVoiceSession {
    constructor({fetchImpl=(...args)=>fetch(...args),getUserMedia=()=>navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}}),createPeer=()=>new RTCPeerConnection(),onState=()=>{},onTranscript=()=>{},onStream=()=>{},onStop=()=>{},connectionTimeoutMs=30000,maxDurationMs=600000}={}) {
      Object.assign(this,{fetchImpl,getUserMedia,createPeer,onState,onTranscript,onStream,onStop,connectionTimeoutMs,maxDurationMs});
      this.current=null;this.state={phase:'idle',animal:'deer',muted:false,error:''};
    }
    update(change) { this.state={...this.state,...change};this.onState({...this.state}); }
    isCurrent(call) { return this.current===call; }
    stop(message='') {
      const call=this.current;this.current=null;
      if(call) {
        clearTimeout(call.timer);clearTimeout(call.deadline);call.abort.abort();
        call.stream?.getTracks().forEach(t=>t.stop());
        call.channel?.close();call.peer?.close();
        this.onStop();
      }
      this.update({phase:'idle',muted:false,error:message});
    }
    fail(call,message) { if(!this.isCurrent(call))return;this.stop();this.update({phase:'error',error:message}); }
    setMuted(muted) {
      if(!this.current?.ready)return;
      this.current.stream?.getAudioTracks().forEach(t=>{t.enabled=!muted;});
      if(muted && this.current.channel?.readyState==='open') this.current.channel.send(JSON.stringify({type:'input_audio_buffer.clear'}));
      this.update({muted:Boolean(muted)});
    }
    maybeReady(call) {
      if(!this.isCurrent(call)||call.ready||!call.sessionReady||call.channel?.readyState!=='open'||call.peer?.connectionState!=='connected')return;
      call.ready=true;clearTimeout(call.timer);
      call.deadline=setTimeout(()=>this.isCurrent(call)&&this.stop('10분 대화를 마쳤어요. 다시 시작할 수 있습니다.'),this.maxDurationMs);
      this.update({phase:'listening'});
      call.channel.send(JSON.stringify({type:'response.create',response:{instructions:`당신은 달빛 숲에 사는 ${this.state.animal==='deer'?'차분하고 다정한 사슴':'밝고 호기심 많은 토끼'} AI 캐릭터입니다. 한국어로 동물 이름을 소개하며 짧게 한 문장 인사하고 관객의 이야기를 기다려 주세요.`}}));
    }
    receive(call,event) {
      if(!this.isCurrent(call))return;
      switch(event.type) {
        case 'session.created':call.sessionReady=true;this.maybeReady(call);break;
        case 'input_audio_buffer.speech_started':call.playing=false;this.update({phase:'listening'});break;
        case 'input_audio_buffer.speech_stopped':this.update({phase:'responding'});break;
        case 'response.created':call.transcript='';this.onTranscript('');this.update({phase:'responding'});break;
        case 'response.output_audio_transcript.delta':
          call.transcript=(call.transcript+(event.delta||'')).slice(-1600);this.onTranscript(call.transcript);break;
        case 'response.output_audio_transcript.done':
          if(typeof event.transcript==='string')this.onTranscript(event.transcript.slice(-1600));break;
        case 'output_audio_buffer.started':call.playing=true;this.update({phase:'speaking'});break;
        case 'output_audio_buffer.stopped':
        case 'output_audio_buffer.cleared':call.playing=false;this.update({phase:'listening'});break;
        case 'response.done':
          if(event.response?.status==='failed')this.fail(call,'답변을 만들지 못했어요. 다시 연결해 주세요.');
          else if(!call.playing)this.update({phase:'listening'});
          break;
        case 'error':this.fail(call,'음성 서비스에 문제가 생겼어요. 대화를 다시 시작해 주세요.');break;
      }
    }
    async start(animal) {
      if(!['deer','rabbit'].includes(animal))return false;
      if(this.current && this.state.animal===animal)return false;
      this.stop();
      const call={abort:new AbortController(),ready:false,sessionReady:false,playing:false,transcript:''};
      this.current=call;this.update({phase:'connecting',animal,muted:false,error:''});this.onTranscript('');
      call.timer=setTimeout(()=>this.fail(call,'연결 시간이 초과됐어요. 마이크 권한과 인터넷 연결을 확인해 주세요.'),this.connectionTimeoutMs);
      try {
        const configResponse=await this.fetchImpl('api/config',{signal:call.abort.signal});
        if(!this.isCurrent(call))return false;
        if(!configResponse.ok)throw new Error('local-server');
        const config=await configResponse.json();
        if(!this.isCurrent(call))return false;
        if(!config.voiceAvailable){this.fail(call,'음성 연결 준비가 필요해요. 서버에 API 키를 설정한 뒤 다시 시작해 주세요.');return false;}
        const stream=await this.getUserMedia();
        if(!this.isCurrent(call)){stream.getTracks().forEach(t=>t.stop());return false;}
        call.stream=stream;call.peer=this.createPeer();
        const peer=call.peer;
        peer.addEventListener('track',event=>{
          if(this.isCurrent(call))this.onStream(event.streams?.[0]||new MediaStream([event.track]));
        });
        peer.addEventListener('connectionstatechange',()=>{
          if(!this.isCurrent(call))return;
          if(['failed','closed','disconnected'].includes(peer.connectionState))this.fail(call,'음성 연결이 끊겼어요. 다시 시작해 주세요.');
          else this.maybeReady(call);
        });
        stream.getTracks().forEach(track=>peer.addTrack(track,stream));
        const channel=peer.createDataChannel('oai-events');call.channel=channel;
        channel.addEventListener('open',()=>this.maybeReady(call));
        channel.addEventListener('close',()=>this.fail(call,'대화 연결이 종료됐어요. 다시 시작할 수 있습니다.'));
        channel.addEventListener('message',message=>{try{this.receive(call,JSON.parse(message.data));}catch{/* Ignore malformed/non-JSON transport data. */}});
        const offer=await peer.createOffer();if(!this.isCurrent(call))return false;
        await peer.setLocalDescription(offer);if(!this.isCurrent(call))return false;
        const response=await this.fetchImpl('api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({animal,sdp:offer.sdp}),signal:call.abort.signal});
        if(!this.isCurrent(call))return false;
        const result=await response.json();if(!this.isCurrent(call))return false;
        if(!response.ok){this.fail(call,result.error||'음성 연결에 실패했어요. 다시 시작해 주세요.');return false;}
        if(typeof result.sdp!=='string'||!result.sdp.startsWith('v=0'))throw new Error('invalid-answer');
        await peer.setRemoteDescription({type:'answer',sdp:result.sdp});
        return this.isCurrent(call);
      } catch(error) {
        if(!this.isCurrent(call))return false;
        let message='음성 서버에 연결하지 못했어요. 로컬 서버와 인터넷 연결을 확인해 주세요.';
        if(error.name==='NotAllowedError')message='마이크가 허용되지 않았어요. 브라우저의 마이크 권한을 허용하고 다시 시작해 주세요.';
        if(error.name==='NotFoundError')message='마이크를 찾지 못했어요. 마이크를 연결해 주세요.';
        if(error.name==='NotReadableError')message='마이크를 사용할 수 없어요. 다른 앱이 사용 중인지 확인해 주세요.';
        this.fail(call,message);return false;
      }
    }
  }
  if(typeof module!=='undefined' && module.exports)module.exports={ForestVoiceSession};
  else global.ForestVoiceSession=ForestVoiceSession;
})(globalThis);
