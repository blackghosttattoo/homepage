// 블랙고스트 홈페이지 공용 스크립트
// - 관리 페이지(login.html)에서 고친 문구를 페이지에 적용
// - 홈페이지 아티스트 목록을 창고(Firestore)의 내용으로 바꾸고, 사진을 누르면 '아티스트 창'을 띄움
// 손님 페이지는 무거운 Firebase 프로그램 없이 주소(REST)로 읽기만 합니다.
(function () {
  var KEY = 'AIzaSyBINWTCD_JCGidza1sCvHozaS6YyDIinPQ';
  var BASE = 'https://firestore.googleapis.com/v1/projects/blackghost-homepage/databases/(default)/documents/';
  var KAKAO = 'https://open.kakao.com/o/sLedaTNb';

  function val(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('mapValue' in v) return fields(v.mapValue.fields);
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
    return null;
  }
  function fields(f) { var o = {}; for (var k in (f || {})) o[k] = val(f[k]); return o; }
  function get(path) {
    return fetch(BASE + path + (path.indexOf('?') < 0 ? '?' : '&') + 'key=' + KEY)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function list(path) {
    return get(path + '?pageSize=100').then(function (j) {
      return (j.documents || []).map(function (d) {
        var o = fields(d.fields); o.id = d.name.split('/').pop(); return o;
      });
    });
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // 글자 → 화면용: **굵게**, 줄바꿈
  function rich(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }

  // ---- 1. 고친 문구 적용 (지난번 내용을 먼저 바로 보여 주고, 새 내용이 오면 바꿈) ----
  function applyTexts(t) {
    document.querySelectorAll('[data-edit]').forEach(function (el) {
      var k = el.getAttribute('data-edit');
      if (!el.hasAttribute('data-orig')) el.setAttribute('data-orig', el.innerHTML);
      var v = t && t[k];
      el.innerHTML = (typeof v === 'string' && v.trim()) ? rich(v) : el.getAttribute('data-orig');
    });
  }
  try { var c = JSON.parse(localStorage.getItem('bg-texts') || 'null'); if (c) applyTexts(c); } catch (e) {}
  get('site/texts').then(function (j) {
    var t = fields(j.fields).texts || {};
    applyTexts(t);
    try { localStorage.setItem('bg-texts', JSON.stringify(t)); } catch (e) {}
  }).catch(function () {});

  // ---- 2. 아티스트 (홈페이지에만 있음) ----
  var box = document.querySelector('.artists');
  if (!box) return;
  var IG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none"></circle></svg>';
  var data = {}; // id → 아티스트 정보

  // 처음 HTML에 들어 있는 카드에서 정보 읽기 (창고가 비었거나 안 열릴 때 그대로 씀)
  Array.prototype.forEach.call(box.querySelectorAll('.artist'), function (a) {
    var img = a.querySelector('img'), id = (img.getAttribute('src').match(/([a-z0-9_-]+)\.jpg/) || [])[1];
    var lab = a.querySelector('.ph').getAttribute('aria-label') || '';
    data[id] = { id: id, en: a.querySelector('h3').textContent, ko: (lab.match(/^([^(]+)\(/) || [])[1] || '',
      genre: a.querySelector('.meta p').textContent, ig: a.querySelector('.ig').href, cover: img.getAttribute('src'), bio: '' };
    a.setAttribute('data-id', id);
  });

  function card(d) {
    var ko = d.ko || d.en, el = document.createElement('article');
    el.className = 'artist'; el.setAttribute('data-id', d.id);
    el.innerHTML = '<a class="ph" href="' + esc(d.ig || '#') + '" target="_blank" rel="noopener" aria-label="' + esc(ko + '(' + d.en + ') 아티스트 창 열기') + '">' +
      (d.cover ? '<img src="' + esc(d.cover) + '" alt="' + esc(d.en) + ' 대표 사진" width="560" height="700" loading="lazy">' : '') + '</a>' +
      '<div class="meta"><div style="min-width: 0"><h3>' + esc(d.en) + '</h3><p>' + esc(d.genre || '') + '</p></div>' +
      (d.ig ? '<a class="ig" href="' + esc(d.ig) + '" target="_blank" rel="noopener" aria-label="' + esc(ko) + ' 인스타그램 (새 창)">' + IG + '</a>' : '') + '</div>';
    return el;
  }

  list('artists').then(function (rows) {
    rows = rows.filter(function (r) { return !r.hidden && r.en; });
    if (!rows.length) return;
    data = {};
    rows.forEach(function (r) { r.cover = r.cover || r.coverUrl || ''; data[r.id] = r; });
    for (var i = rows.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = rows[i]; rows[i] = rows[j]; rows[j] = t; }
    var shown = box.querySelector('.rv.in') || !document.documentElement.classList.contains('js-rv');
    box.innerHTML = '';
    rows.forEach(function (r) { var el = card(r); if (document.documentElement.classList.contains('js-rv')) el.className += ' rv' + (shown ? ' in' : ''); box.appendChild(el); });
  }).catch(function () {});

  // ---- 아티스트 창 ----
  var css = document.createElement('style');
  css.textContent =
    '.am{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.82);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}' +
    '.am.open{display:flex}' +
    '.am-box{position:relative;width:min(100%,920px);max-height:calc(100vh - 40px);overflow:auto;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);background:#0B0B0C;border:1px solid #26252A}' +
    '.am-x{position:absolute;top:10px;right:10px;z-index:2;width:44px;height:44px;border:1px solid #3A3936;border-radius:999px;background:rgba(0,0,0,.6);color:#F2EFEA;font-size:22px;line-height:1;cursor:pointer}' +
    '.am-x:hover{border-color:#E7E3DC}' +
    '.am-ph{position:relative;background:#000;min-width:0}' +
    '.am-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;aspect-ratio:4/5}' +
    '.am-track::-webkit-scrollbar{display:none}' +
    '.am-track img{flex:0 0 100%;width:100%;height:100%;object-fit:contain;scroll-snap-align:start;display:block}' +
    '.am-nav{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;border:1px solid #3A3936;border-radius:999px;background:rgba(0,0,0,.55);color:#F2EFEA;font-size:18px;cursor:pointer}' +
    '.am-nav:hover{border-color:#E7E3DC}.am-prev{left:10px}.am-next{right:10px}' +
    '.am-cnt{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);padding:2px 12px;border-radius:999px;background:rgba(0,0,0,.6);font:11px Michroma,sans-serif;letter-spacing:.16em;color:#CFCAC1}' +
    '.am-txt{padding:36px 30px;display:flex;flex-direction:column;gap:14px;min-width:0}' +
    '.am-txt h3{margin:0;font:400 24px Michroma,sans-serif;letter-spacing:.12em;color:#F2EFEA}' +
    '.am-genre{margin:0;color:#9C978F;font-size:14px}' +
    '.am-bio{margin:6px 0 0;color:#CFCAC1;font-size:15px;white-space:pre-line}' +
    '.am-txt .btns{margin-top:auto;padding-top:14px}' +
    '@media (max-width:640px){.am{padding:0;align-items:flex-end}.am-box{grid-template-columns:1fr;max-height:92vh;border-width:1px 0 0}.am-txt{padding:24px 20px 28px}.am-txt h3{font-size:20px}.am-nav{display:none}.am-track{aspect-ratio:auto;height:min(110vw,56vh)}}';
  document.head.appendChild(css);
  var m = document.createElement('div');
  m.className = 'am'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'am-name');
  m.innerHTML = '<div class="am-box"><button type="button" class="am-x" aria-label="닫기">×</button>' +
    '<div class="am-ph"><div class="am-track"></div><button type="button" class="am-nav am-prev" aria-label="이전 사진">‹</button><button type="button" class="am-nav am-next" aria-label="다음 사진">›</button><span class="am-cnt"></span></div>' +
    '<div class="am-txt"><div class="eyebrow"><span></span>ARTIST</div><h3 id="am-name"></h3><p class="am-genre"></p><p class="am-bio"></p>' +
    '<div class="btns"><a class="btn btn-solid am-ig" target="_blank" rel="noopener">인스타그램에서 작업물 보기</a><a class="btn" href="' + KAKAO + '" target="_blank" rel="noopener">카카오톡 예약 문의</a></div></div></div>';
  document.body.appendChild(m);
  var track = m.querySelector('.am-track'), cnt = m.querySelector('.am-cnt'), back = null, cur = null;

  function pics(srcs, name) {
    track.innerHTML = '';
    srcs.forEach(function (s, i) { var im = new Image(); im.src = s; im.alt = name + ' 사진 ' + (i + 1); track.appendChild(im); });
    var many = srcs.length > 1;
    m.querySelectorAll('.am-nav').forEach(function (b) { b.style.display = many ? '' : 'none'; });
    cnt.style.display = many ? '' : 'none';
    count();
  }
  function count() { var n = track.children.length, i = Math.round(track.scrollLeft / (track.clientWidth || 1)); cnt.textContent = (i + 1) + ' / ' + n; }
  track.addEventListener('scroll', count, { passive: true });
  function go(dir) { track.scrollBy({ left: dir * track.clientWidth, behavior: 'smooth' }); }
  m.querySelector('.am-prev').onclick = function () { go(-1); };
  m.querySelector('.am-next').onclick = function () { go(1); };

  function open(id) {
    var d = data[id]; if (!d) return false;
    cur = id; back = document.activeElement;
    m.querySelector('#am-name').textContent = d.en;
    m.querySelector('.am-genre').textContent = d.genre || '';
    m.querySelector('.am-bio').textContent = d.bio || '';
    var ig = m.querySelector('.am-ig');
    if (d.ig) { ig.href = d.ig; ig.style.display = ''; } else ig.style.display = 'none';
    pics(d.cover ? [d.cover] : [], d.en);
    m.classList.add('open'); document.body.style.overflow = 'hidden';
    m.querySelector('.am-x').focus();
    list('artists/' + id + '/photos').then(function (ph) {
      if (cur !== id) return;
      ph.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      var s = ph.map(function (p) { return p.data; }).filter(Boolean);
      if (s.length) pics(s, d.en);
    }).catch(function () {});
    return true;
  }
  function close() {
    m.classList.remove('open'); document.body.style.overflow = ''; cur = null;
    if (back && back.focus) back.focus();
  }
  m.querySelector('.am-x').onclick = close;
  m.addEventListener('click', function (e) { if (e.target === m) close(); });
  document.addEventListener('keydown', function (e) {
    if (!m.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  });
  // 사진을 누르면 아티스트 창 (인스타 아이콘은 그대로 인스타로)
  box.addEventListener('click', function (e) {
    var ph = e.target.closest('.ph'); if (!ph) return;
    var a = ph.closest('.artist');
    if (a && open(a.getAttribute('data-id'))) e.preventDefault();
  });
})();
