/* TU GTEP — 히어로 사진 슬라이드(3초마다 옆으로), 전체 메뉴 */
(function () {
  var INTERVAL = 3000;
  document.querySelectorAll('[data-slider]').forEach(function (h) {
    var t = h.querySelector('.track'), s = [].slice.call(t.children), n = s.length, i = 0, paused = false, tm;
    if (n < 2) return;
    t.appendChild(s[0].cloneNode(true)); // 마지막 다음에 첫 장을 이어 붙여 끊김 없이 반복
    var cnt = h.querySelector('.count b'), bar = h.querySelector('.prog i'),
        cs = h.querySelector('.cap small'), ct = h.querySelector('.cap span'), pb = h.querySelector('[data-pause]');
    function ui() {
      var k = i % n;
      cnt.textContent = ('0' + (k + 1)).slice(-2);
      cs.textContent = s[k].dataset.place; ct.textContent = s[k].dataset.cap;
      bar.classList.remove('run'); void bar.offsetWidth; if (!paused) bar.classList.add('run');
    }
    function go(k, anim) { t.style.transition = anim === false ? 'none' : ''; i = k; t.style.transform = 'translateX(' + (-100 * i) + '%)'; ui(); }
    t.addEventListener('transitionend', function () { if (i === n) go(0, false); });
    function next() { if (i >= n) { go(0, false); void t.offsetWidth; } go(i + 1); }
    function prev() { if (i === 0) { go(n, false); void t.offsetWidth; } go(i - 1); }
    function start() { clearInterval(tm); tm = setInterval(function () { if (!paused && !document.hidden) next(); }, INTERVAL); }
    h.querySelector('[data-next]').addEventListener('click', function () { next(); start(); });
    h.querySelector('[data-prev]').addEventListener('click', function () { prev(); start(); });
    pb.addEventListener('click', function () {
      paused = !paused; pb.textContent = paused ? '▶' : '❚❚';
      pb.setAttribute('aria-label', paused ? '자동 넘김 시작' : '자동 넘김 멈춤'); ui();
    });
    ui(); start();
  });
  // 상단 메뉴에 마우스를 올리거나 키보드로 들어가면 전체 하위 메뉴가 펼쳐짐
  document.querySelectorAll('.tg-header').forEach(function (hd) {
    var gnb = hd.querySelector('.tg-gnb'), timer;
    if (!gnb) return;
    function open() { clearTimeout(timer); hd.classList.add('mega'); }
    function close() { timer = setTimeout(function () { hd.classList.remove('mega'); }, 250); }
    // 하위 메뉴가 있는 메뉴에만 펼침 (자료실처럼 하위 메뉴가 없으면 펼치지 않음)
    gnb.querySelectorAll('.item').forEach(function (it) {
      it.addEventListener('mouseenter', function () { if (it.querySelector('.sub')) open(); else { clearTimeout(timer); hd.classList.remove('mega'); } });
    });
    hd.addEventListener('mouseleave', close);
    hd.addEventListener('mouseenter', function () { if (hd.classList.contains('mega')) clearTimeout(timer); });
    gnb.addEventListener('focusin', function (e) { if (e.target.closest('.item') && e.target.closest('.item').querySelector('.sub')) open(); });
    hd.addEventListener('focusout', function (e) { if (!hd.contains(e.relatedTarget)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hd.classList.remove('mega'); });
  });
  var menu = document.querySelector('.tg-allmenu');
  document.querySelectorAll('[data-menu]').forEach(function (b) {
    b.addEventListener('click', function () { menu.classList.toggle('open'); });
  });
  if (menu) menu.addEventListener('click', function (e) { if (e.target === menu) menu.classList.remove('open'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu) menu.classList.remove('open'); });
})();
