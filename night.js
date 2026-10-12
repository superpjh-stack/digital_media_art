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
  const drinkingImage = new Image();
  drinkingImage.src = 'assets/moon-deer-drinking.png';
  const butterflies = [], blooms = new Map();
  const ease = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
  function addWaterRipple(x, y) {
    if (ripples.length >= 16) ripples.shift();
    ripples.push({ x, y, start: clock, water: true });
  }
  function bloomFlower(target) {
    if (!target || reduced() || document.hidden || blooms.has(target)) return;
    const r = target.getBoundingClientRect(), b = stage.getBoundingClientRect();
    const destination = { x: r.left - b.left + r.width * .51, y: r.top - b.top + r.height * .4 };
    blooms.set(target, clock); target.classList.add('is-blooming');
    for (let i = 0; i < 2; i++) {
      if (butterflies.length >= 10) butterflies.shift();
      butterflies.push({ target: destination, start: clock + .5 + i * .5, side: i ? 1 : -1, phase: clock + i * 2.4 });
    }
  }
  function drawButterflies(time) {
    for (const [flower, start] of blooms) {
      if (time - start > 11) { flower.classList.remove('is-blooming'); blooms.delete(flower); }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = butterflies.length - 1; i >= 0; i--) {
      const b = butterflies[i], age = time - b.start;
      if (age < 0) continue;
      if (age > 10) { butterflies.splice(i, 1); continue; }
      const arrive = ease(age / 3), leave = ease((age - 7) / 3), perched = age >= 3 && age < 7;
      const x = b.target.x + b.side * (1 - arrive) * Math.min(width * .25, 200) + b.side * leave * 100 + (perched ? 0 : Math.sin(age * 3 + b.phase) * 12);
      const y = b.target.y - (1 - arrive) * 85 - leave * 130 + (perched ? -3 : Math.cos(age * 2.7) * 9);
      const flap = .2 + .8 * Math.abs(Math.sin(time * (perched ? 3 : 17) + b.phase));
      ctx.save();ctx.translate(x, y);ctx.rotate(Math.sin(age * 2) * (perched ? .06 : .22));
      ctx.globalAlpha = Math.min(1, age * 2) * (1 - leave);
      for (const side of [-1, 1]) {
        ctx.save();ctx.scale(side * flap, 1);
        const wing = ctx.createLinearGradient(0, 0, 12, -7);
        wing.addColorStop(0, '#284655');wing.addColorStop(.45, b.side > 0 ? '#eeb85e' : '#85d3e1');wing.addColorStop(1, '#334766');
        ctx.fillStyle = wing;ctx.strokeStyle = '#e4d8a877';ctx.lineWidth = .6;
        ctx.beginPath();ctx.moveTo(0, 0);ctx.bezierCurveTo(7, -15, 17, -12, 12, -2);ctx.bezierCurveTo(16, 8, 7, 12, 0, 2);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.fillStyle = '#f8eec9';ctx.beginPath();ctx.arc(9, -5, 1.2, 0, Math.PI * 2);ctx.fill();ctx.restore();
      }
      ctx.strokeStyle = '#b6bda3';ctx.lineWidth = 1.5;ctx.beginPath();ctx.moveTo(0, -5);ctx.lineTo(0, 6);ctx.stroke();ctx.restore();
    }
  }
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
    return { button, image, surface, context: surface.getContext('2d'), start: null, lastState: 'idle', w: 0, h: 0, walk: null, offset: 0, drink: null, drinkRequested: false, nextDrink: 12, nextSip: 0, pad: 0, nextWalk: button.dataset.kind === 'deer' ? 2 : 5 };
  });
  function reduced() { return root.dataset.reduced === 'true'; }
  function fit() {
    const r = stage.getBoundingClientRect(); width = r.width; height = r.height;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    for (const animal of animals) {
      const b = animal.button.getBoundingClientRect();
      animal.w = b.width; animal.h = b.height; animal.baseTop = animal.button.offsetTop; animal.baseLeft = animal.button.offsetLeft;
      animal.pad = animal.button.dataset.kind === 'deer' ? b.width * .35 : 0;
      animal.surface.width = Math.round((b.width + animal.pad * 2) * ratio); animal.surface.height = Math.round(b.height * ratio);
      animal.context?.setTransform(ratio, 0, 0, ratio, animal.pad * ratio, 0);
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
      if (triggered) { a.start = time; if (a.button.dataset.kind === 'deer') a.drinkRequested = true; }
      a.lastState = state;
      const kind = a.button.dataset.kind;
      if (still) {
        a.walk = null; a.drink = null; a.drinkRequested = false; a.nextDrink = time + 12; a.offset = 0; a.nextWalk = time + (kind === 'deer' ? 3 : 6);
      } else if (!a.walk && !a.drink && (triggered || (time >= a.nextWalk && a.button.dataset.speaking !== 'true'))) {
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
      a.button.dataset.walking = String(Boolean(a.walk));
      const raw = getComputedStyle(root).getPropertyValue(`--${kind}-duration`).trim();
      const seconds = parseFloat(raw) / (raw.endsWith('ms') ? 1000 : 1);
      const progress = state === 'reacting' ? Math.min(1, (time - (a.start ?? time)) / (seconds || 2)) : 0;
      const response = still ? 0 : Math.sin(progress * Math.PI);
      const scale = Math.min(a.w / image.naturalWidth, a.h / image.naturalHeight) * .96;
      const dw = image.naturalWidth * scale, dh = image.naturalHeight * scale;
      const ox = (a.w - dw) / 2, oy = (a.h - dh) / 2;
      let dip = 0, approach = 0;
      const foot = oy + dh * .935;
      const drinkWidth = dw * 1.5, drinkHeight = drinkWidth / 1.5;
      const drinkX = ox - dw * .45, drinkY = foot - drinkHeight * .925;
      if (!still && kind === 'deer' && drinkingImage.complete && drinkingImage.naturalWidth && !a.walk && !a.drink && a.button.dataset.speaking !== 'true' && (a.drinkRequested || time >= a.nextDrink)) {
        a.drink = { start: time, distance: Math.max(0, Math.min(height * .14, height * .8 - a.baseTop - foot)) };
        a.drinkRequested = false; a.nextSip = time + 3.8;
      }
      let activity = 'resting';
      if (a.drink) {
        const age = time - a.drink.start;
        const outward = ease(age / 2.6), backward = ease((age - 8.2) / 2.6);
        approach = a.drink.distance * (outward - backward);
        dip = ease((age - 2.6) / 1.2) * (1 - ease((age - 7) / 1.2));
        activity = age < 2.6 ? 'approaching' : age < 3.8 ? 'lowering' : age < 7 ? 'drinking' : age < 8.2 ? 'raising' : 'returning';
        if (age < 2.6 || age > 8.2) {
          const phase = ((age < 2.6 ? age : age - 8.2) / 2.6 * 2) % 1;
          stride = Math.sin(phase * Math.PI * 2); lift = Math.sin(phase * Math.PI) ** 2 * 2.5;
        }
        if (activity === 'drinking' && time >= a.nextSip) {
          addWaterRipple(a.baseLeft + a.offset + drinkX + drinkWidth * .22, a.baseTop + approach + drinkY + drinkHeight * .925);
          a.nextSip = time + .65;
        }
        if (age >= 10.8) { a.drink = null; approach = 0; dip = 0; a.nextDrink = time + 24; a.nextWalk = time + 5; activity = 'resting'; }
      }
      a.button.dataset.activity = activity;
      a.button.style.transform = `translate(${a.offset.toFixed(2)}px, ${(approach - lift).toFixed(2)}px)`;
      c.clearRect(-a.pad, 0, a.w + a.pad * 2, a.h);
      c.globalAlpha = 1 - dip;
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
      c.globalAlpha = dip;
      if (dip > 0) c.drawImage(drinkingImage, drinkX, drinkY + Math.sin(time * 5) * dip * .45, drinkWidth, drinkHeight);
      c.globalAlpha = 1;
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
    drawButterflies(time);
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
    ripples.length = 0; pointer = null; lastWake = null; butterflies.length = 0;
    for (const flower of blooms.keys()) flower.classList.remove('is-blooming'); blooms.clear();
    if (reduced() || document.hidden) { ctx.clearRect(0, 0, width, height); drawAnimals(clock, true); }
    else frame = requestAnimationFrame(tick);
  }
  stage.addEventListener('pointerover', e => {
    const flower = e.target.closest('.grass');
    if (e.pointerType === 'mouse' && flower && !flower.contains(e.relatedTarget)) bloomFlower(flower);
  });
  stage.addEventListener('click', e => bloomFlower(e.target.closest('.grass')));
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
