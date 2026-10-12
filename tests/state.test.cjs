/* Dependency-free state tests. These do not replace real browser or visual checks. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor(kind) {
    this.dataset = kind ? { kind, state: 'idle' } : {};
    this.children = []; this.listeners = {}; this.attributes = {}; this.style = {};
    this.hidden = true; this.complete = true; this.naturalWidth = 1440;
    this.classList = { values: new Set(), add(v) { this.values.add(v); }, remove(v) { this.values.delete(v); }, contains(v) { return this.values.has(v); } };
  }
  addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); }
  async fire(name, event = {}) { for (const fn of this.listeners[name] ?? []) await fn(event); }
  setAttribute(k,v) { this.attributes[k] = v; }
  append(node) { node.parent = this; this.children.push(node); }
  replaceChildren() { this.children = []; }
  get childElementCount() { return this.children.length; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); }
  getBoundingClientRect() { return { left: 100, top: 100, width: 200, height: 200 }; }
  focus() { this.focused = true; }
}
function boot(prefersReduced = false) {
  const ids = ['stage','particles','status','interaction-hint','help-panel','help-toggle','motion-toggle','fullscreen','toast','grasses','help-close','artwork','asset-warning'];
  const nodes = Object.fromEntries(ids.map(id => ['#'+id, new Element()]));
  nodes['.forest'] = new Element();
  const deer = new Element('deer'), rabbit = new Element('rabbit');
  const root = new Element();
  const timers = new Map(); let nextId = 0, now = 0;
  const doc = new Element();
  Object.assign(doc, {
    documentElement: root, hidden: false, fullscreenElement: null,
    querySelector: s => nodes[s],
    querySelectorAll: () => [deer, rabbit, ...nodes['#grasses'].children],
    createElement: () => new Element(),
  });
  const win = new Element();
  const media = new Element(); media.matches = prefersReduced;
  const css = { '--deer-duration':'2000ms', '--rabbit-duration':'1000ms', '--grass-duration':'1200ms' };
  const sandbox = { document: doc, window: win, matchMedia: () => media, getComputedStyle: () => ({ getPropertyValue: k => css[k] }),
    setTimeout: (fn,ms) => { const id = ++nextId; timers.set(id,{ fn,at:now+ms }); return id; }, clearTimeout: id => timers.delete(id) };
  vm.runInNewContext(fs.readFileSync('script.js','utf8'), sandbox);
  const advance = ms => { now += ms; for (const [id,t] of [...timers]) if(t.at <= now) { timers.delete(id); t.fn(); } };
  return { nodes, deer, rabbit, root, doc, win, media, advance, css };
}
test('deer reacts once during 20 rapid clicks and resets after duration', async () => {
  const b = boot(); for(let i=0;i<20;i++) await b.deer.fire('click');
  assert.equal(b.deer.dataset.state,'reacting'); assert.equal(b.nodes['#particles'].childElementCount,22);
  b.advance(1999); assert.equal(b.deer.dataset.state,'reacting');
  b.advance(1); assert.equal(b.deer.dataset.state,'idle');
  for (const p of [...b.nodes['#particles'].children]) await p.fire('animationend');
  assert.equal(b.nodes['#particles'].childElementCount,0);
  await b.deer.fire('click'); assert.equal(b.nodes['#particles'].childElementCount,22);
});
test('all independent targets react and total particles never exceed 60', async () => {
  const b=boot(); for (const target of [b.deer,b.rabbit,...b.nodes['#grasses'].children]) await target.fire('click');
  assert.equal(b.nodes['#particles'].childElementCount,60);
  assert.equal(b.deer.dataset.state,'reacting'); assert.equal(b.rabbit.dataset.state,'reacting');
  b.advance(2000); for(const target of [b.deer,b.rabbit,...b.nodes['#grasses'].children]) assert.equal(target.dataset.state,'idle');
});
test('reduced motion has static feedback and no particles', async () => {
  const b=boot(true); assert.equal(b.root.dataset.reduced,'true');
  await b.deer.fire('click'); assert.equal(b.deer.dataset.state,'reacting'); assert.equal(b.nodes['#particles'].childElementCount,0);
  b.advance(1000); assert.equal(b.deer.dataset.state,'idle');
});
test('changing motion clears existing effects and explicit choice survives OS change', async () => {
  const b=boot(); await b.deer.fire('click'); await b.nodes['#motion-toggle'].fire('click');
  assert.equal(b.nodes['#particles'].childElementCount,0); assert.equal(b.deer.dataset.state,'idle');
  await b.media.fire('change',{matches:false}); assert.equal(b.root.dataset.reduced,'true');
});
test('OS preference change is followed until overridden', async () => {
  const b=boot(); await b.media.fire('change',{matches:true}); assert.equal(b.root.dataset.reduced,'true');
});
test('resize and hidden tab clear all effects; hidden tab rejects activation', async () => {
  const b=boot(); await b.deer.fire('click'); await b.win.fire('resize'); assert.equal(b.deer.dataset.state,'idle'); assert.equal(b.nodes['#particles'].childElementCount,0);
  await b.rabbit.fire('click'); b.doc.hidden=true; await b.doc.fire('visibilitychange');
  assert.equal(b.rabbit.dataset.state,'idle'); assert.equal(b.root.dataset.paused,'true');
  await b.deer.fire('click'); assert.equal(b.deer.dataset.state,'idle');
  b.doc.hidden=false; await b.doc.fire('visibilitychange'); await b.deer.fire('click'); assert.equal(b.deer.dataset.state,'reacting');
});
test('touch pointer entry does not trigger extra grass activation', async () => {
  const b=boot(); const grass=b.nodes['#grasses'].children[0];
  await grass.fire('pointerenter',{pointerType:'touch'}); assert.equal(grass.dataset.state,'idle');
  await grass.fire('click'); assert.equal(b.nodes['#particles'].childElementCount,12);
});
test('mouse entry activates grass and rabbit triggers adjacent grass', async () => {
  const b=boot(); const grass=b.nodes['#grasses'].children[0];
  await grass.fire('pointerenter',{pointerType:'mouse'}); assert.equal(grass.dataset.state,'reacting');
  await b.rabbit.fire('click'); assert.equal(b.nodes['#grasses'].children[3].classList.contains('near-rabbit'),true);
  b.advance(1200); assert.equal(b.nodes['#grasses'].children[3].classList.contains('near-rabbit'),false);
});
test('help closes with Escape and returns focus', async () => {
  const b=boot(); await b.nodes['#help-toggle'].fire('click'); assert.equal(b.nodes['#help-panel'].hidden,false);
  await b.doc.fire('keydown',{key:'Escape'}); assert.equal(b.nodes['#help-panel'].hidden,true); assert.equal(b.nodes['#help-toggle'].focused,true);
});
test('unsupported and rejected fullscreen show feedback without breaking interaction', async () => {
  const b=boot(); await b.nodes['#fullscreen'].fire('click'); assert.equal(b.nodes['#toast'].hidden,false);
  b.nodes['#artwork'].requestFullscreen=async()=>{throw new Error('denied');};
  await b.nodes['#fullscreen'].fire('click'); assert.match(b.nodes['#toast'].textContent,/전환하지 못/);
  await b.deer.fire('click'); assert.equal(b.deer.dataset.state,'reacting');
});
test('missing forest asset displays a message and leaves creatures functional', async () => {
  const b=boot(); await b.nodes['.forest'].fire('error'); assert.equal(b.nodes['#asset-warning'].hidden,false);
  await b.rabbit.fire('click'); assert.equal(b.rabbit.dataset.state,'reacting');
});
test('artist duration changes apply to state lifetime', async () => {
  const b=boot(); b.css['--deer-duration']='3s'; await b.deer.fire('click'); b.advance(2000); assert.equal(b.deer.dataset.state,'reacting'); b.advance(1000); assert.equal(b.deer.dataset.state,'idle');
});
