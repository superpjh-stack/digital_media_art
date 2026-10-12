'use strict';
(function(global){
  class ForestMusic {
    constructor({createContext=()=>new (global.AudioContext||global.webkitAudioContext)(),onChange=()=>{}}={}) {
      Object.assign(this,{createContext,onChange});this.volume=.35;this.ducked=false;this.playing=false;this.context=null;this.timer=null;this.generation=0;this.nodes=new Set();
    }
    get effectiveVolume(){return this.volume*(this.ducked ? .2 : 1);}
    setVolume(value){if(!Number.isFinite(Number(value)))return;this.volume=Math.max(0,Math.min(1,Number(value)));this.applyVolume();}
    setDucked(value){this.ducked=Boolean(value);this.applyVolume();}
    applyVolume(){if(this.context&&this.master)this.master.gain.setTargetAtTime(this.effectiveVolume,this.context.currentTime,.25);}
    async start(){
      if(this.context)return this.playing;
      const generation=++this.generation;
      try {
        const c=this.createContext();this.context=c;
        this.master=c.createGain();this.master.gain.value=this.effectiveVolume;
        const compressor=c.createDynamicsCompressor();compressor.threshold.value=-14;compressor.ratio.value=4;
        this.master.connect(compressor);compressor.connect(c.destination);
        this.bus=c.createGain();this.bus.connect(this.master);
        const reverb=c.createConvolver(),wet=c.createGain();wet.gain.value=.3;
        const impulse=c.createBuffer(2,Math.floor(c.sampleRate*2.8),c.sampleRate);
        let seed=8327;
        for(let channel=0;channel<2;channel++) {const samples=impulse.getChannelData(channel);for(let i=0;i<samples.length;i++){seed=(seed*16807)%2147483647;samples[i]=(seed/1073741823.5-1)*Math.pow(1-i/samples.length,3)*.45;}}
        reverb.buffer=impulse;this.bus.connect(reverb);reverb.connect(wet);wet.connect(this.master);
        await c.resume();
        if(generation!==this.generation)return false;
        if(c.state!=='running')throw new Error('playback blocked');
        this.ambience=global.ForestAmbience?new global.ForestAmbience(c,this.master):null;
        this.playing=true;this.nextChord=c.currentTime+.04;this.nextBell=c.currentTime+3;this.chordIndex=0;this.bellIndex=0;
        this.schedule();this.timer=setInterval(()=>this.schedule(),250);this.onChange(true);return true;
      }catch(error){if(generation===this.generation){this.stop();throw error;}return false;}
    }
    tone(midi,start,duration,volume,attack=1.8){
      const c=this.context,osc=c.createOscillator(),gain=c.createGain();
      osc.type='sine';osc.frequency.value=440*Math.pow(2,(midi-69)/12);
      gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+attack);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
      osc.connect(gain);gain.connect(this.bus);this.nodes.add(osc);
      osc.onended=()=>{osc.disconnect();gain.disconnect();this.nodes.delete(osc);};
      osc.start(start);osc.stop(start+duration+.05);
    }
    schedule(){
      if(!this.playing||!this.context)return;
      this.ambience?.schedule();
      const now=this.context.currentTime;
      const chords=[[48,55,59,64],[45,52,55,60],[41,48,52,57],[43,50,57,62]];
      if(this.nextChord<now+.5){const notes=chords[this.chordIndex++%chords.length];for(const [i,note]of notes.entries())this.tone(note,this.nextChord+i*.13,10,.038);this.tone(notes[0]-12,this.nextChord,10,.023);this.nextChord+=8;}
      if(this.nextBell<now+.5){const melody=[76,79,74,72,79,81,76,74];this.tone(melody[this.bellIndex++%melody.length],this.nextBell,4,.026,.018);this.nextBell+=4;}
    }
    stop(){
      this.generation++;clearInterval(this.timer);this.timer=null;this.playing=false;
      for(const node of this.nodes){try{node.stop();node.disconnect();}catch{}}this.nodes.clear();
      this.ambience?.stop();this.ambience=null;
      const c=this.context;this.context=null;this.master=null;this.bus=null;
      if(c)c.close().catch(()=>{});this.onChange(false);
    }
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={ForestMusic};
  else {
    global.ForestMusic=ForestMusic;
    const toggle=document.querySelector('#music-toggle'),volume=document.querySelector('#music-volume');
    if(!toggle)return;
    const status=document.querySelector('#music-status');
    const music=new ForestMusic({onChange:playing=>{toggle.setAttribute('aria-pressed',String(playing));toggle.textContent=playing?'음악 끄기':'음악 켜기';status.textContent=playing?'음악과 공간 자연음 재생 중':'음악 꺼짐';}});
    global.forestMusic=music;
    toggle.addEventListener('click',async()=>{
      if(music.context){music.stop();return;}
      try{await music.start();}catch{status.textContent='음악을 재생하지 못했어요. 버튼을 다시 눌러 주세요.';}
    });
    volume.addEventListener('input',()=>music.setVolume(Number(volume.value)/100));
    document.addEventListener('visibilitychange',()=>{if(document.hidden)music.stop();});
    window.addEventListener('pagehide',()=>music.stop());
  }
})(globalThis);
