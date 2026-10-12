'use strict';
// Independent rendering layer: no network, dependencies, or changes to button semantics.
(() => {
  const root = document.documentElement;
  const stage = document.querySelector('#stage');
  const canvas = document.querySelector('#living-light');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let width = 0, height = 0, frame = 0, previous = 0, clock = 0;
  let pointer = null, lastWake = null;
  const voiceLevels = { deer: 0, rabbit: 0 };
  document.addEventListener('forest-voice-level', event => {
    if (Object.hasOwn(voiceLevels, event.detail.animal)) {
      voiceLevels[event.detail.animal] = Math.max(0, Math.min(1, event.detail.level || 0));
      const button = document.querySelector(`.creature.${event.detail.animal}`);
      button?.style.setProperty('--voice-level', String(voiceLevels[event.detail.animal]));
    }
  });
  const ripples = [];
  const motes = Array.from({ length: 58 }, (_, i) => ({
    x: ((i * 73 + 19) % 101) / 101, y: .14 + ((i * 31) % 79) / 100,
    phase: i * 2.399, speed: .18 + (i % 5) * .035, radius: .7 + (i % 4) * .35,
  }));
  const spark = document.createElement('canvas');
  spark.width = spark.height = 48;
  const glow = spark.getContext('2d');
  const gradient = glow.createRadialGradient(24, 24, 0, 24, 24, 24);
  gradient.addColorStop(0, '#e9fff5'); gradient.addColorStop(.12, '#9dffdf');
  gradient.addColorStop(.28, '#51e6c47f'); gradient.addColorStop(1, '#2db99b00');
  glow.fillStyle = gradient; glow.fillRect(0, 0, 48, 48);
  const animals = [...document.querySelectorAll('.creature')].map(button => {
    const image = button.querySelector('.animal');
    const surface = button.querySelector('.animal-motion');
    return { button, image, surface, context: surface.getContext('2d'), start: null, lastState: 'idle', w: 0, h: 0, walk: null, offset: 0, nextWalk: button.dataset.kind === 'deer' ? 2 : 5 };
  });
  function reduced() { return root.dataset.reduced === 'true'; }
  function fit() {
    const r = stage.getBoundingClientRect(); width = r.width; height = r.height;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    for (const animal of animals) {
      const b = animal.button.getBoundingClientRect();
      animal.w = b.width; animal.h = b.height;
      animal.surface.width = Math.round(b.width * ratio); animal.surface.height = Math.round(b.height * ratio);
      animal.context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    ripples.length = 0;
    drawAnimals(clock, true);
  }
  function drawAnimals(time, still) {
    for (const a of animals) {
      if (!a.context || !a.image.complete || !a.image.naturalWidth) continue;
      const c = a.context, image = a.image;
      const state = a.button.dataset.state;
      const triggered = state === 'reacting' && a.lastState !== state;
      if (triggered) a.start = time;
      a.lastState = state;
      const kind = a.button.dataset.kind;
      if (still) {
        a.walk = null; a.offset = 0; a.nextWalk = time + (kind === 'deer' ? 3 : 6);
      } else if (!a.walk && (triggered || (time >= a.nextWalk && a.button.dataset.speaking !== 'true'))) {
        // Two short steps, then rest at the new position. Alternate the next excursion.
        a.walk = { start: time, from: a.offset, to: a.offset > 0 ? 0 : Math.min(a.w * .18, 48), duration: kind === 'deer' ? 2.8 : 1.8 };
      }
      let stride = 0, lift = 0;
      if (a.walk) {
        const p = Math.min(1, (time - a.walk.start) / a.walk.duration);
        const step = Math.min(1, Math.floor(p * 2)), phase = p === 1 ? 1 : (p * 2) % 1;
        const ease = phase * phase * (3 - 2 * phase);
        a.offset = a.walk.from + (a.walk.to - a.walk.from) * (step + ease) / 2;
        stride = Math.sin(phase * Math.PI * 2) * (a.walk.to > a.walk.from ? 1 : -1);
        lift = Math.pow(Math.sin(phase * Math.PI), 2) * (kind === 'rabbit' ? 9 : 2.5);
        if (p === 1) { a.offset = a.walk.to; a.walk = null; a.nextWalk = time + (kind === 'deer' ? 12 : 9); }
      }
      a.button.style.transform = `translate(${a.offset.toFixed(2)}px, ${(-lift).toFixed(2)}px)`;
      a.button.dataset.walking = String(Boolean(a.walk));
      const raw = getComputedStyle(root).getPropertyValue(`--${kind}-duration`).trim();
      const seconds = parseFloat(raw) / (raw.endsWith('ms') ? 1000 : 1);
      const progress = state === 'reacting' ? Math.min(1, (time - (a.start ?? time)) / (seconds || 2)) : 0;
      const response = still ? 0 : Math.sin(progress * Math.PI);
      const scale = Math.min(a.w / image.naturalWidth, a.h / image.naturalHeight) * .96;
      const dw = image.naturalWidth * scale, dh = image.naturalHeight * scale;
      const ox = (a.w - dw) / 2, oy = (a.h - dh) / 2;
      c.clearRect(0, 0, a.w, a.h);
      // Upper bands breathe; paired lower bands articulate the legs during each step.
      // Overlap is subpixel-sized to avoid visible gaps between bands.
      const count = 96;
      for (let j = 0; j < count; j++) {
        const y = j / count;
        const head = Math.pow(Math.max(0, 1 - y / .62), 1.6);
        const chest = Math.sin(Math.max(0, Math.min(1, (y - .35) / .5)) * Math.PI);
        const breathe = still ? 0 : Math.sin(time * 1.35 + (kind === 'rabbit' ? 2 : 0));
        const nod = still ? 0 : Math.sin(time * .67) * 1.25 + response * 6 + voiceLevels[kind] * 3;
        const ear = kind === 'rabbit' && !still ? Math.sin(time * 2.1) * Math.pow(Math.max(0, 1 - y / .38), 2) * 1.9 : 0;
        const stretch = 1 + breathe * .005 * chest;
        const dx = head * nod + ear;
        const sh = Math.min(image.naturalHeight / count + .25 / scale, image.naturalHeight * (1 - y));
        const leg = Math.pow(Math.max(0, (y - .6) / .4), 1.4);
        if (leg > 0 && stride && kind === 'deer') {
          for (let side = 0; side < 2; side++) {
            const swing = stride * leg * Math.min(5, a.w * .018) * (side ? -1 : 1);
            c.drawImage(image, side * image.naturalWidth / 2, image.naturalHeight * y, image.naturalWidth / 2, sh,
              ox + dw * side / 2 + dx + swing, oy + dh * y, dw / 2 + .35, sh * scale);
          }
        } else {
          c.drawImage(image, 0, image.naturalHeight * y, image.naturalWidth, sh,
            ox + dx - dw * (stretch - 1) / 2, oy + dh * y, dw * stretch, sh * scale);
        }
      }
      a.button.querySelector('.animal-shell').classList.add('ready');
    }
  }
  function drawLight(time) {
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'screen';
    // Thin, slowly changing reflections remain close to the water surface.
    for (let row = 0; row < 24; row++) {
      const depth = row / 24;
      const y = height * (.79 + depth * .2);
      ctx.beginPath();
      for (let x = width * .08; x < width * .93; x += 12) {
        let bend = Math.sin(x * .024 + time * .9 + row * .8) * (1 + depth * 3)
          + Math.sin(x * .008 - time * .55 + row) * 2;
        for (const ripple of ripples) {
          if (!ripple.water) continue;
          const age = time - ripple.start;
          const distance = Math.hypot(x - ripple.x, (y - ripple.y) / .3);
          const front = distance - age * 95;
          bend += Math.sin(front * .065) * Math.exp(-front * front / 7000) * Math.max(0, 1 - age / 2.4) * 9;
        }
        if (x === width * .08) ctx.moveTo(x, y + bend); else ctx.lineTo(x, y + bend);
      }
      ctx.strokeStyle = `rgba(72,209,225,${.015 + (Math.sin(row * 2.4 + time * .6) + 1) * .017})`;
      ctx.lineWidth = .6 + depth * .8; ctx.stroke();
    }
    for (const m of motes) {
      let x = m.x * width + Math.sin(time * m.speed + m.phase) * 30;
      let y = m.y * height + Math.cos(time * m.speed * .8 + m.phase) * 18;
      if (pointer) {
        const distance = Math.hypot(x - pointer.x, y - pointer.y);
        if (distance < 150) { x += (pointer.x - x) * .07; y += (pointer.y - y) * .07; }
      }
      const alpha = .13 + Math.pow((Math.sin(time * .85 + m.phase) + 1) / 2, 3) * .7;
      const size = m.radius * 10;
      ctx.globalAlpha = alpha; ctx.drawImage(spark, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i], age = time - r.start;
      if (age > 2.4) { ripples.splice(i, 1); continue; }
      const fade = Math.pow(1 - age / 2.4, 2);
      for (let ring = 0; ring < 3; ring++) {
        const radius = Math.max(0, age * 68 - ring * 15);
        if (!radius) continue;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, radius, radius * (r.y > height * .76 ? .26 : .68), 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(144,255,227,${fade * .4})`; ctx.lineWidth = 1; ctx.stroke();
      }
      for (let j = 0; j < (r.water ? 0 : 10); j++) {
        const angle = j * Math.PI * 2 / 10 + age * .2;
        const radius = age * 40 + 8, size = 10 * fade;
        ctx.globalAlpha = fade;
        ctx.drawImage(spark, r.x + Math.cos(angle) * radius - size / 2, r.y + Math.sin(angle) * radius * .6 - age * 16 - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function tick(now) {
    frame = 0;
    if (document.hidden || reduced()) return;
    if (!previous) previous = now;
    const delta = now - previous;
    if (delta >= 30) { clock += Math.min(delta, 80) / 1000; previous = now; drawLight(clock); drawAnimals(clock, false); }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    ripples.length = 0; pointer = null; lastWake = null;
    if (reduced() || document.hidden) { ctx.clearRect(0, 0, width, height); drawAnimals(clock, true); }
    else frame = requestAnimationFrame(tick);
  }
  stage.addEventListener('pointermove', e => {
    if (reduced() || document.hidden) return;
    const b = stage.getBoundingClientRect(); pointer = { x: e.clientX - b.left, y: e.clientY - b.top };
    const water = pointer.y >= height * .79 && pointer.x >= width * .08 && pointer.x <= width * .93;
    if (!water) { lastWake = null; return; }
    if (!lastWake || (clock - lastWake.time >= .1 && Math.hypot(pointer.x - lastWake.x, pointer.y - lastWake.y) >= 8)) {
      if (ripples.length >= 16) ripples.shift();
      ripples.push({ ...pointer, start: clock, water: true });
      lastWake = { ...pointer, time: clock };
    }
  }, { passive: true });
  stage.addEventListener('pointerleave', () => { pointer = null; lastWake = null; });
  stage.addEventListener('click', e => {
    if (reduced() || document.hidden) return;
    const b = stage.getBoundingClientRect();
    let x = e.clientX - b.left, y = e.clientY - b.top;
    if (e.detail === 0) { const r = e.target.getBoundingClientRect(); x = r.left - b.left + r.width / 2; y = r.top - b.top + r.height * .65; }
    if (ripples.length >= 16) ripples.shift();
    ripples.push({ x, y, start: clock, water: y >= height * .79 });
  });
  const observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ['data-reduced'] });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('resize', () => { fit(); sync(); });
  for (const a of animals) {
    a.image.addEventListener('load', () => { drawAnimals(clock, reduced()); });
    a.image.addEventListener('error', () => {
      const warning = document.querySelector('#asset-warning');
      warning.textContent = '동물 그림을 불러오지 못했어요. assets 폴더를 확인해 주세요.'; warning.hidden = false;
    });
  }
  fit(); sync();
})();
