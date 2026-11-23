/* TU GTEP 자료실 — 회원가입·로그인, 회원 전용 자료, 관리자 자료 올리기·수정·삭제 (코딩 없이 홈페이지에서)
   - firebase-config.js에 설정값이 없으면 "데모 모드"
       · 아무 정보나 넣어도 로그인·가입됨
       · 이메일에 admin 이라고 넣고 로그인하면 관리자 화면을 써 볼 수 있음 (바꾼 내용은 그 브라우저에만 저장)
   - 설정값을 넣으면 Firebase 모드: 실제 회원가입·로그인, 관리자가 올리고 고친 내용이 모든 방문자에게 바로 반영
   - 일반 스크립트라서 파일을 더블클릭해 열어도(file://) 동작함 */
(async () => {
const CFG = window.TG_FIREBASE || {};
const firebaseConfig = CFG.config, ADMIN_EMAILS = (CFG.admins || []).map(e => String(e).toLowerCase());
const V = document.querySelector('[data-members]');
if (!V) return;
const $ = (s, el = V) => el.querySelector(s);
const $$ = (s, el = V) => [...el.querySelectorAll(s)];
const authBox = $('[data-auth]'), body = $('[data-body]'), list = $('[data-list]');
const adminBox = $('[data-admin]'), form = $('[data-add]');
const TABS = $$('[data-tab]').map(b => b.dataset.tab);
const MAX_FILE = 700 * 1024;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const el = (f, n) => f.elements.namedItem(n);
const val = (f, n) => (el(f, n)?.value || '').trim();
const safeLink = s => (s && !/^\s*javascript:/i.test(s) ? s : '');
const DEMO = !firebaseConfig || !firebaseConfig.apiKey;
let items = [], isAdmin = false, store = null;

// ---------- 공통: 화면 전환·메시지 ----------
function setMode(mode) {
  $$('[data-form]').forEach(f => { f.hidden = f.dataset.form !== mode; msg(f, ''); });
  $$('.tg-authtabs [data-mode]').forEach(b => { const on = b.dataset.mode === mode || (mode === 'reset' && b.dataset.mode === 'login'); b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
}
$$('[data-mode]').forEach(b => b.addEventListener('click', () => { setMode(b.dataset.mode); $(`[data-form="${b.dataset.mode}"] input`)?.focus(); }));
function msg(f, text, ok = false) { const e = f.querySelector('.err'); if (!e) return; e.textContent = text; e.classList.toggle('ok', ok); }
async function busy(f, label, fn) {
  const btn = f.querySelector('button[type=submit]'), old = btn.textContent;
  btn.disabled = true; btn.textContent = label;
  try { await fn(); } finally { btn.disabled = false; btn.textContent = old; }
}

// ---------- 공통: 회원 화면과 자료 목록 ----------
function showSignedIn(name, { admin = false, verified = true } = {}) {
  $('[data-who]').textContent = name;
  isAdmin = admin;
  $('[data-adminbadge]').hidden = !admin; $('[data-open-upload]').hidden = !admin;
  $('[data-verify]').hidden = verified;
  $('[data-seedbox]').hidden = DEMO; $('[data-demoreset]').hidden = !DEMO;
  authBox.hidden = true; body.hidden = false;
  refresh();
}
function showSignedOut() { items = []; list.innerHTML = ''; body.hidden = true; authBox.hidden = false; closeUpload(); setMode('login'); }
const sortItems = arr => arr.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt?.seconds || b.createdAt || 0) - (a.createdAt?.seconds || a.createdAt || 0));
const tabNow = () => { const t = location.hash.slice(1); return TABS.includes(t) ? t : TABS[0]; };
async function refresh(flashId) {
  list.innerHTML = '<p class="empty">자료를 불러오는 중…</p>';
  try { items = sortItems(await store.list()); render(flashId); }
  catch (err) { list.innerHTML = `<p class="empty">${esc(store.ko(err))}</p>`; }
}
function render(flashId) {
  const t = tabNow();
  $$('[data-tab]').forEach(b => {
    const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
    b.querySelector('.n').textContent = items.filter(i => i.tab === b.dataset.tab).length;
  });
  if (!val(form, 'id')) el(form, 'tab').value = t;
  const rows = items.filter(i => i.tab === t);
  list.innerHTML = rows.length ? rows.map(it => {
    let act = '';
    if (it.file) act += `<button type="button" class="tg-dl" data-file="${esc(it.id)}"><span class="tg-ic"></span>내려받기</button>`;
    if (safeLink(it.link)) act += `<a class="tg-go sm" href="${esc(safeLink(it.link))}">보기<span class="badge"><span class="tg-ic"></span></span></a>`;
    if (isAdmin) act += `<button type="button" class="tg-edit" data-edit="${esc(it.id)}">수정</button><button type="button" class="tg-del" data-del="${esc(it.id)}" aria-label="${esc(it.title)} 삭제">삭제</button>`;
    return `<article class="tg-vitem${it.id === flashId ? ' flash' : ''}" data-row="${esc(it.id)}"><time>${esc(it.date)}</time><div class="txt"><b>${esc(it.title)}</b><p>${esc(it.desc)}</p></div><div class="act">${act}</div></article>`;
  }).join('') : '<p class="empty">등록된 자료가 없습니다.</p>';
}
$$('[data-tab]').forEach(b => b.addEventListener('click', () => { history.replaceState(null, '', '#' + b.dataset.tab); render(); }));
addEventListener('hashchange', () => { if (!body.hidden) render(); });

function b64ToBlob(data, type) { const s = atob(data), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Blob([u], { type }); }
function download(file) {
  const a = document.createElement('a'), url = file.url || URL.createObjectURL(b64ToBlob(file.data, file.type));
  a.href = url; a.download = file.name; document.body.append(a); a.click(); a.remove();
  if (!file.url) setTimeout(() => URL.revokeObjectURL(url), 2000);
}
list.addEventListener('click', async e => {
  const pick = sel => { const b = e.target.closest(sel); return b && items.find(i => i.id === b.getAttribute(sel.slice(1, -1))); };
  const dl = pick('[data-file]'); if (dl?.file) download(dl.file);
  const ed = pick('[data-edit]'); if (ed && isAdmin) startEdit(ed);
  const del = pick('[data-del]');
  if (del && isAdmin && confirm(`"${del.title}" 자료를 삭제할까요? 되돌릴 수 없습니다.`)) {
    try { await store.remove(del.id); await refresh(); } catch (err) { alert(store.ko(err)); }
  }
});

// ---------- 공통: 관리자 올리기·수정 ----------
function clearForm() { form.reset(); el(form, 'file').value = ''; el(form, 'removefile').checked = false; el(form, 'id').value = ''; msg(form, ''); }
function openDialog() { if (adminBox.showModal) { if (!adminBox.open) adminBox.showModal(); } else adminBox.setAttribute('open', ''); el(form, 'title').focus(); }
function openUpload() {                       // 새 자료 업로드
  clearForm(); el(form, 'tab').value = tabNow();
  $('[data-curfile]').hidden = true; $('[data-admin-title]').textContent = '새 자료 업로드';
  $('[data-submit]').textContent = '업로드'; adminBox.classList.remove('editing');
  openDialog();
}
function startEdit(it) {                      // 기존 자료 수정
  clearForm();
  el(form, 'id').value = it.id; el(form, 'tab').value = it.tab; el(form, 'date').value = it.date || '';
  el(form, 'title').value = it.title || ''; el(form, 'desc').value = it.desc || ''; el(form, 'link').value = it.link || '';
  $('[data-curfile]').hidden = !it.file; $('[data-curname]').textContent = it.file ? it.file.name : '';
  $('[data-admin-title]').textContent = '자료 수정';
  $('[data-submit]').textContent = '수정 저장'; adminBox.classList.add('editing');
  openDialog();
}
function closeUpload() { clearForm(); if (adminBox.open) { adminBox.close ? adminBox.close() : adminBox.removeAttribute('open'); } }
const endEdit = closeUpload;
$('[data-open-upload]').addEventListener('click', openUpload);
$('[data-cancel]').addEventListener('click', closeUpload);
$('[data-close-upload]').addEventListener('click', closeUpload);
adminBox.addEventListener('click', e => { if (e.target === adminBox) closeUpload(); });   // 바깥(어두운 부분) 누르면 닫기
const readB64 = file => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = bad; r.readAsDataURL(file); });
form.addEventListener('submit', e => {
  e.preventDefault();
  if (!val(form, 'title')) return msg(form, '제목을 입력해 주세요.');
  const file = el(form, 'file').files[0], id = val(form, 'id');
  if (file && file.size > MAX_FILE) return msg(form, `파일이 너무 큽니다 (${Math.round(file.size / 1024)}KB). 700KB 이하로 올려 주세요.`);
  busy(form, id ? '저장 중…' : '올리는 중…', async () => {
    try {
      const data = { tab: el(form, 'tab').value, date: val(form, 'date'), title: val(form, 'title'), desc: val(form, 'desc'), link: val(form, 'link') };
      if (file) data.file = { name: file.name, type: file.type || 'application/octet-stream', data: await readB64(file) };
      else if (el(form, 'removefile').checked) data.file = null;
      else if (!id) data.file = null;               // 새 글인데 첨부가 없으면 비워 둠 (수정이면 기존 첨부 유지)
      const savedId = id ? (await store.update(id, data), id) : await store.add(data);
      closeUpload(); history.replaceState(null, '', '#' + data.tab); await refresh(savedId);
    } catch (err) { msg(form, store.ko(err)); }
  });
});

// ================= 데모 모드 =================
if (DEMO) {
  const USER = 'tg-demo-user', DATA = 'tg-demo-vault';
  const setup = $('[data-setup]');
  setup.innerHTML = '시안(데모) 모드입니다. 아무 이메일·비밀번호나 입력해도 로그인과 회원가입이 됩니다.<br>이메일에 <b>admin</b> 이라고 넣고 로그인하면 관리자 화면(올리기·수정·삭제)을 써 볼 수 있습니다.';
  setup.hidden = false;
  const base = () => (window.TG_VAULT_DEMO || []).map((d, i) => ({ id: 'd' + i, ...d }));
  const read = () => { try { const s = localStorage.getItem(DATA); return s ? JSON.parse(s) : base(); } catch (x) { return base(); } };
  const write = arr => { try { localStorage.setItem(DATA, JSON.stringify(arr)); } catch (x) { throw { code: 'demo/full' }; } };
  store = {
    list: async () => read(),
    add: async d => { const arr = read(), id = 'u' + Date.now(); arr.push({ id, ...d, createdAt: Date.now() }); write(arr); return id; },
    update: async (id, d) => { write(read().map(i => (i.id === id ? { ...i, ...d } : i))); },
    remove: async id => { write(read().filter(i => i.id !== id)); },
    ko: e => (e && e.code === 'demo/full' ? '데모 저장 공간이 가득 찼습니다. "데모 자료 처음으로"를 누르거나 작은 파일로 해 보세요.' : '문제가 생겼습니다.'),
  };
  $('[data-reset-demo]').addEventListener('click', () => { if (confirm('데모에서 바꾼 내용을 모두 지우고 처음 자료로 되돌릴까요?')) { try { localStorage.removeItem(DATA); } catch (x) {} endEdit(); refresh(); } });
  const nameFrom = email => (email.split('@')[0] || '').trim() || '방문자';
  const enter = (name, email) => { const admin = /^admin$/i.test(nameFrom(email || '')) || ADMIN_EMAILS.includes((email || '').toLowerCase());
    try { sessionStorage.setItem(USER, JSON.stringify({ name, admin })); } catch (x) {}
    showSignedIn(admin ? name + ' (관리자 체험)' : name, { admin }); };
  $('[data-form="login"]').addEventListener('submit', e => { e.preventDefault(); const f = e.target, em = val(f, 'email'); enter(nameFrom(em), em); f.reset(); });
  $('[data-form="signup"]').addEventListener('submit', e => { e.preventDefault(); const f = e.target, em = val(f, 'email'); enter(val(f, 'name') || nameFrom(em), em); f.reset(); });
  $('[data-form="reset"]').addEventListener('submit', e => { e.preventDefault(); msg(e.target, '데모 모드에서는 메일을 보내지 않습니다. 아무 비밀번호로나 로그인해 보세요.', true); });
  $('[data-logout]').addEventListener('click', () => { try { sessionStorage.removeItem(USER); } catch (x) {} showSignedOut(); });
  let saved = null; try { saved = JSON.parse(sessionStorage.getItem(USER) || 'null'); } catch (x) {}
  if (saved) showSignedIn(saved.admin ? saved.name + ' (관리자 체험)' : saved.name, { admin: saved.admin }); else showSignedOut();
  return;
}

// ================= Firebase 모드 =================
const KO = {
  'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않습니다.', 'auth/wrong-password': '이메일 또는 비밀번호가 맞지 않습니다.',
  'auth/user-not-found': '이메일 또는 비밀번호가 맞지 않습니다.', 'auth/invalid-email': '이메일 주소 형식을 확인해 주세요.',
  'auth/email-already-in-use': '이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해 주세요.',
  'auth/weak-password': '비밀번호가 너무 쉽습니다. 8자 이상으로 정해 주세요.', 'auth/too-many-requests': '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  'auth/network-request-failed': '인터넷 연결을 확인해 주세요.', 'permission-denied': '권한이 없습니다. 관리자 계정인지 확인해 주세요.',
};
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const [{ initializeApp }, A, F] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
const app = initializeApp(firebaseConfig);
const auth = A.getAuth(app); auth.languageCode = 'ko';
const db = F.getFirestore(app);
store = {
  list: async () => (await F.getDocs(F.collection(db, 'vault'))).docs.map(d => ({ id: d.id, ...d.data() })),
  add: async d => (await F.addDoc(F.collection(db, 'vault'), { ...d, createdAt: F.serverTimestamp() })).id,
  update: async (id, d) => F.updateDoc(F.doc(db, 'vault', id), { ...d, updatedAt: F.serverTimestamp() }),
  remove: async id => F.deleteDoc(F.doc(db, 'vault', id)),
  ko: e => KO[e && e.code] || '문제가 생겼습니다. 잠시 후 다시 시도해 주세요.',
};
const signedIn = (user, name) => showSignedIn(name || user.displayName || user.email, { admin: ADMIN_EMAILS.includes((user.email || '').toLowerCase()), verified: user.emailVerified });

$('[data-form="login"]').addEventListener('submit', e => {
  e.preventDefault(); const f = e.target;
  if (!val(f, 'email') || !el(f, 'password').value) return msg(f, '이메일과 비밀번호를 입력해 주세요.');
  busy(f, '확인 중…', async () => {
    try { await A.signInWithEmailAndPassword(auth, val(f, 'email'), el(f, 'password').value); f.reset(); }
    catch (err) { msg(f, store.ko(err)); }
  });
});
$('[data-form="signup"]').addEventListener('submit', e => {
  e.preventDefault(); const f = e.target;
  const name = val(f, 'name'), email = val(f, 'email'), pw = el(f, 'password').value;
  if (!name || !email) return msg(f, '이름과 이메일을 입력해 주세요.');
  if (pw.length < 8) return msg(f, '비밀번호는 8자 이상으로 정해 주세요.');
  if (pw !== el(f, 'password2').value) return msg(f, '비밀번호 확인이 일치하지 않습니다.');
  if (!el(f, 'agree').checked) return msg(f, '개인정보 수집·이용에 동의해야 가입할 수 있습니다.');
  busy(f, '가입 중…', async () => {
    try {
      const { user } = await A.createUserWithEmailAndPassword(auth, email, pw);
      await A.updateProfile(user, { displayName: name });
      await F.setDoc(F.doc(db, 'users', user.uid), { name, email, agreedPrivacy: true, createdAt: F.serverTimestamp() });
      A.sendEmailVerification(user).catch(() => {});
      f.reset(); signedIn(user, name);
    } catch (err) { msg(f, store.ko(err)); }
  });
});
$('[data-form="reset"]').addEventListener('submit', e => {
  e.preventDefault(); const f = e.target;
  if (!val(f, 'email')) return msg(f, '가입한 이메일을 입력해 주세요.');
  const sent = '재설정 메일을 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.';
  busy(f, '보내는 중…', async () => {
    try { await A.sendPasswordResetEmail(auth, val(f, 'email')); msg(f, sent, true); }
    catch (err) { err.code === 'auth/user-not-found' ? msg(f, sent, true) : msg(f, store.ko(err)); }
  });
});
$('[data-logout]').addEventListener('click', () => A.signOut(auth));
A.onAuthStateChanged(auth, user => (user ? signedIn(user) : showSignedOut()));

$('[data-seed]').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const seed = JSON.parse(await file.text());
    if (!Array.isArray(seed) || !confirm(`기본 자료 ${seed.length}개를 자료실에 올릴까요?`)) return;
    for (const s of seed) await store.add(s);
    alert(`${seed.length}개를 올렸습니다.`); await refresh();
  } catch (err) { alert(err.code ? store.ko(err) : 'vault-seed.json 파일이 맞는지 확인해 주세요.'); }
  finally { e.target.value = ''; }
});
})();
