/* Page motion and small controls: language switch, menu, corner timecode and clock, smooth wheel,
   the hero's entrance, reveals, the 3D project ring, parallax and the closing name.
   Needs gsap + ScrollTrigger + Lenis loaded first. Under reduced motion everything rests. */
(function () {
  var root = document.documentElement;

  /* ---- controls that work with or without motion ---- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang-toggle]'); if (!b) return;
    var l = root.dataset.uilang === 'zh' ? 'en' : 'zh';
    root.dataset.uilang = l; root.lang = l === 'zh' ? 'zh-Hans' : 'en';
    try { localStorage.setItem('zh-ui', l); } catch (err) {}
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  });
  var menuBtn = document.querySelector('[data-menu]'), menu = document.getElementById('menu');
  function setMenu(open) {
    if (!menu) return;
    menu.classList.toggle('is-open', open); menuBtn.setAttribute('aria-expanded', open);
    if (open) { var f = menu.querySelector('a'); f && setTimeout(function () { f.focus(); }, 300); }
    if (window.__lenis) open ? window.__lenis.stop() : window.__lenis.start();
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); });
  if (menu) menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu && menu.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); } });
  var clock = document.querySelector('[data-clock]');
  function tick() { try { clock.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date()); } catch (e) {} }
  if (clock) { tick(); setInterval(tick, 30000); }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-hover-play]').forEach(function (v) {
    if (reduce) return;
    var card = v.closest('a') || v;
    card.addEventListener('pointerenter', function () { v.play().catch(function () {}); });
    card.addEventListener('pointerleave', function () { v.pause(); });
  });

  if (!window.gsap || !window.ScrollTrigger || reduce) { root.classList.add('sm-still'); return; }
  root.classList.add('sm-on');
  gsap.registerPlugin(ScrollTrigger);
  var wideQ = matchMedia('(min-width: 768px)'), wide = wideQ.matches;
  /* the rings and the 3D timeline are built for the width the page loaded at; crossing the
     phone breakpoint rebuilds the page so they appear (or step aside) */
  wideQ.addEventListener('change', function () { location.reload(); });

  /* ---- smooth wheel ---- */
  if (window.Lenis) {
    var lenis = window.__lenis = new Lenis({ duration: 1.2, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href'); if (id.length < 2) return;
        var el = document.querySelector(id); if (!el) return;
        e.preventDefault(); lenis.scrollTo(el, { duration: 1.6 });
      });
    });
  }

  /* ---- corner timecode: the scroll read as film time ---- */
  var tc = document.querySelector('[data-tc]');
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  if (tc) ScrollTrigger.create({ start: 0, end: 'max', onUpdate: function (s) {
    var f = Math.round(s.scroll() / 6), sec = Math.floor(f / 25);
    tc.textContent = '00:' + pad(Math.floor(sec / 60)) + ':' + pad(sec % 60) + ':' + pad(f % 25);
  } });

  /* ---- hero: the lines rise out of their masks, the orb swells in, the tiles follow ---- */
  var hx = document.querySelector('.hx');
  if (hx) {
    var intro = gsap.timeline({ delay: .15 });
    intro.from(hx.querySelector('.hx__orb'), { scale: .55, opacity: 0, duration: 2.2, ease: 'expo.out' }, 0)
         .from(hx.querySelectorAll('h1 .ln > span'), { yPercent: 115, duration: 1.4, ease: 'expo.out', stagger: .12 }, .1)
         .from(hx.querySelectorAll('.tile'), { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: .08 }, .55)
         .from([hx.querySelector('.hx__lead'), hx.querySelector('.hx__btns')], { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: .1 }, .8)
         .from('.top, .corner', { opacity: 0, duration: 1.2, ease: 'power2.out' }, .4);
    gsap.timeline({ scrollTrigger: { trigger: hx, start: 'top top', end: 'bottom top', scrub: .6 } })
      .to(hx.querySelector('.hx__orb'), { yPercent: -30, scale: 1.25, opacity: .3, ease: 'none' }, 0)
      .to(hx.querySelector('h1'), { yPercent: -25, ease: 'none' }, 0)
      .to(hx.querySelector('.hx__tiles'), { yPercent: -10, opacity: .2, ease: 'none' }, 0);
  }

  /* ---- headings rise out of a mask; text and pictures arrive with their section ---- */
  gsap.utils.toArray('main section:not(.hx) h2, .fx h2').forEach(function (h) {
    gsap.fromTo(h, { clipPath: 'inset(0 0 100% 0)', y: 60 }, { clipPath: 'inset(0 0 0% 0)', y: 0, duration: 1.3, ease: 'expo.out', clearProps: 'clipPath,transform',
      scrollTrigger: { trigger: h, start: 'top 90%', once: true } });
  });
  gsap.utils.toArray('.section-head p, #about .rows > li, .stack-icons > *').forEach(function (p, i) {
    gsap.from(p, { y: 30, opacity: 0, duration: 1, ease: 'expo.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: p, start: 'top 92%', once: true } });
  });
  gsap.utils.toArray('.reel, .about-photos img').forEach(function (el, i) {
    gsap.fromTo(el, { clipPath: 'inset(100% 0 0 0 round 22px)' }, { clipPath: 'inset(0% 0 0 0 round 22px)', duration: 1.4, ease: 'expo.inOut', delay: (i % 4) * .08, clearProps: 'clipPath',
      scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
  });

  /* ---- the ring: five cards on a cylinder that turns as you scroll through the section ---- */
  if (wide) document.querySelectorAll('[data-ring]').forEach(function (ring) {
    var sec = ring.closest('section'); if (sec.id === 'path') return;   /* timeline.js draws this one */
    var cards = gsap.utils.toArray(ring.querySelectorAll('.pcard'));
    var w = cards[0].offsetWidth, gap = sec.classList.contains('wheel--time') ? 28 : 40;
    var r = Math.max(1000, w * (sec.classList.contains('wheel--time') ? 3.2 : 2));
    var step = (2 * Math.asin((w / 2 + gap) / r)) * 180 / Math.PI;
    ring.style.setProperty('--r', r + 'px');
    cards.forEach(function (c, i) { c.style.setProperty('--a', (i * step) + 'deg'); });
    var n = sec.querySelector('[data-wheel-n]'), last = cards.length - 1;
    /* each card holds in the middle for the first and last 30% of its stretch of scroll and turns
       to the next only in between; the ring then eases toward that point, so it never races */
    var target = 0, cur = 0;
    function dwell(x) { var i = Math.floor(x), f = x - i, k = Math.min(1, Math.max(0, (f - .3) / .4)); return i + k * k * (3 - 2 * k); }
    ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom',
      onUpdate: function (s) { target = dwell(s.progress * last); } });
    gsap.ticker.add(function () {
      if (Math.abs(target - cur) < .0005) return;
      cur += (target - cur) * .08;
      ring.style.setProperty('--rot', (-cur * step) + 'deg');
      cards.forEach(function (c, i) { var d = Math.abs(i - cur); c.style.opacity = Math.max(.35, 1 - d * .4); });
      if (n) n.textContent = pad(Math.round(cur) + 1);
    });
    ring.style.setProperty('--rot', '0deg');
    gsap.from(sec.querySelector('.wheel__floor'), { opacity: 0, duration: 1.5, scrollTrigger: { trigger: sec, start: 'top 70%', once: true } });
  });

  /* ---- MovieLingo: the shorts drift at different speeds ---- */
  if (wide) {
    var drift = [-70, 35, -35, 70];
    gsap.utils.toArray('#movielingo .reel').forEach(function (r, i) {
      gsap.fromTo(r, { y: drift[i] }, { y: -drift[i], ease: 'none', scrollTrigger: { trigger: '#movielingo', start: 'top bottom', end: 'bottom top', scrub: .8 } });
    });
  }

  /* ---- the closing name: its characters stand up one after another ---- */
  var word = document.querySelector('.fx__name');
  if (word && !word.dataset.split) {
    word.dataset.split = '1';
    var chars = Array.from(word.textContent.trim()); word.textContent = '';
    chars.forEach(function (c) { var s = document.createElement('span'); s.className = 'cw'; s.textContent = c; word.appendChild(s); });
    gsap.from(word.querySelectorAll('.cw'), { yPercent: 105, duration: 1.4, ease: 'expo.out', stagger: .1, scrollTrigger: { trigger: word, start: 'top 95%', once: true } });
  }

  addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
