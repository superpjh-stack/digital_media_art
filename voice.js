'use strict';
(() => {
  const $=selector=>document.querySelector(selector);
  const panel=$('#voice-panel'),toggle=$('#voice-toggle'),start=$('#voice-start'),stop=$('#voice-stop'),mute=$('#voice-mute');
  const status=$('#voice-status'),transcript=$('#voice-transcript'),retry=$('#voice-play'),title=$('#voice-title');
  const choices=[...document.querySelectorAll('[data-voice-animal]')];
  const labels={deer:'사슴',rabbit:'토끼'};
  let selected='deer',audioContext=null,source=null,analyser=null,silent=null,animation=0,smoothed=0,lastSample=0;
  let playbackBlocked=false;
  const audio=new Audio();audio.autoplay=true;audio.setAttribute('playsinline','');
  function showState(state) {
    const active=['connecting','listening','responding','speaking'].includes(state.phase);
    const names={idle:'대화할 준비가 되었어요',connecting:'연결 중…',listening:'듣는 중 · 편하게 이야기해 주세요',responding:'답변을 생각하고 있어요',speaking:`${labels[state.animal]}이 답하는 중`,error:'연결을 확인해 주세요'};
    status.textContent=state.error||(state.muted?'마이크 꺼짐':names[state.phase]);
    if(playbackBlocked)status.textContent='소리 재생을 허용하려면 아래 버튼을 눌러 주세요.';
    panel.dataset.phase=state.phase;
    start.disabled=active;stop.disabled=!active;mute.disabled=!active||state.phase==='connecting';
    mute.setAttribute('aria-pressed',String(state.muted));mute.textContent=state.muted?'마이크 켜기':'마이크 끄기';
    window.forestMusic?.setDucked(active);
    for(const button of document.querySelectorAll('.creature'))button.dataset.speaking=String(button.dataset.kind===state.animal&&state.phase==='speaking');
  }
  function level(value) {
    document.dispatchEvent(new CustomEvent('forest-voice-level',{detail:{animal:selected,level:value}}));
  }
  function cleanAudio() {
    cancelAnimationFrame(animation);animation=0;smoothed=0;lastSample=0;level(0);
    audio.pause();audio.srcObject=null;
    source?.disconnect();analyser?.disconnect();silent?.disconnect();source=analyser=silent=null;
    const c=audioContext;audioContext=null;if(c)c.close().catch(()=>{});
    playbackBlocked=false;retry.hidden=true;
  }
  function prepareAudio() {
    if(!audioContext||audioContext.state==='closed')audioContext=new (window.AudioContext||window.webkitAudioContext)();
    return audioContext.resume();
  }
  function attachStream(stream) {
    const call=voice.current;
    audio.srcObject=stream;
    audio.play().then(()=>{if(voice.current===call){playbackBlocked=false;retry.hidden=true;showState(voice.state);}}).catch(()=>{
      if(voice.current===call){playbackBlocked=true;retry.hidden=false;showState(voice.state);}
    });
    try {
      source?.disconnect();analyser?.disconnect();silent?.disconnect();cancelAnimationFrame(animation);
      source=audioContext.createMediaStreamSource(stream);analyser=audioContext.createAnalyser();analyser.fftSize=512;
      silent=audioContext.createGain();silent.gain.value=0;source.connect(analyser);analyser.connect(silent);silent.connect(audioContext.destination);
      const data=new Float32Array(analyser.fftSize);
      function sample(now) {
        if(voice.current!==call||!analyser)return;
        if(now-lastSample>=32) {
          lastSample=now;analyser.getFloatTimeDomainData(data);
          const rms=Math.sqrt(data.reduce((sum,v)=>sum+v*v,0)/data.length);
          smoothed=smoothed*.6+Math.min(1,Math.max(0,rms-.005)*9)*.4;
          level(document.documentElement.dataset.reduced==='true'||playbackBlocked?0:smoothed);
        }
        animation=requestAnimationFrame(sample);
      }
      animation=requestAnimationFrame(sample);
    }catch{/* Voice can still play if audio analysis is unsupported. */}
  }
  const voice=new ForestVoiceSession({onState:showState,onTranscript:text=>{transcript.textContent=text||'동물이 답하면 여기에 자막이 나타납니다.';},onStream:attachStream,onStop:cleanAudio});
  // Read-only state is useful for diagnostics; API credentials never enter the browser.
  window.forestVoice=voice;
  async function begin() {
    if(location.protocol==='file:'){status.textContent='음성 대화는 로컬 서버에서 사용할 수 있어요. node server.mjs 실행 후 http://127.0.0.1:8766 으로 열어 주세요.';return;}
    if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection){status.textContent='이 브라우저에서는 음성 연결을 사용할 수 없어요. 최신 Chrome에서 로컬 주소로 열어 주세요.';return;}
    if(voice.current)return;
    // Resume synchronously from the user gesture, before network or microphone awaits.
    try {prepareAudio().catch(()=>{});}catch{status.textContent='브라우저에서 소리를 사용할 수 없어요.';return;}
    await voice.start(selected);
  }
  function select(animal) {
    if(selected===animal)return;
    const reconnect=Boolean(voice.current);
    voice.stop();selected=animal;title.textContent=`${labels[animal]}과 이야기`;
    for(const choice of choices)choice.setAttribute('aria-pressed',String(choice.dataset.voiceAnimal===animal));
    transcript.textContent='동물이 답하면 여기에 자막이 나타납니다.';
    if(reconnect)begin();
  }
  function closePanel(restore=true) {
    panel.hidden=true;toggle.setAttribute('aria-expanded','false');voice.stop();
    if(restore)toggle.focus();
  }
  function openPanel() {
    if(!$('#help-panel').hidden)$('#help-toggle').click();
    panel.hidden=false;toggle.setAttribute('aria-expanded','true');choices.find(c=>c.dataset.voiceAnimal===selected).focus();
  }
  toggle.addEventListener('click',()=>panel.hidden?openPanel():closePanel());
  $('#voice-close').addEventListener('click',()=>closePanel());
  $('#help-toggle').addEventListener('click',()=>{if(!panel.hidden)closePanel(false);});
  choices.forEach(choice=>choice.addEventListener('click',()=>select(choice.dataset.voiceAnimal)));
  for(const button of document.querySelectorAll('.creature'))button.addEventListener('click',()=>select(button.dataset.kind));
  start.addEventListener('click',begin);stop.addEventListener('click',()=>voice.stop('대화를 마쳤어요. 다시 시작할 수 있습니다.'));
  mute.addEventListener('click',()=>voice.setMuted(!voice.state.muted));
  retry.addEventListener('click',async()=>{
    const call=voice.current;if(!call)return;
    try{await prepareAudio();if(voice.current!==call)return;await audio.play();if(voice.current===call){playbackBlocked=false;retry.hidden=true;showState(voice.state);}}
    catch{if(voice.current===call)status.textContent='소리 재생이 차단되어 있어요. 브라우저의 소리 권한을 확인해 주세요.';}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)closePanel();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)voice.stop('화면을 떠나 대화가 종료됐어요. 다시 시작할 수 있습니다.');});
  window.addEventListener('pagehide',()=>voice.stop());
  showState(voice.state);
})();
