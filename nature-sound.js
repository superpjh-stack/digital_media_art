'use strict';
(function(global){
  const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
  function spatialMix(x=.5,y=.5){
    x=Number.isFinite(x)?clamp(x):.5;y=Number.isFinite(y)?clamp(y):.5;
    return {
      water:.025+.15*Math.exp(-Math.pow((y-.84)/.23,2)-Math.pow((x-.47)/.55,2)),
      wind:.025+.065*Math.exp(-Math.pow((y-.32)/.38,2)),
      birds:.15+.75*Math.exp(-Math.pow((y-.36)/.3,2)-Math.pow((x-.73)/.42,2)),
      waterPan:clamp((.47-x)*1.6,-1,1),windPan:clamp((.25-x)*1.4,-1,1),birdPan:clamp((.73-x)*1.6,-1,1),
    };
  }
  class ForestAmbience {
    constructor(context,destination){
      this.context=context;this.destination=destination;this.nodes=new Set();this.disposed=false;this.mix=spatialMix();
      const c=context;
      this.water=this.channel();this.wind=this.channel();this.birds=this.channel();
      const noise=c.createBuffer(1,c.sampleRate*4,c.sampleRate),data=noise.getChannelData(0);
      let seed=3179,brown=0;
      for(let i=0;i<data.length;i++){seed=seed*16807%2147483647;const white=seed/1073741823.5-1;brown=(brown+white*.035)/1.035;data[i]=white*.3+brown*2;}
      // Blend the tail toward the opening samples to soften the noise loop boundary.
      const seam=Math.floor(c.sampleRate*.04);
      for(let i=0;i<seam;i++){const t=i/seam;data[data.length-seam+i]=data[data.length-seam+i]*(1-t)+data[i]*t;}
      this.noise(noise,this.water,600,3200);this.noise(noise,this.wind,70,650);
      this.nextBird=c.currentTime+2.2;this.birdIndex=0;this.setPosition(.5,.5);
    }
    channel(){const c=this.context,gain=c.createGain(),pan=c.createStereoPanner();gain.gain.value=0;gain.connect(pan);pan.connect(this.destination);return{gain,pan};}
    noise(buffer,channel,low,high){
      const c=this.context,source=c.createBufferSource(),hp=c.createBiquadFilter(),lp=c.createBiquadFilter();
      source.buffer=buffer;source.loop=true;hp.type='highpass';hp.frequency.value=low;lp.type='lowpass';lp.frequency.value=high;lp.Q.value=.5;
      source.connect(hp);hp.connect(lp);lp.connect(channel.gain);source.start();this.nodes.add(source);
      source.onended=()=>{source.disconnect();hp.disconnect();lp.disconnect();this.nodes.delete(source);};
    }
    setPosition(x,y){
      if(this.disposed)return;this.mix=spatialMix(x,y);const t=this.context.currentTime,m=this.mix;
      for(const [channel,level,pan] of [[this.water,m.water,m.waterPan],[this.wind,m.wind,m.windPan],[this.birds,m.birds,m.birdPan]]){
        channel.gain.gain.setTargetAtTime(level,t,.45);channel.pan.pan.setTargetAtTime(pan,t,.45);
      }
    }
    schedule(){
      if(this.disposed)return;const c=this.context;
      if(c.currentTime+.3<this.nextBird)return;
      const start=Math.max(this.nextBird,c.currentTime+.02),pitch=[1850,2240,1980,2460][this.birdIndex++%4];
      for(let i=0;i<3;i++){
        const osc=c.createOscillator(),gain=c.createGain(),at=start+i*.18;
        osc.type='sine';osc.frequency.setValueAtTime(pitch,at);osc.frequency.exponentialRampToValueAtTime(pitch*1.4,at+.045);osc.frequency.exponentialRampToValueAtTime(pitch*.85,at+.14);
        gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.025,at+.018);gain.gain.exponentialRampToValueAtTime(.0001,at+.15);
        osc.connect(gain);gain.connect(this.birds.gain);this.nodes.add(osc);
        osc.onended=()=>{osc.disconnect();gain.disconnect();this.nodes.delete(osc);};osc.start(at);osc.stop(at+.17);
      }
      this.nextBird=start+6+(this.birdIndex%3)*1.7;
    }
    stop(){
      if(this.disposed)return;this.disposed=true;
      for(const n of this.nodes){try{n.stop();n.disconnect();}catch{}}this.nodes.clear();
      for(const channel of [this.water,this.wind,this.birds]){channel.gain.disconnect();channel.pan.disconnect();}
    }
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={ForestAmbience,spatialMix};
  else {
    global.ForestAmbience=ForestAmbience;
    const stage=document.querySelector('#stage');
    function locate(e){const r=stage.getBoundingClientRect();global.forestMusic?.ambience?.setPosition((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);}
    stage?.addEventListener('pointermove',locate,{passive:true});stage?.addEventListener('pointerdown',locate,{passive:true});
    stage?.addEventListener('pointerleave',()=>global.forestMusic?.ambience?.setPosition(.5,.5));
  }
})(globalThis);
