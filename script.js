'use strict';
(() => {
  // 작가의 설정: 효과 시간은 styles.css의 변수를 사용합니다.
  const SETTINGS = { maxParticles: 60, reducedFeedbackMs: 1000, helpHintMs: 8000 };
  const root = document.documentElement;
  const stage = document.querySelector('#stage');
  const particleLayer = document.querySelector('#particles');
  const status = document.querySelector('#status');
  const hint = document.querySelector('#interaction-hint');
  const help = document.querySelector('#help-panel');
  const helpToggle = document.querySelector('#help-toggle');
  const motionToggle = document.querySelector('#motion-toggle');
  const fullscreen = document.querySelector('#fullscreen');
  const toast = document.querySelector('#toast');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Map();
  let motionOverridden = false;
  let hintTimer;
  let toastTimer;
  let nearbyTimer;

  // 풀 위치: x는 왼쪽에서의 거리, y는 위에서의 거리(%)입니다.
  const grassLocations = [{ x: 3, y: 52 }, { x: 14, y: 67 }, { x: 83, y: 43 }, { x: 73, y: 70 }, { x: 88, y: 66 }];
  const grassHost = document.querySelector('#grasses');
  grassLocations.forEach(({ x, y }, index) => {
    const button = document.createElement('button');
    button.className = 'grass';
    button.dataset.kind = 'grass';
    button.dataset.state = 'idle';
    button.style.cssText = `left:${x}%;top:${y}%;--delay:${-index * 1.3}s`;
    button.setAttribute('aria-label', `꽃에 빛 만들기 ${index + 1}`);
    button.innerHTML = `<img class="blades" src="assets/ember-flowers.png" alt="" draggable="false">`;
    grassHost.append(button);
  });
  const targets = [...document.querySelectorAll('[data-kind]')];
  const reduced = () => root.dataset.reduced === 'true';
  const durationFor = kind => {
    if (reduced()) return SETTINGS.reducedFeedbackMs;
    const value = getComputedStyle(root).getPropertyValue(`--${kind}-duration`).trim();
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? (value.endsWith('ms') ? n : n * 1000) : 1200;
  };
  function notify(text) {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4500);
  }
  function clearEffects() {
    active.forEach(timer => clearTimeout(timer));
    active.clear();
    targets.forEach(target => { target.dataset.state = 'idle'; target.classList.remove('near-rabbit'); });
    clearTimeout(nearbyTimer);
    particleLayer.replaceChildren();
  }
  function setMotion(value) {
    clearEffects();
    root.dataset.reduced = String(value);
    motionToggle.setAttribute('aria-pressed', String(value));
    motionToggle.textContent = value ? '움직임 줄이기 · 켜짐' : '움직임 줄이기';
  }
  function emitParticles(target, duration) {
    const bounds = target.getBoundingClientRect();
    const scene = stage.getBoundingClientRect();
    const count = Math.min(target.dataset.kind === 'deer' ? 22 : 12, SETTINGS.maxParticles - particleLayer.childElementCount);
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('i');
      dot.className = 'particle';
      const x = bounds.left - scene.left + bounds.width * (.2 + Math.random() * .6);
      const y = bounds.top - scene.top + bounds.height * (.45 + Math.random() * .4);
      dot.style.cssText = `left:${x}px;top:${y}px;--size:${2 + Math.random() * 3}px;--dx:${(Math.random() - .5) * 130}px;--dy:${-25 - Math.random() * 100}px;--duration:${duration}ms`;
      dot.addEventListener('animationend', () => dot.remove(), { once: true });
      particleLayer.append(dot);
    }
  }
  function react(target) {
    if (document.hidden || active.has(target)) return;
    const kind = target.dataset.kind;
    const duration = durationFor(kind);
    target.dataset.state = 'reacting';
    const message = { deer: '사슴이 따뜻한 빛으로 인사합니다.', rabbit: '토끼가 가볍게 뛰어 인사합니다.', grass: '꽃잎 사이에 따뜻한 빛이 피어납니다.' };
    status.textContent = reduced() ? '선택한 대상이 밝게 빛납니다.' : message[kind];
    if (!reduced()) {
      emitParticles(target, duration);
      if (kind === 'rabbit') {
        const neighbor = grassHost.children[3];
        neighbor.classList.add('near-rabbit');
        clearTimeout(nearbyTimer);
        nearbyTimer = setTimeout(() => neighbor.classList.remove('near-rabbit'), durationFor('grass'));
      }
    }
    active.set(target, setTimeout(() => {
      target.dataset.state = 'idle';
      active.delete(target);
    }, duration));
  }
  // Native button click unifies mouse, touch and keyboard without double firing.
  targets.forEach(target => {
    target.addEventListener('click', () => react(target));
    if (target.dataset.kind === 'grass') target.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') react(target);
    });
  });
  motionToggle.addEventListener('click', () => { motionOverridden = true; setMotion(!reduced()); });
  media.addEventListener('change', event => { if (!motionOverridden) setMotion(event.matches); });
  setMotion(media.matches);
  function showHint() {
    hint.classList.remove('is-hidden');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.add('is-hidden'), SETTINGS.helpHintMs);
  }
  function setHelp(open, restoreFocus = false) {
    help.hidden = !open;
    helpToggle.setAttribute('aria-expanded', String(open));
    if (open) { showHint(); document.querySelector('#help-close').focus(); }
    else if (restoreFocus) helpToggle.focus();
  }
  helpToggle.addEventListener('click', () => setHelp(help.hidden));
  document.querySelector('#help-close').addEventListener('click', () => setHelp(false, true));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !help.hidden) setHelp(false, true); });
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.querySelector('#artwork').requestFullscreen) await document.querySelector('#artwork').requestFullscreen();
      else notify('이 브라우저에서는 전체 화면을 지원하지 않습니다. 현재 화면에서 감상해 주세요.');
    } catch { notify('전체 화면으로 전환하지 못했어요. 현재 화면에서 계속 감상할 수 있습니다.'); }
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreen.textContent = document.fullscreenElement ? '전체 화면 나가기' : '전체 화면 ↗';
    clearEffects();
  });
  window.addEventListener('resize', clearEffects);
  document.addEventListener('visibilitychange', () => {
    root.dataset.paused = String(document.hidden);
    clearEffects();
  });
  const forest = document.querySelector('.forest');
  function forestMissing() { forest.hidden = true; document.querySelector('#asset-warning').hidden = false; }
  forest.addEventListener('error', forestMissing);
  if (forest.complete && !forest.naturalWidth) forestMissing();
  showHint();
})();
