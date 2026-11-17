/* The timeline, after jesperlandberg.com: milestones as curved screens standing on a grid floor.
   Scrolling through the section slides them past (with inertia); the one in the middle is the
   current milestone, its date and words under it, and a ruler of months slides along below.
   Falls back to the plain card list on phones, without WebGL, or under reduced motion. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const sec = document.getElementById('path');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wide = matchMedia('(min-width: 768px)').matches;
const ok = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } })();

if (sec && wide && !reduce && ok) start();

function start() {
  const items = [...sec.querySelectorAll('.tcard')].map((c) => ({
    date: c.querySelector('.tcard__date').textContent.trim(),
    month: c.dataset.month, fy: c.dataset.fy ? +c.dataset.fy : .78,
    img: c.querySelector('img')?.getAttribute('src') || null,
    video: c.dataset.video || null, fit: c.dataset.fit || 'cover',
    title: c.querySelector('h3'),
    body: c.querySelector('p'),
  }));
  sec.classList.add('tl3d');

  /* stage, overlay and ruler (DOM) */
  const stage = sec.querySelector('.wheel__stage');
  const canvas = document.createElement('canvas'); canvas.className = 'tl3d__canvas'; stage.prepend(canvas);
  const cap = document.createElement('div'); cap.className = 'tl3d__cap'; cap.innerHTML = '<span class="tl3d__date"></span><h3></h3><p></p>'; stage.appendChild(cap);
  const ruler = document.createElement('div'); ruler.className = 'tl3d__ruler';
  ruler.innerHTML = '<div class="tl3d__track"></div><i class="tl3d__mark"></i>'; stage.appendChild(ruler);
  const track = ruler.querySelector('.tl3d__track');
  const months = []; for (let y = 2025; y <= 2026; y++) for (let m = 1; m <= 12; m++) months.push(`${y}-${String(m).padStart(2, '0')}`);
  const MW = 64;   // px per month on the ruler
  months.forEach((mo, i) => {
    const t = document.createElement('span'); t.className = 'tl3d__tick' + (mo.endsWith('-01') ? ' is-year' : '');
    t.style.left = i * MW + 'px'; if (mo.endsWith('-01')) t.textContent = mo.slice(0, 4); track.appendChild(t);
  });
  items.forEach((it, i) => {
    const d = document.createElement('b'); d.className = 'tl3d__dot'; d.style.left = months.indexOf(it.month) * MW + 'px'; d.dataset.i = i; track.appendChild(d);
  });

  /* three.js scene */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 9, 22);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  camera.position.set(0, .35, 0); camera.lookAt(0, .1, -10);

  /* the floor grid */
  const grid = new THREE.GridHelper(80, 64, 0x2a2a2a, 0x2a2a2a);
  grid.position.y = -1.85; grid.material.transparent = true; grid.material.opacity = .9; scene.add(grid);

  /* the cards: planes bent onto a cylinder around the camera, so each one curves like a screen */
  const R = 9, CW = 4.5, CH = 2.9, GAP = .55;
  const step = (CW + GAP) / R;                       // angle per card
  const ring = new THREE.Group(); scene.add(ring);
  const loader = new THREE.TextureLoader();
  const cards = items.map((it, i) => {
    const g = new THREE.PlaneGeometry(CW, CH, 48, 1);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), a = x / R;
      p.setX(k, Math.sin(a) * R); p.setZ(k, -Math.cos(a) * R + R);
    }
    g.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 1, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, mat);
    const holder = new THREE.Group(); holder.rotation.y = -i * step; mesh.position.z = -R; mesh.position.y = .25; holder.add(mesh); ring.add(holder);
    texFor(it).then((tex) => { if (!tex) return; mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; });
    return { mesh, mat };
  });

  function cover(tex, w, h, fy = .78) {          // crop a picture to the card's shape, like object-fit: cover
    const ar = CW / CH, ir = w / h;
    tex.colorSpace = THREE.SRGBColorSpace;
    if (ir > ar) { tex.repeat.set(ar / ir, 1); tex.offset.set((1 - ar / ir) / 2, 0); }
    else { tex.repeat.set(1, ir / ar); tex.offset.set(0, (1 - ir / ar) * fy); }   /* tall pictures keep their top: faces */
    return tex;
  }
  function texFor(it) {
    if (it.video) {
      const v = document.createElement('video'); Object.assign(v, { src: it.video, muted: true, loop: true, playsInline: true, crossOrigin: 'anonymous' });
      v.setAttribute('muted', ''); it.el = v;
      if (it.fit === 'contain') return containVideo(it, v);
      return new Promise((res) => { v.addEventListener('loadedmetadata', () => res(cover(new THREE.VideoTexture(v), v.videoWidth, v.videoHeight, it.fy)), { once: true }); v.load(); });
    }
    if (it.img) return new Promise((res) => loader.load(it.img, (t) => res(cover(t, t.image.width, t.image.height, it.fy)), undefined, () => res(null)));
    return document.fonts.ready.then(() => typeCard(it));
  }
  /* a tall video on a wide card: the whole video in the middle, a blurred, darkened copy filling the
     sides (the copy is drawn tiny and stretched back up, which blurs it for free). Redrawn each frame
     while it plays. */
  function containVideo(it, v) {
    const c = document.createElement('canvas'); c.width = 1400; c.height = Math.round(1400 * CH / CW);
    const x = c.getContext('2d'), sm = document.createElement('canvas'); sm.width = 28; sm.height = 18;
    const sx = sm.getContext('2d'); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const draw = () => {
      if (!v.videoWidth) return;
      const vr = v.videoWidth / v.videoHeight, sh = sm.width / vr;
      sx.drawImage(v, 0, (sm.height - sh) / 2, sm.width, sh);
      x.imageSmoothingEnabled = true; x.drawImage(sm, 0, 0, c.width, c.height);
      x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, 0, c.width, c.height);
      const h = c.height, w = h * vr; x.drawImage(v, (c.width - w) / 2, 0, w, h);
      tex.needsUpdate = true;
    };
    it.draw = draw;
    return new Promise((res) => {
      v.addEventListener('loadeddata', () => { draw(); res(tex); }, { once: true });
      v.preload = 'auto'; v.load();
    });
  }
  function typeCard(it) {              // a milestone with no picture: its year and title set large
    const c = document.createElement('canvas'); c.width = 1600; c.height = Math.round(1600 * CH / CW);
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(400, 200, 50, 800, 520, 1100); gr.addColorStop(0, '#22305a'); gr.addColorStop(.55, '#0c0f1c'); gr.addColorStop(1, '#050505');
    x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < c.width; i += 80) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, c.height); x.stroke(); }
    x.fillStyle = '#ffffff'; x.font = 'italic 400 360px "Instrument Serif", serif'; x.textBaseline = 'alphabetic';
    x.fillText(it.date.split(' ').pop(), 90, 520);
    x.font = '400 92px "Instrument Serif", "Noto Serif SC", serif'; x.fillStyle = '#e8e8e8';
    x.fillText(it.title.querySelector('.l-en')?.textContent || it.title.textContent, 96, 800);
    x.font = '500 34px "DM Mono", monospace'; x.fillStyle = '#8fa2ff'; x.fillText(it.date.toUpperCase(), 100, 880);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  /* size */
  function size() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 1.4 ? 48 : 38; camera.updateProjectionMatrix();
  }
  size(); addEventListener('resize', size);

  /* scroll: progress through the section sets where the ring should be; the ring eases there */
  let target = 0, cur = 0, active = -1, visible = false, raf = 0;
  const last = items.length - 1;
  function readScroll() {
    const r = sec.getBoundingClientRect(), span = sec.offsetHeight - innerHeight;
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, span)));
    target = p * last;
  }
  addEventListener('scroll', readScroll, { passive: true }); readScroll();
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible && !raf) loop(); }, { rootMargin: '200px' }).observe(sec);

  /* pointer: the camera leans a little toward it */
  let mx = 0, my = 0; stage.addEventListener('pointermove', (e) => { const r = stage.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - .5; my = (e.clientY - r.top) / r.height - .5; });

  function setActive(i) {
    if (i === active) return; active = i; const it = items[i];
    cap.classList.remove('is-in'); void cap.offsetWidth;
    cap.querySelector('.tl3d__date').textContent = it.date;
    cap.querySelector('h3').innerHTML = it.title.innerHTML; cap.querySelector('p').innerHTML = it.body.innerHTML;
    cap.classList.add('is-in');
    track.querySelectorAll('.tl3d__dot').forEach((d) => d.classList.toggle('is-on', +d.dataset.i === i));
    const n = sec.querySelector('[data-wheel-n]'); if (n) n.textContent = String(i + 1).padStart(2, '0');
    items.forEach((x, k) => { if (x.el) (k === i ? x.el.play().catch(() => {}) : x.el.pause()); });
  }

  function loop() {
    raf = 0; if (!visible) return;
    cur += (target - cur) * .075;
    ring.rotation.y = cur * step;
    camera.position.x += (mx * .6 - camera.position.x) * .05;
    camera.position.y += (.35 - my * .3 - camera.position.y) * .05;
    camera.lookAt(camera.position.x * .3, .1, -10);
    grid.position.z = (cur * 1.6) % (80 / 64);        // the floor drifts with the slide
    cards.forEach((c, i) => {                           // the cards away from the middle dim
      const d = Math.abs(i - cur); c.mat.opacity = Math.max(.25, 1 - d * .45);
      c.mesh.position.y = .25 - Math.min(.4, d * d * .06);
    });
    setActive(Math.round(cur));
    const front = items[active]; if (front.draw && front.el && !front.el.paused) front.draw();
    /* the ruler: the current point in time sits under the mark */
    const a = Math.floor(cur), b = Math.min(last, a + 1), f = cur - a;
    const ma = months.indexOf(items[a].month), mb = months.indexOf(items[b].month);
    track.style.transform = `translateX(${-(ma + (mb - ma) * f) * MW}px)`;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  loop();
}
