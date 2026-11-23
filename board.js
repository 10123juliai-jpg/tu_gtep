/* TU GTEP 게시판 엔진 — 코딩 없이 홈페이지에서 관리
   · 로그인/회원가입/비밀번호 찾기, 자료실(로그인 필요), 공지사항·보도자료·FAQ 게시판, 관리자 업로드·수정·삭제,
     홈 화면 최신 공지, 구글 캘린더, 관리자 페이지(admin.html)
   · firebase-config.js에 설정값이 없으면 "데모 모드": 아무 정보나 넣어도 로그인, 이메일에 admin 이면 관리자 체험
     (데모에서 바꾼 내용은 그 브라우저에만 저장). 설정값을 넣으면 Firebase로 실제 저장되어 모든 방문자에게 반영
   · 일반 스크립트라 파일을 더블클릭해 열어도 동작 */
(async () => {
'use strict';
const CFG = window.TG_FIREBASE || {}, SEED = window.TG_SEED || {};
const ADMINS = (CFG.admins || []).map(e => String(e).toLowerCase());
const DEMO = !CFG.config || !CFG.config.apiKey;
const MAX_FILE = 700 * 1024;
const BOARDS = {
  notices: { label: '공지사항', tabs: [['공지', '공지'], ['모집', '모집'], ['활동', '활동'], ['성과', '성과']], fields: ['tab', 'date', 'title', 'body', 'link', 'file'] },
  press: { label: '보도자료', fields: ['date', 'title', 'body', 'link', 'image'], bodyLabel: '한 줄 설명 (예: 인도 · 2026)' },
  faq: { label: 'FAQ', fields: ['order', 'title', 'body', 'link'], titleLabel: '질문', bodyLabel: '답변' },
  events: { label: '사업단 일정', fields: ['date', 'title', 'body', 'link'], titleLabel: '일정 이름', bodyLabel: '장소·시간·내용' },
  vault: { label: '자료실', private: true, tabs: [['notice', '공지사항'], ['forms', '서식'], ['expo', '전시회'], ['ecom', '전자상거래']], fields: ['tab', 'date', 'title', 'body', 'link', 'file'] },
};
const TAGCLASS = { 공지: '', 모집: 'signal', 활동: 'act', 성과: 'out' };
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nl = s => esc(s).replace(/\n/g, '<br>');
const safeLink = s => (s && !/^\s*(javascript|data):/i.test(s) ? s : '');
const isExternal = s => /^https?:\/\//i.test(s || '');
const el = (f, n) => f.elements.namedItem(n);
const val = (f, n) => (el(f, n)?.value || '').trim();
const IC = '<span class="tg-ic"></span>';
const byDate = (a, b) => (b.date || '').localeCompare(a.date || '') || ts(b) - ts(a);
const ts = x => x.createdAt?.seconds || x.createdAt || 0;
const sorter = name => (name === 'faq' ? (a, b) => (+a.order || 999) - (+b.order || 999) || ts(a) - ts(b)
  : name === 'events' ? (a, b) => (a.date || '').localeCompare(b.date || '') || ts(a) - ts(b) : byDate);   // 일정은 날짜 빠른 순
const imgSrc = im => (!im ? '' : im.url || `data:${im.type};base64,${im.data}`);

const needsAuth = $('[data-gate],[data-board-view],[data-post-view],[data-latest],[data-calendar],[data-whobar]');
if (!needsAuth) return;

// ================= 저장소 · 로그인 (데모 / Firebase) =================
let store, auth, user = null;
const listeners = [];
const emit = () => listeners.forEach(f => f(user));
if (DEMO) {
  const key = b => 'tg-demo-' + b, SKEY = 'tg-demo-settings', UKEY = 'tg-demo-user';
  const base = b => (SEED[b] || []).map((d, i) => ({ id: b[0] + i, ...d }));
  const read = b => { try { const s = localStorage.getItem(key(b)); return s ? JSON.parse(s) : base(b); } catch (x) { return base(b); } };
  const write = (b, arr) => { try { localStorage.setItem(key(b), JSON.stringify(arr)); } catch (x) { throw { code: 'demo/full' }; } };
  store = {
    list: async b => read(b),
    add: async (b, d) => { const arr = read(b), id = 'u' + Date.now(); arr.push({ id, ...d, createdAt: Date.now() }); write(b, arr); return id; },
    update: async (b, id, d) => write(b, read(b).map(i => (i.id === id ? { ...i, ...d } : i))),
    remove: async (b, id) => write(b, read(b).filter(i => i.id !== id)),
    settings: async () => { try { return JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch (x) { return {}; } },
    saveSettings: async s => { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (x) {} },
    users: async () => null,
    resetDemo: () => { Object.keys(BOARDS).forEach(b => { try { localStorage.removeItem(key(b)); } catch (x) {} }); },
    ko: e => (e && e.code === 'demo/full' ? '저장 공간이 가득 찼습니다. 더 작은 파일로 올려 주세요.' : '문제가 생겼습니다.'),
  };
  const nameOf = em => (String(em).split('@')[0] || '').trim() || '방문자';
  const set = u => { user = u; try { u ? sessionStorage.setItem(UKEY, JSON.stringify(u)) : sessionStorage.removeItem(UKEY); } catch (x) {} emit(); };
  auth = {
    login: async (email) => set({ name: nameOf(email), email, admin: /^admin$/i.test(nameOf(email)) || ADMINS.includes(String(email).toLowerCase()), verified: true }),
    signup: async (name, email) => set({ name: name || nameOf(email), email, admin: /^admin$/i.test(nameOf(email)), verified: true }),
    reset: async () => { throw { code: 'demo/reset' }; },
    logout: async () => set(null),
  };
  try { user = JSON.parse(sessionStorage.getItem(UKEY) || 'null'); } catch (x) {}
  setTimeout(emit);
} else {
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const [{ initializeApp }, A, F] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
  const app = initializeApp(CFG.config), fa = A.getAuth(app), db = F.getFirestore(app);
  fa.languageCode = 'ko';
  const KO = {
    'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않습니다.', 'auth/wrong-password': '이메일 또는 비밀번호가 맞지 않습니다.',
    'auth/user-not-found': '이메일 또는 비밀번호가 맞지 않습니다.', 'auth/invalid-email': '이메일 주소 형식을 확인해 주세요.',
    'auth/email-already-in-use': '이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해 주세요.',
    'auth/weak-password': '비밀번호가 너무 쉽습니다. 8자 이상으로 정해 주세요.', 'auth/too-many-requests': '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    'auth/network-request-failed': '인터넷 연결을 확인해 주세요.', 'permission-denied': '권한이 없습니다. 관리자 계정인지 확인해 주세요.',
  };
  store = {
    list: async b => (await F.getDocs(F.collection(db, b))).docs.map(d => ({ id: d.id, ...d.data() })),
    add: async (b, d) => (await F.addDoc(F.collection(db, b), { ...d, createdAt: F.serverTimestamp() })).id,
    update: async (b, id, d) => F.updateDoc(F.doc(db, b, id), { ...d, updatedAt: F.serverTimestamp() }),
    remove: async (b, id) => F.deleteDoc(F.doc(db, b, id)),
    settings: async () => { const s = await F.getDoc(F.doc(db, 'settings', 'site')); return s.exists() ? s.data() : {}; },
    saveSettings: async s => F.setDoc(F.doc(db, 'settings', 'site'), s, { merge: true }),
    users: async () => (await F.getDocs(F.collection(db, 'users'))).docs.map(d => ({ id: d.id, ...d.data() })),
    ko: e => KO[e && e.code] || '문제가 생겼습니다. 잠시 후 다시 시도해 주세요.',
  };
  auth = {
    login: (email, pw) => A.signInWithEmailAndPassword(fa, email, pw),
    signup: async (name, email, pw) => {
      const { user: u } = await A.createUserWithEmailAndPassword(fa, email, pw);
      await A.updateProfile(u, { displayName: name });
      await F.setDoc(F.doc(db, 'users', u.uid), { name, email, agreedPrivacy: true, createdAt: F.serverTimestamp() });
      A.sendEmailVerification(u).catch(() => {});
      user = { name, email, admin: ADMINS.includes(email.toLowerCase()), verified: false }; emit();
    },
    reset: email => A.sendPasswordResetEmail(fa, email),
    logout: () => A.signOut(fa),
  };
  A.onAuthStateChanged(fa, u => { user = u ? { name: u.displayName || u.email, email: u.email, admin: ADMINS.includes((u.email || '').toLowerCase()), verified: u.emailVerified } : null; emit(); });
}
const onUser = f => listeners.push(f);

// ================= 로그인 상자 (data-auth) =================
function msg(f, text, ok = false) { const e = f.querySelector('.err'); if (!e) return; e.textContent = text; e.classList.toggle('ok', ok); }
async function busy(f, label, fn) { const b = f.querySelector('button[type=submit]'), old = b.textContent; b.disabled = true; b.textContent = label; try { await fn(); } finally { b.disabled = false; b.textContent = old; } }
$$('[data-auth]').forEach(box => {
  const setMode = mode => {
    $$('[data-form]', box).forEach(f => { f.hidden = f.dataset.form !== mode; msg(f, ''); });
    $$('.tg-authtabs [data-mode]', box).forEach(b => { const on = b.dataset.mode === mode || (mode === 'reset' && b.dataset.mode === 'login'); b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  };
  $$('[data-mode]', box).forEach(b => b.addEventListener('click', () => { setMode(b.dataset.mode); $(`[data-form="${b.dataset.mode}"] input`, box)?.focus(); }));
  const demoNote = $('[data-demo-note]', box);
  if (demoNote && DEMO) demoNote.hidden = false;
  $('[data-form="login"]', box)?.addEventListener('submit', e => {
    e.preventDefault(); const f = e.target, em = val(f, 'email'), pw = el(f, 'password').value;
    if (!DEMO && (!em || !pw)) return msg(f, '이메일과 비밀번호를 입력해 주세요.');
    busy(f, '확인 중…', async () => { try { await auth.login(em, pw); f.reset(); } catch (err) { msg(f, store.ko(err)); } });
  });
  $('[data-form="signup"]', box)?.addEventListener('submit', e => {
    e.preventDefault(); const f = e.target, name = val(f, 'name'), em = val(f, 'email'), pw = el(f, 'password').value;
    if (!DEMO) {
      if (!name || !em) return msg(f, '이름과 이메일을 입력해 주세요.');
      if (pw.length < 8) return msg(f, '비밀번호는 8자 이상으로 정해 주세요.');
      if (pw !== el(f, 'password2').value) return msg(f, '비밀번호 확인이 일치하지 않습니다.');
      if (!el(f, 'agree').checked) return msg(f, '개인정보 수집·이용에 동의해야 가입할 수 있습니다.');
    }
    busy(f, '가입 중…', async () => { try { await auth.signup(name, em, pw); f.reset(); } catch (err) { msg(f, store.ko(err)); } });
  });
  $('[data-form="reset"]', box)?.addEventListener('submit', e => {
    e.preventDefault(); const f = e.target, em = val(f, 'email');
    if (DEMO) return msg(f, '비밀번호 재설정은 사업단 지원팀으로 문의해 주세요.', true);
    if (!em) return msg(f, '가입한 이메일을 입력해 주세요.');
    const sent = '재설정 메일을 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.';
    busy(f, '보내는 중…', async () => { try { await auth.reset(em); msg(f, sent, true); } catch (err) { err.code === 'auth/user-not-found' ? msg(f, sent, true) : msg(f, store.ko(err)); } });
  });
  onUser(u => { if (!u) setMode('login'); });
});

// ================= 인사말 줄 (data-whobar) =================
$$('[data-whobar]').forEach(bar => {
  bar.innerHTML = '<span>안녕하세요, <b data-who></b>님<em class="adminbadge" hidden>관리자</em></span><span class="right"><a class="tg-btn outline sm adminlink" href="admin.html" hidden>관리자 페이지</a><button type="button" class="tg-btn outline sm" data-logout>로그아웃</button></span>';
  $('[data-logout]', bar).addEventListener('click', () => auth.logout());
  onUser(u => { bar.hidden = !u; if (!u) return; $('[data-who]', bar).textContent = u.name; $('.adminbadge', bar).hidden = !u.admin; $('.adminlink', bar).hidden = !u.admin || !!bar.closest('[data-gate="admin"]'); });
});

// ================= 잠금 (data-gate="member" | "admin") =================
$$('[data-gate]').forEach(g => {
  const need = g.dataset.gate;
  onUser(u => {
    const ok = !!u && (need === 'member' || u.admin);
    $$('[data-locked]', g).forEach(x => { x.hidden = !!u && (ok || need === 'admin'); });
    $$('[data-denied]', g).forEach(x => { x.hidden = !(u && !ok); });
    $$('[data-unlocked]', g).forEach(x => { x.hidden = !ok; });
    document.body.classList.toggle('is-locked', !ok);
    if (ok) $$('[data-board-view],[data-calendar-form],[data-users]', g).forEach(x => x.dispatchEvent(new Event('tg:show')));
  });
});

// ================= 업로드·수정 팝업 (게시판 공통, 하나만 만들어 씀) =================
const dlg = document.createElement('dialog');
dlg.className = 'tg-admin';
dlg.innerHTML = `<div class="head"><h3 data-dtitle>새 글 업로드</h3><button type="button" class="x" data-dclose aria-label="닫기"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
<form novalidate><input type="hidden" name="id"><div class="fields"></div><p class="err wide" role="alert"></p>
<div class="btns wide"><button class="tg-btn outline" type="button" data-dclose>취소</button><button class="tg-btn primary" type="submit" data-dsubmit>업로드</button></div></form>`;
document.body.append(dlg);
const dform = $('form', dlg);
let dctx = null; // {board, done}
const FIELD = (b, name) => {
  const cfg = BOARDS[b];
  switch (name) {
    case 'tab': return `<label>분류<select name="tab">${cfg.tabs.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>`;
    case 'date': return '<label>날짜<input name="date" placeholder="2026.11.23"></label>';
    case 'order': return '<label>표시 순서 <small>숫자가 작을수록 위</small><input name="order" type="number" min="1" placeholder="1"></label>';
    case 'title': return `<label class="wide">${cfg.titleLabel || '제목'}<input name="title" required maxlength="120"></label>`;
    case 'body': return `<label class="wide">${cfg.bodyLabel || '내용'}<textarea name="body" rows="${b === 'press' ? 2 : 6}" maxlength="3000"></textarea></label>`;
    case 'link': return '<label class="wide">링크 <small>선택 · 사이트 안 주소(예: notices.html) 또는 https:// 주소</small><input name="link"></label>';
    case 'file': return '<label class="wide">첨부파일 <small>선택 · 700KB 이하</small><input name="file" type="file"></label><p class="curfile wide" data-cur="file" hidden>현재 첨부: <b></b><label><input type="checkbox" name="removefile"> 첨부 지우기</label></p>';
    case 'image': return '<label class="wide">사진 <small>선택 · 700KB 이하</small><input name="image" type="file" accept="image/*"></label><p class="curfile wide" data-cur="image" hidden>현재 사진: <b></b><label><input type="checkbox" name="removeimage"> 사진 지우기</label></p>';
  }
};
function openDialog(board, item, done, presetTab) {
  dctx = { board, id: item?.id || '', done };
  $('.fields', dlg).innerHTML = BOARDS[board].fields.map(n => FIELD(board, n)).join('');
  dform.reset(); el(dform, 'id').value = dctx.id; msg(dform, '');
  if (item) BOARDS[board].fields.forEach(n => { if (!['file', 'image'].includes(n) && el(dform, n)) el(dform, n).value = item[n] ?? (n === 'body' ? item.desc ?? '' : ''); });
  else if (presetTab && el(dform, 'tab')) el(dform, 'tab').value = presetTab;
  ['file', 'image'].forEach(k => { const c = $(`[data-cur="${k}"]`, dlg); if (c) { c.hidden = !item?.[k]; if (item?.[k]) $('b', c).textContent = item[k].name || '등록됨'; } });
  $('[data-dtitle]', dlg).textContent = (item ? '수정' : '새 글 업로드') + ' · ' + BOARDS[board].label;
  $('[data-dsubmit]', dlg).textContent = item ? '수정 저장' : '업로드';
  dlg.classList.toggle('editing', !!item);
  dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '');
  el(dform, 'title').focus();
}
const closeDialog = () => { dctx = null; dform.reset(); dlg.close ? dlg.close() : dlg.removeAttribute('open'); };
$$('[data-dclose]', dlg).forEach(b => b.addEventListener('click', closeDialog));
dlg.addEventListener('click', e => { if (e.target === dlg) closeDialog(); });
const readB64 = file => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = bad; r.readAsDataURL(file); });
dform.addEventListener('submit', e => {
  e.preventDefault(); if (!dctx) return;
  const { board, id, done } = dctx, fields = BOARDS[board].fields;
  if (!val(dform, 'title')) return msg(dform, (BOARDS[board].titleLabel || '제목') + '을 입력해 주세요.');
  for (const k of ['file', 'image']) { const f = el(dform, k)?.files?.[0]; if (f && f.size > MAX_FILE) return msg(dform, `파일이 너무 큽니다 (${Math.round(f.size / 1024)}KB). 700KB 이하로 올려 주세요.`); }
  busy(dform, id ? '저장 중…' : '올리는 중…', async () => {
    try {
      const data = {};
      fields.forEach(n => { if (!['file', 'image'].includes(n)) data[n] = val(dform, n); });
      for (const k of ['file', 'image']) {
        if (!fields.includes(k)) continue;
        const f = el(dform, k).files[0];
        if (f) data[k] = { name: f.name, type: f.type || 'application/octet-stream', data: await readB64(f) };
        else if (el(dform, 'remove' + k).checked || !id) data[k] = null;
      }
      const newId = id ? (await store.update(board, id, data), id) : await store.add(board, data);
      closeDialog(); done && done(newId, data);
    } catch (err) { msg(dform, store.ko(err)); }
  });
});

// ================= 게시판 화면 (data-board-view) =================
function download(file) {
  const a = document.createElement('a');
  let url = file.url;
  if (!url) { const s = atob(file.data), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); url = URL.createObjectURL(new Blob([u], { type: file.type })); setTimeout(() => URL.revokeObjectURL(url), 2000); }
  a.href = url; a.download = file.name; document.body.append(a); a.click(); a.remove();
}
const linkBtn = (it, label = '바로가기') => safeLink(it.link) ? `<a class="tg-go sm" href="${esc(it.link)}"${isExternal(it.link) ? ' target="_blank" rel="noopener"' : ''}>${label}<span class="badge">${IC}</span></a>` : '';
const fileBtn = it => it.file ? `<button type="button" class="tg-dl" data-act="dl" data-id="${esc(it.id)}">${IC}내려받기</button>` : '';
const adminBtns = (it, admin) => admin ? `<button type="button" class="tg-edit" data-act="edit" data-id="${esc(it.id)}">수정</button><button type="button" class="tg-del" data-act="del" data-id="${esc(it.id)}">삭제</button>` : '';

const LAYOUT = {
  notice: (rows, admin) => rows.length ? `<ul class="tg-bnotice">${rows.map(it => `<li data-row="${esc(it.id)}">
    <div class="row"><a class="open" href="notice-view.html?id=${encodeURIComponent(it.id)}"><span class="tg-tag ${TAGCLASS[it.tab] ?? ''}">${esc(it.tab || '공지')}</span><b>${esc(it.title)}</b>${it.file ? '<i class="clip" title="첨부파일">첨부</i>' : ''}<time>${esc(it.date)}</time></a>${adminBtns(it, admin) ? `<span class="adm">${adminBtns(it, admin)}</span>` : ''}</div></li>`).join('')}</ul>` : '<p class="empty">등록된 글이 없습니다.</p>',
  gallery: (rows, admin) => rows.length ? `<div class="tg-gallery tg-bgallery">${rows.map(it => {
    const inner = `${it.image ? `<img src="${esc(imgSrc(it.image))}" alt="${esc(it.title)}" loading="lazy">` : '<span class="noimg"></span>'}<span><small>${esc(it.body || it.date)}</small>${esc(it.title)}</span>`;
    const card = safeLink(it.link) ? `<a href="${esc(it.link)}"${isExternal(it.link) ? ' target="_blank" rel="noopener"' : ''}>${inner}</a>` : `<div class="card">${inner}</div>`;
    return `<div class="gitem" data-row="${esc(it.id)}">${card}${admin ? `<div class="adm">${adminBtns(it, admin)}</div>` : ''}</div>`; }).join('')}</div>` : '<p class="empty">등록된 보도자료가 없습니다.</p>',
  event: (rows, admin) => rows.length ? `<ul class="tg-events">${rows.map(it => {
    const m = String(it.date || '').match(/(\d{4})\.(\d{1,2})(?:\.(\d{1,2}))?/), rest = m ? String(it.date).slice(m.index + m[0].length).trim() : '';
    const day = m ? (m[3] ? `${m[2].padStart(2, '0')}.${m[3].padStart(2, '0')}` : `${+m[2]}월`) : esc(it.date || '-');
    return `<li data-row="${esc(it.id)}"><div class="d"><b>${day}</b><small>${m ? m[1] : ''}${rest ? ' ' + esc(rest) : ''}</small></div><div class="txt"><b>${esc(it.title)}</b>${it.body ? `<p>${nl(it.body)}</p>` : ''}</div><div class="act">${linkBtn(it, '자세히')}${adminBtns(it, admin)}</div></li>`; }).join('')}</ul>` : '<p class="empty">등록된 일정이 없습니다.</p>',
  faq: (rows, admin) => rows.length ? rows.map(it => `<details class="question" data-row="${esc(it.id)}"><summary>${esc(it.title)}</summary><div class="ans">${nl(it.body)}</div><div class="act">${linkBtn(it, '자세히 보기')}${adminBtns(it, admin)}</div></details>`).join('') : '<p class="empty">등록된 질문이 없습니다.</p>',
  list: (rows, admin) => rows.length ? rows.map(it => `<article class="tg-vitem" data-row="${esc(it.id)}"><time>${esc(it.date)}</time><div class="txt">${it.tab && BOARDS.notices.tabs.some(t => t[0] === it.tab) ? `<span class="tg-tag ${TAGCLASS[it.tab] ?? ''}">${esc(it.tab)}</span> ` : ''}<b>${esc(it.title)}</b><p>${esc((it.body || it.desc || '').split('\n')[0])}</p></div><div class="act">${fileBtn(it)}${linkBtn(it, '보기')}${adminBtns(it, admin)}</div></article>`).join('') : '<p class="empty">등록된 자료가 없습니다.</p>',
};

$$('[data-board-view]').forEach(view => {
  const board = view.dataset.boardView, cfg = BOARDS[board], layout = view.dataset.layout || 'list';
  const useHash = view.hasAttribute('data-hash');
  let items = [], tab = cfg.tabs ? (useHash && cfg.tabs.some(t => t[0] === location.hash.slice(1)) ? location.hash.slice(1) : 'all') : 'all';
  if (cfg.tabs && board === 'vault') tab = cfg.tabs.some(t => t[0] === location.hash.slice(1)) ? location.hash.slice(1) : cfg.tabs[0][0];
  view.innerHTML = `<div class="tg-vtabbar">${cfg.tabs ? `<div class="tg-vtabs" role="tablist">${board === 'vault' ? '' : '<button type="button" data-tab="all">전체<span class="n"></span></button>'}${cfg.tabs.map(([k, l]) => `<button type="button" data-tab="${k}">${l}<span class="n"></span></button>`).join('')}</div>` : `<p class="count"></p>`}
    <button type="button" class="tg-upload" data-upload hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>업로드하기</button></div>
    <div class="tg-blist" data-list><p class="empty">불러오는 중…</p></div>`;
  const list = $('[data-list]', view), up = $('[data-upload]', view);
  const admin = () => !!user?.admin;
  function render(flash) {
    up.hidden = !admin();
    $$('[data-tab]', view).forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); $('.n', b).textContent = b.dataset.tab === 'all' ? items.length : items.filter(i => i.tab === b.dataset.tab).length; });
    const cnt = $('.count', view); if (cnt) cnt.textContent = `총 ${items.length}건`;
    const rows = tab === 'all' ? items : items.filter(i => i.tab === tab);
    list.innerHTML = LAYOUT[layout](rows, admin());
    if (flash) { const r = $(`[data-row="${CSS.escape(flash)}"]`, list); if (r) { r.classList.add('flash'); r.scrollIntoView({ block: 'nearest' }); } }
  }
  async function load(flash) {
    if (cfg.private && !user) { list.innerHTML = ''; return; }
    try { items = (await store.list(board)).sort(sorter(board)); render(flash); }
    catch (err) { list.innerHTML = `<p class="empty">${esc(store.ko(err))}</p>`; }
  }
  $$('[data-tab]', view).forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; if (useHash || board === 'vault') history.replaceState(null, '', '#' + tab); render(); }));
  up.addEventListener('click', () => openDialog(board, null, id => load(id), tab !== 'all' ? tab : undefined));
  list.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const row = b.closest('[data-row]'), it = items.find(i => i.id === (b.dataset.id || row?.dataset.row));
    if (b.dataset.act === 'toggle') { const d = $('.detail', row), open = d.hidden; d.hidden = !open; b.setAttribute('aria-expanded', open); row.classList.toggle('open', open); return; }
    if (!it) return;
    if (b.dataset.act === 'dl') download(it.file);
    if (b.dataset.act === 'edit' && admin()) { e.preventDefault(); openDialog(board, it, id => load(id)); }
    if (b.dataset.act === 'del' && admin()) { e.preventDefault(); if (confirm(`"${it.title}"을(를) 삭제할까요? 되돌릴 수 없습니다.`)) { try { await store.remove(board, it.id); await load(); } catch (err) { alert(store.ko(err)); } } }
  });
  view.addEventListener('tg:show', () => load());
  onUser(() => (cfg.private ? (user ? load() : (list.innerHTML = '')) : (items.length ? render() : load())));
  if (!cfg.private) load();
});

// ================= 홈 화면 최신 글 (data-latest) =================
$$('[data-latest]').forEach(async ul => {
  try {
    const rows = (await store.list(ul.dataset.latest)).sort(byDate).slice(0, +ul.dataset.count || 4);
    if (rows.length) ul.innerHTML = rows.map(it => `<li><a href="notice-view.html?id=${encodeURIComponent(it.id)}"><span class="tg-tag ${TAGCLASS[it.tab] ?? ''}">${esc(it.tab || '공지')}</span><b>${esc(it.title)}</b><time>${esc(it.date)}</time></a></li>`).join('');
  } catch (x) {}
});
// ================= 글 보기 페이지 (data-post-view) — 목록에서 한 단계 들어간 상세 화면 =================
$$('[data-post-view]').forEach(box => {
  const board = box.dataset.postView, back = box.dataset.back || `${board}.html`;
  const id = new URLSearchParams(location.search).get('id');
  async function show() {
    let items = [];
    try { items = (await store.list(board)).sort(sorter(board)); } catch (err) { box.innerHTML = `<p class="empty">${esc(store.ko(err))}</p>`; return; }
    const i = items.findIndex(x => x.id === id), it = items[i];
    if (!it) { box.innerHTML = `<div class="tg-post"><p class="empty">글을 찾을 수 없습니다. 삭제되었거나 주소가 바뀌었을 수 있습니다.</p><div class="pfoot"><a class="tg-btn outline sm" href="${back}">목록으로</a></div></div>`; return; }
    document.title = `${it.title} | 한국공학대학교 GTEP사업단`;
    const nav = (x, label) => x ? `<a href="?id=${encodeURIComponent(x.id)}"><span>${label}</span><b>${esc(x.title)}</b><time>${esc(x.date)}</time></a>` : `<div class="none"><span>${label}</span><b>${label === '이전글' ? '이전 글이 없습니다' : '다음 글이 없습니다'}</b></div>`;
    box.innerHTML = `<article class="tg-post">
      <header class="phead"><span class="tg-tag ${TAGCLASS[it.tab] ?? ''}">${esc(it.tab || '공지')}</span><h2>${esc(it.title)}</h2><div class="pmeta"><span>한국공학대학교 GTEP사업단</span><time>${esc(it.date)}</time></div></header>
      ${it.body ? `<div class="pbody">${nl(it.body)}</div>` : ''}
      ${it.file || safeLink(it.link) ? `<div class="pfiles">${it.file ? `<div class="file"><span class="ico">FILE</span><b>${esc(it.file.name)}</b><button type="button" class="tg-dl" data-act="dl">${IC}내려받기</button></div>` : ''}${safeLink(it.link) ? `<div class="file link"><span class="ico">LINK</span><b>${esc(it.link)}</b>${linkBtn(it)}</div>` : ''}</div>` : ''}
      <nav class="pnav" aria-label="이전글 다음글">${nav(items[i - 1], '이전글')}${nav(items[i + 1], '다음글')}</nav>
      <div class="pfoot"><a class="tg-btn outline sm" href="${back}">목록으로</a>${user?.admin ? `<span class="adm"><button type="button" class="tg-edit" data-act="edit">수정</button><button type="button" class="tg-del" data-act="del">삭제</button></span>` : ''}</div>
    </article>`;
    $('[data-act="dl"]', box)?.addEventListener('click', () => download(it.file));
    $('[data-act="edit"]', box)?.addEventListener('click', () => openDialog(board, it, () => show()));
    $('[data-act="del"]', box)?.addEventListener('click', async () => { if (confirm(`"${it.title}"을(를) 삭제할까요? 되돌릴 수 없습니다.`)) { try { await store.remove(board, it.id); location.href = back; } catch (err) { alert(store.ko(err)); } } });
  }
  show(); onUser(show);
});

// ================= 구글 캘린더 (data-calendar) =================
function calSrc(v, mode) {
  v = String(v || '').trim(); if (!v) return '';
  const m = v.match(/src=["']([^"']+)["']/); if (m) v = m[1].replace(/&amp;/g, '&');
  try {
    if (/^https:\/\/calendar\.google\.com\/calendar\//.test(v)) { const u = new URL(v); u.searchParams.set('mode', mode); u.searchParams.set('hl', 'ko'); if (!u.searchParams.get('ctz')) u.searchParams.set('ctz', 'Asia/Seoul'); u.searchParams.set('showTitle', '0'); u.searchParams.set('showPrint', '0'); return u.toString(); }
  } catch (x) { return ''; }
  if (/^[^\s"'<>]+@[^\s"'<>]+$/.test(v)) return `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(v)}&ctz=Asia%2FSeoul&hl=ko&mode=${mode}&showTitle=0&showPrint=0`;
  return '';
}
const calViews = $$('[data-calendar]');
async function renderCalendars() {
  if (!calViews.length) return;
  let s = {}; try { s = await store.settings(); } catch (x) {}
  calViews.forEach(c => {
    const src = calSrc(s.calendar, c.dataset.calendar || 'MONTH');
    c.innerHTML = src ? `<iframe src="${esc(src)}" title="GTEP 사업단 일정 (구글 캘린더)" loading="lazy"></iframe>`
      : `<div class="tg-calempty"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg><b>아직 연결된 캘린더가 없습니다</b><p>${user?.admin ? '<a href="admin.html#calendar">관리자 페이지 › 사업단 일정</a>에서 구글 캘린더를 연결하세요.' : '사업단 일정이 곧 이곳에 표시됩니다.'}</p></div>`;
  });
}
renderCalendars(); onUser(renderCalendars);

// ================= 관리자 페이지: 탭, 캘린더 설정, 회원 =================
$$('[data-admin-tabs]').forEach(nav => {
  const show = k => { $$('[data-atab]', nav).forEach(b => b.classList.toggle('on', b.dataset.atab === k)); $$('[data-apanel]').forEach(p => { p.hidden = p.dataset.apanel !== k; }); history.replaceState(null, '', '#' + k); };
  $$('[data-atab]', nav).forEach(b => b.addEventListener('click', () => show(b.dataset.atab)));
  show($(`[data-atab="${location.hash.slice(1)}"]`, nav) ? location.hash.slice(1) : $('[data-atab]', nav).dataset.atab);
});
$$('[data-calendar-form]').forEach(f => {
  const prev = $('[data-calendar-preview]');
  const fill = async () => { const s = await store.settings(); el(f, 'calendar').value = s.calendar || ''; if (prev) prev.innerHTML = calSrc(s.calendar, 'MONTH') ? `<iframe src="${esc(calSrc(s.calendar, 'MONTH'))}" title="캘린더 미리보기"></iframe>` : ''; };
  f.addEventListener('tg:show', fill);
  f.addEventListener('submit', e => {
    e.preventDefault(); const v = val(f, 'calendar');
    if (v && !calSrc(v, 'MONTH')) return msg(f, '구글 캘린더 ID(…@group.calendar.google.com) 또는 "퍼가기 코드"를 넣어 주세요.');
    busy(f, '저장 중…', async () => { try { await store.saveSettings({ calendar: v }); msg(f, v ? '캘린더를 연결했습니다. 홈 화면과 공지사항 › 사업단 일정에 표시됩니다.' : '캘린더 연결을 해제했습니다.', true); fill(); renderCalendars(); } catch (err) { msg(f, store.ko(err)); } });
  });
});
$$('[data-users]').forEach(box => box.addEventListener('tg:show', async () => {
  try {
    const us = await store.users();
    box.innerHTML = us === null ? '<p class="empty">회원 시스템(Firebase)을 연결하면 가입한 회원이 여기에 표시됩니다.</p>'
      : us.length ? `<p class="count">총 ${us.length}명</p><div class="tg-table"><table><thead><tr><th>이름</th><th>이메일</th><th>가입일</th></tr></thead><tbody>${us.sort((a, b) => ts(b) - ts(a)).map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.createdAt?.seconds ? new Date(u.createdAt.seconds * 1000).toLocaleDateString('ko-KR') : ''}</td></tr>`).join('')}</tbody></table></div><p class="note">회원 삭제는 Firebase 콘솔 › Authentication에서 합니다.</p>`
      : '<p class="empty">아직 가입한 회원이 없습니다.</p>';
  } catch (err) { box.innerHTML = `<p class="empty">${esc(store.ko(err))}</p>`; }
}));
$$('[data-reset-demo]').forEach(b => { b.hidden = !DEMO; b.addEventListener('click', () => { if (confirm('이 브라우저에서 바꾼 내용을 모두 지우고 처음 자료로 되돌릴까요?')) { store.resetDemo(); location.reload(); } }); });
$$('[data-seed-import]').forEach(inp => {
  inp.closest('[data-seedbox]').hidden = DEMO;
  inp.addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const seed = JSON.parse(await file.text()); let n = 0;
      if (!confirm('기본 자료(공지사항·보도자료·FAQ·자료실)를 올릴까요? 이미 올린 적이 있으면 중복됩니다.')) return;
      for (const [b, arr] of Object.entries(seed)) if (BOARDS[b]) for (const d of arr) { await store.add(b, d); n++; }
      alert(`${n}개를 올렸습니다.`); location.reload();
    } catch (err) { alert(err.code ? store.ko(err) : 'site-seed.json 파일이 맞는지 확인해 주세요.'); }
    finally { e.target.value = ''; }
  });
});
})();
