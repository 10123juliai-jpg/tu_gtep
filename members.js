/* TU GTEP 자료실 — 회원가입·로그인·비밀번호 찾기, 회원 전용 자료, 관리자 자료 올리기
   - firebase-config.js에 설정값이 없으면 "데모 모드": 아무 정보나 넣어도 로그인·가입되고, 기본 자료(vault-demo.js)를 보여줌
   - 일반 스크립트라서 파일을 더블클릭해 열어도(file://) 동작함
   - 설정값을 넣으면 Firebase로 실제 회원가입·로그인 (보안 규칙: 프로젝트 폴더의 firestore.rules) */
(async () => {
const firebaseConfig = (window.TG_FIREBASE || {}).config, ADMIN_EMAILS = (window.TG_FIREBASE || {}).admins || [];

const V = document.querySelector('[data-members]');
if (!V) return;
const $ = (s, el = V) => el.querySelector(s);
const $$ = (s, el = V) => [...el.querySelectorAll(s)];
const authBox = $('[data-auth]'), body = $('[data-body]'), list = $('[data-list]');
const TABS = $$('[data-tab]').map(b => b.dataset.tab);
const MAX_FILE = 700 * 1024;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const el = (f, n) => f.elements.namedItem(n);
const val = (f, n) => (el(f, n)?.value || '').trim();
const safeLink = s => (s && !/^\s*javascript:/i.test(s) ? s : '');
const DEMO = !firebaseConfig || !firebaseConfig.apiKey;
let items = [], isAdmin = false;

// ---------- 화면 전환 ----------
function setMode(mode) {
  $$('[data-form]').forEach(f => { f.hidden = f.dataset.form !== mode; msg(f, ''); });
  $$('.tg-authtabs [data-mode]').forEach(b => { const on = b.dataset.mode === mode || (mode === 'reset' && b.dataset.mode === 'login'); b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
}
$$('[data-mode]').forEach(b => b.addEventListener('click', () => { setMode(b.dataset.mode); $(`[data-form="${b.dataset.mode}"] input`)?.focus(); }));
function msg(form, text, ok = false) { const e = form.querySelector('.err'); if (!e) return; e.textContent = text; e.classList.toggle('ok', ok); }
async function busy(form, label, fn) {
  const btn = form.querySelector('button[type=submit]'), old = btn.textContent;
  btn.disabled = true; btn.textContent = label;
  try { await fn(); } finally { btn.disabled = false; btn.textContent = old; }
}

// ---------- 자료 목록 (데모·Firebase 공통) ----------
function showSignedIn(name, { admin = false, verified = true } = {}) {
  $('[data-who]').textContent = name;
  isAdmin = admin;
  $('[data-adminbadge]').hidden = !admin; $('[data-admin]').hidden = !admin;
  $('[data-verify]').hidden = verified;
  authBox.hidden = true; body.hidden = false;
}
function showSignedOut() { items = []; list.innerHTML = ''; body.hidden = true; authBox.hidden = false; setMode('login'); }
const sortItems = arr => arr.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
const tabNow = () => { const t = location.hash.slice(1); return TABS.includes(t) ? t : TABS[0]; };
function render() {
  const t = tabNow();
  $$('[data-tab]').forEach(b => {
    const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
    b.querySelector('.n').textContent = items.filter(i => i.tab === b.dataset.tab).length;
  });
  const addTab = $('[data-add] [name=tab]'); if (addTab) addTab.value = t;
  const rows = items.filter(i => i.tab === t);
  list.innerHTML = rows.length ? rows.map(it => {
    let act = '';
    if (it.file) act += `<button type="button" class="tg-dl" data-file="${esc(it.id)}"><span class="tg-ic"></span>내려받기</button>`;
    if (safeLink(it.link)) act += `<a class="tg-go sm" href="${esc(safeLink(it.link))}">보기<span class="badge"><span class="tg-ic"></span></span></a>`;
    if (isAdmin) act += `<button type="button" class="tg-del" data-del="${esc(it.id)}" aria-label="${esc(it.title)} 삭제">삭제</button>`;
    return `<article class="tg-vitem"><time>${esc(it.date)}</time><div class="txt"><b>${esc(it.title)}</b><p>${esc(it.desc)}</p></div><div class="act">${act}</div></article>`;
  }).join('') : '<p class="empty">등록된 자료가 없습니다.</p>';
}
$$('[data-tab]').forEach(b => b.addEventListener('click', () => { history.replaceState(null, '', '#' + b.dataset.tab); render(); }));
addEventListener('hashchange', () => { if (!body.hidden) render(); });

function b64ToBlob(data, type) { const s = atob(data), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Blob([u], { type }); }
function download(file) {
  const a = document.createElement('a');
  const url = file.url || URL.createObjectURL(b64ToBlob(file.data, file.type));
  a.href = url; a.download = file.name; document.body.append(a); a.click(); a.remove();
  if (!file.url) setTimeout(() => URL.revokeObjectURL(url), 2000);
}
let onDelete = null;
list.addEventListener('click', async e => {
  const dl = e.target.closest('[data-file]');
  if (dl) { const it = items.find(i => i.id === dl.dataset.file); if (it?.file) download(it.file); }
  const del = e.target.closest('[data-del]');
  if (del && isAdmin && onDelete) {
    const it = items.find(i => i.id === del.dataset.del);
    if (confirm(`"${it.title}" 자료를 삭제할까요? 되돌릴 수 없습니다.`)) onDelete(it);
  }
});

// ---------- 데모 모드: 아무 정보나 넣어도 로그인·가입 ----------
if (DEMO) {
  const KEY = 'tg-demo-user';
  const setup = $('[data-setup]');
  setup.textContent = '시안(데모) 모드입니다. 아무 이메일·비밀번호나 입력해도 로그인과 회원가입이 됩니다.';
  setup.hidden = false;
  async function enter(name) {
    try { sessionStorage.setItem(KEY, name); } catch (x) {}
    showSignedIn(name);
    list.innerHTML = '<p class="empty">자료를 불러오는 중…</p>';
    const data = window.TG_VAULT_DEMO || [];
    items = sortItems(data.map((d, i) => ({ id: 'd' + i, ...d })));
    render();
  }
  const nameFrom = email => (email.split('@')[0] || '').trim() || '방문자';
  $('[data-form="login"]').addEventListener('submit', e => { e.preventDefault(); const f = e.target; enter(nameFrom(val(f, 'email'))); f.reset(); });
  $('[data-form="signup"]').addEventListener('submit', e => { e.preventDefault(); const f = e.target; enter(val(f, 'name') || nameFrom(val(f, 'email'))); f.reset(); });
  $('[data-form="reset"]').addEventListener('submit', e => { e.preventDefault(); msg(e.target, '데모 모드에서는 메일을 보내지 않습니다. 아무 비밀번호로나 로그인해 보세요.', true); });
  $('[data-logout]').addEventListener('click', () => { try { sessionStorage.removeItem(KEY); } catch (x) {} showSignedOut(); });
  let saved = null; try { saved = sessionStorage.getItem(KEY); } catch (x) {}
  if (saved) enter(saved); else showSignedOut();
  return; // 데모 모드에서는 아래 Firebase 코드를 실행하지 않음
}

// ---------- Firebase 모드 ----------
const KO = {
  'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않습니다.', 'auth/wrong-password': '이메일 또는 비밀번호가 맞지 않습니다.',
  'auth/user-not-found': '이메일 또는 비밀번호가 맞지 않습니다.', 'auth/invalid-email': '이메일 주소 형식을 확인해 주세요.',
  'auth/email-already-in-use': '이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해 주세요.',
  'auth/weak-password': '비밀번호가 너무 쉽습니다. 8자 이상으로 정해 주세요.', 'auth/too-many-requests': '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  'auth/network-request-failed': '인터넷 연결을 확인해 주세요.', 'permission-denied': '권한이 없습니다. 관리자 계정인지 확인해 주세요.',
};
const ko = e => KO[e && e.code] || '문제가 생겼습니다. 잠시 후 다시 시도해 주세요.';
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const [{ initializeApp }, A, F] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
const app = initializeApp(firebaseConfig);
const auth = A.getAuth(app); auth.languageCode = 'ko';
const db = F.getFirestore(app);
const admins = ADMIN_EMAILS.map(e => e.toLowerCase());

async function load() {
  list.innerHTML = '<p class="empty">자료를 불러오는 중…</p>';
  try { const snap = await F.getDocs(F.collection(db, 'vault')); items = sortItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))); render(); }
  catch (err) { list.innerHTML = `<p class="empty">${esc(ko(err))}</p>`; }
}
function signedIn(user, name) {
  showSignedIn(name || user.displayName || user.email, { admin: admins.includes((user.email || '').toLowerCase()), verified: user.emailVerified });
  load();
}
onDelete = async it => { try { await F.deleteDoc(F.doc(db, 'vault', it.id)); await load(); } catch (err) { alert(ko(err)); } };

$('[data-form="login"]').addEventListener('submit', e => {
  e.preventDefault(); const f = e.target;
  if (!val(f, 'email') || !el(f, 'password').value) return msg(f, '이메일과 비밀번호를 입력해 주세요.');
  busy(f, '확인 중…', async () => {
    try { await A.signInWithEmailAndPassword(auth, val(f, 'email'), el(f, 'password').value); f.reset(); }
    catch (err) { msg(f, ko(err)); }
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
    } catch (err) { msg(f, ko(err)); }
  });
});
$('[data-form="reset"]').addEventListener('submit', e => {
  e.preventDefault(); const f = e.target;
  if (!val(f, 'email')) return msg(f, '가입한 이메일을 입력해 주세요.');
  const sent = '재설정 메일을 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.';
  busy(f, '보내는 중…', async () => {
    try { await A.sendPasswordResetEmail(auth, val(f, 'email')); msg(f, sent, true); }
    catch (err) { err.code === 'auth/user-not-found' ? msg(f, sent, true) : msg(f, ko(err)); }
  });
});
$('[data-logout]').addEventListener('click', () => A.signOut(auth));
A.onAuthStateChanged(auth, user => (user ? signedIn(user) : showSignedOut()));

// ---------- 관리자: 자료 올리기 ----------
const readB64 = file => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = bad; r.readAsDataURL(file); });
$('[data-add]').addEventListener('submit', e => {
  e.preventDefault(); const f = e.target;
  if (!val(f, 'title')) return msg(f, '제목을 입력해 주세요.');
  const file = el(f, 'file').files[0];
  if (file && file.size > MAX_FILE) return msg(f, `파일이 너무 큽니다 (${Math.round(file.size / 1024)}KB). 700KB 이하로 올려 주세요.`);
  busy(f, '올리는 중…', async () => {
    try {
      const tab = el(f, 'tab').value;
      await F.addDoc(F.collection(db, 'vault'), {
        tab, date: val(f, 'date'), title: val(f, 'title'), desc: val(f, 'desc'), link: val(f, 'link'),
        file: file ? { name: file.name, type: file.type || 'application/octet-stream', data: await readB64(file) } : null,
        createdAt: F.serverTimestamp(),
      });
      f.reset(); msg(f, '올렸습니다.', true); history.replaceState(null, '', '#' + tab); await load();
    } catch (err) { msg(f, ko(err)); }
  });
});
$('[data-seed]').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const seed = JSON.parse(await file.text());
    if (!Array.isArray(seed) || !confirm(`기본 자료 ${seed.length}개를 자료실에 올릴까요?`)) return;
    for (const s of seed) await F.addDoc(F.collection(db, 'vault'), { ...s, createdAt: F.serverTimestamp() });
    alert(`${seed.length}개를 올렸습니다.`); await load();
  } catch (err) { alert(err.code ? ko(err) : 'vault-seed.json 파일이 맞는지 확인해 주세요.'); }
  finally { e.target.value = ''; }
});
})();
