/* あの場所は今 ― イーグル隊長の空中散歩  app.js v1.5.0 */
(() => {
  'use strict';

  const C = window.APP_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const isPlaceholder = (v) => !v || String(v).startsWith('__');

  /* =========================================================
   *  隊長の定番セリフ（AI生成を待たずに使う）
   * ========================================================= */
  const LINES = {
    takeoff: [
      'しっかりつかまれ、相棒！目指すは「{place}」だ。いくぜ！',
      '準備はいいか？「{place}」まで、ひとっ飛びだぜ！',
      'よし、翼の調子は上々だ。「{place}」へ出発するぜ！'
    ],
    filler: [
      'よーし、高度を上げるぜ。下を見すぎて目を回すなよ！',
      'おっと、ちょいと気流が乱れてきたぜ。しっかり握ってな！',
      '風が気持ちいいだろ？オレの翼は今日も絶好調だぜ。',
      '地図はオレの頭の中に入ってる。安心して任せな！'
    ],
    waiting: '…おっと、目的地の資料をめくってるところだ。もうちょい待ってな！',
    preparing: '行き先を確認してるぜ…ちょっと待ってな！',
    skipWait: '資料が届きしだい、すぐに着陸するぜ！',
    failed: 'おっと、目的地が雲に隠れちまった！いったん引き返すぜ。'
  };

  /* =========================================================
   *  アイコン・鷲SVG
   * ========================================================= */
  const ICON = {
    eye: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  function eagleSVG(mode) {
    const wing = `
      <g class="wing-g">
        <path class="wing" d="M108 78 C 94 60, 66 46, 12 40 C 24 48, 30 52, 37 55 C 24 59, 16 63, 9 71 C 25 71, 37 69, 46 69 C 36 75, 30 81, 26 90 C 44 85, 60 85, 74 87 C 66 92, 62 98, 60 105 C 78 96, 96 94, 112 98 Z"/>
        <path class="wing-tip" d="M40 56 C 60 58, 80 64, 98 74 M48 70 C 66 72, 84 78, 100 86"/>
      </g>`;
    return `
<svg class="eagle ${mode === 'fly' ? 'eagle-fly' : ''}" viewBox="0 0 240 170" role="img" aria-label="イーグル隊長">
  <g>${wing}</g>
  <g transform="translate(240 0) scale(-1 1)">${wing}</g>
  <path class="leg" d="M110 118 L106 150 M130 118 L134 150"/>
  <path class="claw" d="M106 150 l-8 8 M106 150 l0 10 M106 150 l8 8 M134 150 l-8 8 M134 150 l0 10 M134 150 l8 8"/>
  <ellipse class="body" cx="120" cy="96" rx="30" ry="34"/>
  <ellipse class="belly" cx="120" cy="104" rx="17" ry="20"/>
  <path class="scarf scarf-tail" d="M138 76 L172 90 L162 94 L178 104 L140 90 Z"/>
  <path class="scarf" d="M95 70 Q120 84 145 70 L147 81 Q120 95 93 81 Z"/>
  <circle class="head" cx="120" cy="50" r="25"/>
  <path class="strap" d="M96 38 Q120 26 144 38"/>
  <circle class="goggle" cx="109" cy="34" r="8.5"/>
  <circle class="goggle" cx="131" cy="34" r="8.5"/>
  <path class="brow" d="M104 47 L115 49 M136 47 L125 49"/>
  <circle class="eye-dot" cx="111" cy="54" r="3.6"/>
  <circle class="eye-dot" cx="129" cy="54" r="3.6"/>
  <path class="beak" d="M111 60 Q120 56 129 60 Q130 72 121 79 Q119 72 114 68 Z"/>
</svg>`;
  }

  /* =========================================================
   *  セッション・設定
   * ========================================================= */
  const Session = {
    key: C.SESSION_KEY || 'abf_session',
    get() { try { return JSON.parse(localStorage.getItem(this.key) || 'null'); } catch { return null; } },
    set(v) { try { localStorage.setItem(this.key, JSON.stringify(v)); } catch { /* noop */ } },
    clear() { try { localStorage.removeItem(this.key); } catch { /* noop */ } }
  };
  const Prefs = {
    key: C.PREFS_KEY || 'abf_prefs',
    get() { try { return Object.assign({ voice: 0.9, se: 0.6 }, JSON.parse(localStorage.getItem(this.key) || '{}')); } catch { return { voice: 0.9, se: 0.6 }; } },
    set(v) { try { localStorage.setItem(this.key, JSON.stringify(v)); } catch { /* noop */ } }
  };

  const State = { history: [], serverVersion: '' };

  /* =========================================================
   *  API（GAS）
   * ========================================================= */
  async function api(action, payload = {}) {
    if (isPlaceholder(C.GAS_URL)) throw new Error('config.js の GAS_URL が未設定です');
    const s = Session.get();
    let res;
    try {
      res = await fetch(C.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token: s && s.token, ...payload })
      });
    } catch {
      throw new Error('サーバーに接続できませんでした。通信環境を確認してください');
    }
    let data;
    try { data = await res.json(); } catch { throw new Error('サーバーの応答を読み取れませんでした'); }
    if (data.version && data.version !== State.serverVersion) { State.serverVersion = data.version; renderVersion(); }
    if (!data.ok) {
      const e = new Error(data.error || 'エラーが発生しました');
      e.code = data.code;
      if (data.code === 'AUTH') { Session.clear(); stopEverything(); showView('auth'); setMsg($('#auth-msg'), e.message, 'error'); }
      if (data.code === 'MUST_CHANGE') { showView('change'); }
      throw e;
    }
    return data;
  }

  /* =========================================================
   *  画面切り替え
   * ========================================================= */
  const VIEWS = ['auth', 'change', 'home', 'flight', 'arrival'];
  function showView(name) {
    VIEWS.forEach((v) => { const el = $('#view-' + v); if (el) el.hidden = v !== name; });
    $('#topbar').hidden = name === 'auth';
    $('#voicebar').hidden = !(name === 'flight' || name === 'arrival');
    $('#btn-replay').hidden = name !== 'arrival';
    document.body.dataset.view = name;
    window.scrollTo(0, 0);
  }

  function setMsg(el, text, type) {
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-ok', type === 'ok');
  }

  function setBusy(form, busy, label) {
    const btn = form.querySelector('[type="submit"]');
    if (!btn) return;
    if (busy) { btn.dataset.label = btn.textContent; btn.textContent = label || '送信中…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }

  function renderVersion() {
    const front = C.APP_VERSION || '';
    const back = State.serverVersion ? `（サーバー v${State.serverVersion}）` : '';
    $('#app-version').textContent = front + back;
  }

  /* =========================================================
   *  認証
   * ========================================================= */
  function switchAuthTab(name) {
    $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    ['login', 'register', 'forgot'].forEach((n) => { $('#form-' + n).hidden = n !== name; });
  }

  function bindAuth() {
    $$('.tab').forEach((t) => t.addEventListener('click', () => { switchAuthTab(t.dataset.tab); setMsg($('#auth-msg'), ''); }));

    document.addEventListener('click', (e) => {
      const b = e.target.closest('.eye');
      if (!b) return;
      const input = document.getElementById(b.getAttribute('aria-controls'));
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.setAttribute('aria-pressed', String(show));
      b.setAttribute('aria-label', show ? 'パスワードを隠す' : 'パスワードを表示');
      b.innerHTML = show ? ICON.eyeOff : ICON.eye;
    });

    $('#form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const email = f.email.value.trim();
      const password = f.password.value;
      if (!email || !password) return setMsg($('#auth-msg'), 'メールアドレスとパスワードを入力してください', 'error');
      setBusy(f, true, 'ログイン中…'); setMsg($('#auth-msg'), '');
      try {
        const r = await api('login', { email, password });
        Session.set({ token: r.token, nickname: r.nickname, mustChange: r.mustChange });
        f.reset();
        if (r.mustChange) openChange(true); else enterHome();
      } catch (err) {
        setMsg($('#auth-msg'), err.message, 'error');
      } finally { setBusy(f, false); }
    });

    $('#form-register').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const nickname = f.nickname.value.trim();
      const email = f.email.value.trim();
      if (!nickname || !email) return setMsg($('#auth-msg'), 'ニックネームとメールアドレスを入力してください', 'error');
      setBusy(f, true); setMsg($('#auth-msg'), '');
      try {
        const r = await api('register', { nickname, email });
        f.reset();
        switchAuthTab('login');
        $('#login-email').value = email;
        setMsg($('#auth-msg'), r.message, 'ok');
      } catch (err) {
        setMsg($('#auth-msg'), err.message, 'error');
      } finally { setBusy(f, false); }
    });

    $('#form-forgot').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const email = f.email.value.trim();
      if (!email) return setMsg($('#auth-msg'), 'メールアドレスを入力してください', 'error');
      setBusy(f, true); setMsg($('#auth-msg'), '');
      try {
        const r = await api('forgotPassword', { email });
        f.reset();
        switchAuthTab('login');
        $('#login-email').value = email;
        setMsg($('#auth-msg'), r.message, 'ok');
      } catch (err) {
        setMsg($('#auth-msg'), err.message, 'error');
      } finally { setBusy(f, false); }
    });

    $('#form-change').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const currentPassword = f.currentPassword.value;
      const newPassword = f.newPassword.value;
      if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return setMsg($('#change-msg'), '新しいパスワードは8文字以上で、英字と数字を両方含めてください', 'error');
      }
      if (newPassword !== f.confirm.value) return setMsg($('#change-msg'), '確認用のパスワードが一致しません', 'error');
      setBusy(f, true, '変更中…'); setMsg($('#change-msg'), '');
      try {
        const r = await api('changePassword', { currentPassword, newPassword });
        const s = Session.get() || {};
        s.mustChange = false; s.nickname = r.nickname || s.nickname;
        Session.set(s);
        f.reset();
        enterHome();
      } catch (err) {
        setMsg($('#change-msg'), err.message, 'error');
      } finally { setBusy(f, false); }
    });

    $('#btn-change-cancel').addEventListener('click', () => enterHome());

    $('#btn-logout').addEventListener('click', async () => {
      stopEverything();
      try { await api('logout'); } catch { /* noop */ }
      Session.clear();
      MAPS_KEY = '';
      mapsKeyP = null;
      switchAuthTab('login');
      showView('auth');
      setMsg($('#auth-msg'), 'ログアウトしました', 'ok');
    });
  }

  function openChange(forced) {
    $('#change-note').textContent = forced
      ? '仮パスワードでログインしました。ご自分だけのパスワードに変更してください（8文字以上・英字と数字を含む）。'
      : '新しいパスワードを入力してください（8文字以上・英字と数字を含む）。';
    $('#btn-change-cancel').hidden = !!forced;
    setMsg($('#change-msg'), '');
    showView('change');
  }

  function enterHome() {
    const s = Session.get() || {};
    $('#who').textContent = (s.nickname || '相棒') + ' さん';
    $('#pass-nickname').textContent = s.nickname || '相棒';
    setMsg($('#history-msg'), '');
    showView('home');
    ensureMapsKey();
    loadHistory();
  }

  /* =========================================================
   *  ホーム・履歴
   * ========================================================= */
  function bindHome() {
    $('#form-flight').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const place = f.place.value.trim();
      if (!place) { setMsg($('#flight-msg'), '行き先を入力してください', 'error'); f.place.focus(); return; }
      setMsg($('#flight-msg'), '');
      startFlight({ place, era: f.era.value, memory: f.memory.value.trim() });
    });

    $('#view-home').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const item = State.history.find((x) => x.id === b.dataset.id);
      if (!item) return;
      const act = b.dataset.act;
      if (act === 'view') viewPlace(item, b);
      else if (act === 'fly') {
        const p = item.plan;
        startFlight({ place: p.place.query, era: p.era || '', memory: p.memory || '' }, p);
      }
      else if (act === 'save') setSaved(item, true, b);
      else if (act === 'unsave') setSaved(item, false, b);
      else if (act === 'delete') deleteFlight(item, b);
    });
  }

  async function loadHistory() {
    const places = $('#places-list');
    const recent = $('#history-list');
    places.innerHTML = '<p class="muted">読み込み中…</p>';
    recent.innerHTML = '';
    try {
      const r = await api('history');
      State.history = r.items || [];
      renderHistory();
    } catch (err) {
      places.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    }
  }

  function historyItemHtml(it) {
    const p = it.plan || {};
    const name = (p.script && p.script.placeName) || (p.place && p.place.query) || '';
    const id = esc(it.id);
    return `<div class="history-item${it.saved ? ' is-saved' : ''}">
      <div class="item-head">
        <strong>${esc(name)}</strong>
        ${it.photoCount ? `<span class="badge">写真${it.photoCount}枚</span>` : ''}
      </div>
      <span class="meta">${esc(p.place && p.place.address)}<br>${esc(it.date)}${p.era ? '／' + esc(p.era) : ''}</span>
      <div class="item-actions">
        <button type="button" class="btn btn-primary" data-act="view" data-id="${id}">見る</button>
        <button type="button" class="btn btn-ghost" data-act="fly" data-id="${id}">もう一度飛ぶ</button>
        ${it.saved
          ? `<button type="button" class="btn btn-ghost" data-act="unsave" data-id="${id}">登録を外す</button>`
          : `<button type="button" class="btn btn-ghost" data-act="save" data-id="${id}">思い出の場所に登録</button>`}
        <button type="button" class="link-danger" data-act="delete" data-id="${id}">削除</button>
      </div>
    </div>`;
  }

  function renderHistory() {
    const saved = State.history.filter((x) => x.saved);
    const recent = State.history.filter((x) => !x.saved);
    $('#places-list').innerHTML = saved.length
      ? saved.map(historyItemHtml).join('')
      : '<p class="empty">まだ登録された思い出の場所はありません。到着画面や「最近のフライト」の「思い出の場所に登録」から登録できます。</p>';
    $('#history-list').innerHTML = recent.length
      ? recent.map(historyItemHtml).join('')
      : '<p class="empty">最近のフライトはありません。搭乗券に行き先を書いて、隊長と飛んでみましょう。</p>';
  }

  // 飛ばずに到着画面を開く
  async function viewPlace(item, btn) {
    unlockAudio();
    btn.disabled = true;
    btn.textContent = '開いています…';
    try {
      const pano = await StreetView.find(item.plan.place);
      showArrival(item.plan, { pano, autoplay: false });
    } finally {
      btn.disabled = false;
      btn.textContent = '見る';
    }
  }

  async function setSaved(item, saved, btn) {
    if (btn) btn.disabled = true;
    try {
      const r = await api('savePlace', { id: item.id, saved });
      item.saved = r.saved;
      renderHistory();
      setMsg($('#history-msg'), r.message, 'ok');
    } catch (err) {
      setMsg($('#history-msg'), err.message, 'error');
      if (btn) btn.disabled = false;
    }
  }

  async function deleteFlight(item, btn) {
    const p = item.plan || {};
    const name = (p.script && p.script.placeName) || (p.place && p.place.query) || 'この場所';
    if (!window.confirm(`「${name}」の記録を削除しますか？（元に戻せません）`)) return;
    let deletePhotos = false;
    if (item.photoCount) {
      deletePhotos = window.confirm(
        `この場所の思い出の写真が${item.photoCount}枚あります。写真も一緒に削除しますか？\n\n`
        + '「OK」：写真も削除する\n「キャンセル」：写真は残す（同じ場所へ飛ぶとまた表示されます）');
    }
    btn.disabled = true;
    try {
      const r = await api('deleteFlight', { id: item.id, deletePhotos });
      State.history = State.history.filter((x) => x.id !== item.id);
      if (deletePhotos) {
        const key = placeKeyOf(p.place);
        State.history.forEach((x) => { if (placeKeyOf(x.plan.place) === key) x.photoCount = 0; });
      }
      renderHistory();
      setMsg($('#history-msg'), r.message, 'ok');
    } catch (err) {
      setMsg($('#history-msg'), err.message, 'error');
      btn.disabled = false;
    }
  }

  function placeKeyOf(place) {
    return place ? `${Number(place.lat).toFixed(4)}_${Number(place.lng).toFixed(4)}` : '';
  }

  /* =========================================================
   *  オーディオ
   * ========================================================= */
  function b64ToBytes(b64) {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function wavHeader(dataLen, rate, ch = 1, bits = 16) {
    const b = new ArrayBuffer(44);
    const v = new DataView(b);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); w(8, 'WAVE');
    w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * ch * bits / 8, true);
    v.setUint16(32, ch * bits / 8, true); v.setUint16(34, bits, true);
    w(36, 'data'); v.setUint32(40, dataLen, true);
    return b;
  }
  function audioToUrl(b64, mime) {
    if (!b64) return null;
    mime = mime || '';
    if (/wav|mpeg|mp3|ogg|webm/i.test(mime)) return URL.createObjectURL(new Blob([b64ToBytes(b64)], { type: mime }));
    const m = /rate=(\d+)/.exec(mime);
    const rate = m ? Number(m[1]) : 24000;
    const pcm = b64ToBytes(b64);
    return URL.createObjectURL(new Blob([wavHeader(pcm.length, rate), pcm], { type: 'audio/wav' }));
  }
  const SILENT_WAV = URL.createObjectURL(new Blob([wavHeader(4800, 24000), new Uint8Array(4800)], { type: 'audio/wav' }));

  function driveUrl(id) { return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`; }
  function assetCandidates(a) {
    if (!a) return [];
    const out = [];
    if (a.url) out.push(a.url);
    if (a.driveId) out.push(driveUrl(a.driveId));
    return out;
  }
  function videoAsset(phase, place) {
    const sp = (C.SPECIAL_FLIGHTS || []).find((f) => (f.keywords || []).some((k) => place.includes(k)));
    return (sp && sp[phase]) || (C.ASSETS && C.ASSETS.video && C.ASSETS.video[phase]) || null;
  }

  /* 隊長の声 */
  const Voice = {
    el: new Audio(),
    cache: new Map(),
    vol: 0.9,
    seq: 0,
    resolve: null,
    mode: null,
    timer: null,
    quotaOut: false,

    fetch(text) {
      if (!text) return Promise.resolve(null);
      if (this.cache.has(text)) return this.cache.get(text);
      if ((C.TTS && C.TTS.useGemini === false) || this.quotaOut) return Promise.resolve(null);
      const p = api('tts', { text })
        .then((r) => audioToUrl(r.audio, r.mimeType))
        .catch((err) => {
          if (err && err.code === 'TTS_QUOTA') {
            // 今日の上限に達したら、以降はブラウザの声で読む（失敗した文は次回やり直せるよう消す）
            this.quotaOut = true;
            $('#voice-note').hidden = false;
          }
          this.cache.delete(text);
          return null;
        });
      this.cache.set(text, p);
      return p;
    },
    prefetch(list) { (list || []).filter(Boolean).forEach((t) => this.fetch(t)); },

    speak(text, opts = {}) {
      this.stop();
      if (!text) return Promise.resolve();
      const id = ++this.seq;
      return new Promise((resolve) => {
        this.resolve = resolve;
        setPlayUI(true);
        this.fetch(text).then((url) => {
          if (id !== this.seq) return;
          if (url) {
            this.mode = 'audio';
            this.el.src = url;
            this.el.volume = this.vol;
            this.el.onended = () => this._done(id);
            this.el.onerror = () => this._fallback(text, id, opts);
            this.el.ontimeupdate = opts.onProgress
              ? () => { const d = this.el.duration; if (d && isFinite(d)) opts.onProgress(this.el.currentTime / d); }
              : null;
            this.el.play().catch(() => this._fallback(text, id, opts));
          } else {
            this._fallback(text, id, opts);
          }
        });
      });
    },
    _fallback(text, id, opts = {}) {
      if (id !== this.seq || this.fbId === id) return;
      this.fbId = id;
      if (C.TTS && C.TTS.fallbackWebSpeech !== false && 'speechSynthesis' in window) {
        this.mode = 'speech';
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ja-JP'; u.rate = 1.05; u.pitch = 0.85; u.volume = this.vol;
        u.onend = () => this._done(id);
        u.onerror = () => this._done(id);
        if (opts.onProgress) u.onboundary = (e) => opts.onProgress(e.charIndex / text.length);
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      } else {
        this.mode = 'timer';
        this.timer = setTimeout(() => this._done(id), Math.max(2500, text.length * 170));
      }
    },
    _done(id) {
      if (id !== undefined && id !== this.seq) return;
      const r = this.resolve;
      this.resolve = null;
      this.mode = null;
      setPlayUI(false);
      if (r) r();
    },
    stop() {
      this.seq++;
      try { this.el.pause(); } catch { /* noop */ }
      this.el.onended = null; this.el.onerror = null; this.el.ontimeupdate = null;
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      clearTimeout(this.timer);
      this._done();
    },
    togglePause() {
      if (this.mode === 'audio') {
        if (this.el.paused) { this.el.play().catch(() => {}); setPlayUI(true); }
        else { this.el.pause(); setPlayUI(false, true); }
      } else if (this.mode === 'speech') {
        if (speechSynthesis.paused) { speechSynthesis.resume(); setPlayUI(true); }
        else { speechSynthesis.pause(); setPlayUI(false, true); }
      }
    },
    // 再生中の音声を割合（0〜1）の位置へ移動
    seek(frac) {
      if (this.mode !== 'audio') return false;
      const d = this.el.duration;
      if (!d || !isFinite(d)) return false;
      this.el.currentTime = Math.max(0, Math.min(d - 0.05, d * frac));
      return true;
    },
    setVolume(v) { this.vol = v; this.el.volume = v; }
  };

  function setPlayUI(playing, paused) {
    const b = $('#btn-play');
    if (!b) return;
    const showPause = playing || (!paused && Voice.mode);
    b.textContent = showPause ? '一時停止' : '再生';
    b.setAttribute('aria-label', b.textContent);
  }

  /* 効果音 */
  const SE = {
    els: {},
    vol: 0.6,
    el(name) {
      if (this.els[name] !== undefined) return this.els[name];
      const list = assetCandidates(C.ASSETS && C.ASSETS.se && C.ASSETS.se[name]);
      if (!list.length) { this.els[name] = null; return null; }
      const a = new Audio();
      a.preload = 'auto';
      let i = 0;
      a.onerror = () => { if (i < list.length) a.src = list[i++]; };
      a.src = list[i++];
      this.els[name] = a;
      return a;
    },
    play(name) {
      const a = this.el(name); if (!a) return;
      a.loop = false; try { a.currentTime = 0; } catch { /* noop */ }
      a.volume = this.vol; a.play().catch(() => {});
    },
    loop(name) {
      const a = this.el(name); if (!a) return;
      a.loop = true; a.volume = this.vol * 0.7; a.play().catch(() => {});
    },
    stop(name) {
      const a = this.els[name];
      if (a) { a.pause(); try { a.currentTime = 0; } catch { /* noop */ } }
    },
    stopAll() { Object.keys(this.els).forEach((k) => this.stop(k)); },
    setVolume(v) {
      this.vol = v;
      Object.values(this.els).forEach((a) => { if (a) a.volume = a.loop ? v * 0.7 : v; });
    }
  };

  let audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    try {
      Voice.el.src = SILENT_WAV;
      Voice.el.play().then(() => Voice.el.pause()).catch(() => {});
    } catch { /* noop */ }
    ['cry', 'wind', 'whoosh'].forEach((n) => {
      const a = SE.el(n);
      if (!a) return;
      a.muted = true;
      a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
    });
    if ('speechSynthesis' in window) {
      try { const u = new SpeechSynthesisUtterance(''); u.volume = 0; speechSynthesis.speak(u); } catch { /* noop */ }
    }
  }

  /* 映像 */
  const Video = {
    get el() { return $('#video'); },
    play(asset, { loop = false, minMs = 0 } = {}) {
      const list = assetCandidates(asset);
      const st = $('#stage');
      const v = this.el;
      const start = Date.now();
      return new Promise((resolve) => {
        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          setTimeout(resolve, Math.max(0, minMs - (Date.now() - start)));
        };
        const fallback = () => {
          st.classList.add('no-video');
          v.onerror = null;
          if (!loop) setTimeout(done, Math.max(minMs, 4000));
        };
        let i = 0;
        const tryNext = () => {
          if (i >= list.length) return fallback();
          const src = list[i++];
          v.loop = loop; v.muted = true; v.playsInline = true;
          v.onerror = tryNext;
          v.onended = loop ? null : done;
          st.classList.remove('no-video');
          v.src = src;
          const pr = v.play();
          if (pr) pr.catch((err) => { if (err && err.name === 'NotAllowedError') fallback(); });
        };
        tryNext();
        if (loop) resolve();
        else setTimeout(done, 45000); // 安全装置
      });
    },
    stop() { const v = this.el; v.onended = null; v.onerror = null; v.pause(); }
  };

  /* =========================================================
   *  地理計算
   * ========================================================= */
  const toRad = (d) => d * Math.PI / 180;
  const toDeg = (r) => r * 180 / Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ll = (p) => ({ lat: Number(p.lat), lng: Number(p.lng), altitude: 0 });
  function distM(a, b) {
    const R = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function bearing(a, b) {
    const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
    const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  }

  /* =========================================================
   *  Google Maps（3D地図・ストリートビュー）
   * ========================================================= */
  // Maps APIキーは GAS のスクリプトプロパティ（GOOGLE_MAPS_API_KEY）からログイン後に受け取る
  let MAPS_KEY = '';
  let mapsKeyP = null;
  function ensureMapsKey() {
    if (MAPS_KEY) return Promise.resolve(MAPS_KEY);
    if (!mapsKeyP) {
      mapsKeyP = api('mapsKey')
        .then((r) => { MAPS_KEY = r.key || ''; if (!MAPS_KEY) mapsKeyP = null; return MAPS_KEY; })
        .catch(() => { mapsKeyP = null; return ''; });
    }
    return mapsKeyP;
  }
  const F3 = Object.assign({
    enabled: true,
    mapsVersion: 'beta',
    mode: 'HYBRID',
    useGeolocation: true,
    defaultStart: { name: '東京駅', lat: 35.681236, lng: 139.767125 }
  }, C.FLIGHT3D || {});

  const Maps = {
    promise: null, loaded: false, authFailed: false,
    get ok() { return this.loaded && !this.authFailed; }
  };
  window.gm_authFailure = () => { Maps.authFailed = true; console.warn('Google Maps: APIキーの認証に失敗しました'); };

  function loadMaps() {
    if (Maps.promise) return Maps.promise;
    Maps.promise = ensureMapsKey().then(() => new Promise((resolve, reject) => {
      if (isPlaceholder(MAPS_KEY)) { Maps.promise = null; reject(new Error('Maps APIキーが未設定です')); return; }
      window.__abfMapsReady = () => { Maps.loaded = true; resolve(window.google.maps); };
      const s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js'
        + `?key=${encodeURIComponent(MAPS_KEY)}`
        + `&v=${encodeURIComponent(F3.mapsVersion || 'beta')}`
        + '&language=ja&region=JP&loading=async&callback=__abfMapsReady';
      s.async = true;
      s.onerror = () => reject(new Error('Google Maps を読み込めませんでした'));
      document.head.appendChild(s);
    }));
    Maps.promise.catch(() => {});
    return Maps.promise;
  }

  function hasWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch { return false; }
  }

  // 出発地＝現在地（使えなければ既定の出発地）
  function getStart() {
    const def = F3.defaultStart;
    const fallback = { lat: def.lat, lng: def.lng, label: `${def.name}（現在地が使えないため）` };
    if (F3.useGeolocation === false || !navigator.geolocation) return Promise.resolve({ ...fallback, label: def.name });
    return new Promise((resolve) => {
      let done = false;
      const fin = (v) => { if (!done) { done = true; resolve(v); } };
      navigator.geolocation.getCurrentPosition(
        (p) => fin({ lat: p.coords.latitude, lng: p.coords.longitude, label: '現在地' }),
        () => fin(fallback),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
      );
      setTimeout(() => fin(fallback), 13000);
    });
  }

  /* 3D地図フライト（Google の Photorealistic 3D 地図） */
  const Earth3D = {
    map: null, start: null, dest: null, heading: 0, cruiseRange: 4000, gen: 0, startLabel: '',

    available() { return F3.enabled !== false && !isPlaceholder(MAPS_KEY) && hasWebGL() && !Maps.authFailed; },

    async init() {
      const [, start] = await Promise.all([withTimeout(loadMaps(), 12000), getStart()]);
      const lib = await withTimeout(google.maps.importLibrary('maps3d'), 10000);
      if (!lib || !lib.Map3DElement) throw new Error('3D地図が使えません');
      if (Maps.authFailed) throw new Error('APIキーの認証に失敗しました');

      this.teardown();
      this.gen++;
      this.start = start;
      this.startLabel = start.label;
      this.dest = null;
      this.heading = 0;

      const mode = (lib.MapMode && lib.MapMode[F3.mode]) || F3.mode || 'HYBRID';
      const opts = { center: ll(start), range: 400, tilt: 65, heading: 0, mode };
      let map;
      try { map = new lib.Map3DElement({ ...opts, defaultUIDisabled: true }); }
      catch { map = new lib.Map3DElement(opts); }
      $('#earth3d').append(map);
      this.map = map;

      await this.waitSteady(9000);
      if (Maps.authFailed) throw new Error('APIキーの認証に失敗しました');
    },

    waitSteady(ms) {
      return new Promise((resolve) => {
        const m = this.map;
        let done = false;
        const fin = () => { if (done) return; done = true; m.removeEventListener('gmp-steadychange', on); resolve(); };
        const on = (e) => { if (!e || e.isSteady === undefined || e.isSteady) fin(); };
        m.addEventListener('gmp-steadychange', on);
        setTimeout(fin, ms);
      });
    },

    fly(endCamera, ms) {
      return new Promise((resolve) => {
        const m = this.map;
        if (!m) { resolve(); return; }
        const t0 = Date.now();
        let done = false;
        const fin = () => { if (done) return; done = true; m.removeEventListener('gmp-animationend', on); resolve(); };
        const on = () => { if (Date.now() - t0 > 400) fin(); };
        m.addEventListener('gmp-animationend', on);
        try { m.flyCameraTo({ endCamera, durationMillis: ms }); } catch (e) { console.warn(e); fin(); }
        setTimeout(fin, ms + 2000);
      });
    },

    around(camera, ms) {
      const m = this.map;
      if (!m) return;
      try { m.flyCameraAround({ camera, durationMillis: ms, repeatCount: 1 }); }
      catch { try { m.flyCameraAround({ camera, durationMillis: ms, rounds: 1 }); } catch { /* noop */ } }
    },

    stopAnim() { try { this.map && this.map.stopCameraAnimation(); } catch { /* noop */ } },

    // 離陸：現在地の上空へ上昇
    takeoff() {
      return this.fly({ center: ll(this.start), range: 3000, tilt: 55, heading: 0 }, 5000);
    },
    // 目的地が決まるまで出発地の上空を旋回
    idleStart() {
      this.around({ center: ll(this.start), range: 3000, tilt: 55, heading: 0 }, 60000);
    },
    // 巡航：上昇 → 目的地上空へ
    async cruise(plan) {
      const g = this.gen;
      const dest = { lat: Number(plan.place.lat), lng: Number(plan.place.lng) };
      this.dest = dest;
      const d = distM(this.start, dest);
      const h = d > 50 ? bearing(this.start, dest) : 0;
      this.heading = h;
      this.cruiseRange = clamp(d * 0.35, 3500, 150000);

      this.stopAnim();
      await this.fly({ center: ll(this.start), range: this.cruiseRange, tilt: 45, heading: h }, 3500);
      if (g !== this.gen) return;
      await this.fly({ center: ll(dest), range: this.cruiseRange, tilt: 45, heading: h }, clamp(8000 + d / 1000 * 15, 9000, 24000));
      if (g !== this.gen) return;
      // 実況が続いている間は目的地上空を旋回して待つ
      this.around({ center: ll(dest), range: this.cruiseRange, tilt: 45, heading: h }, 60000);
    },
    // 急降下：目的地の真上へ
    async dive() {
      const g = this.gen;
      if (!this.dest) return;
      this.stopAnim();
      const c = ll(this.dest);
      if (this.cruiseRange > 3000) {
        await this.fly({ center: c, range: 1200, tilt: 58, heading: this.heading }, this.cruiseRange > 30000 ? 3500 : 2200);
        if (g !== this.gen) return;
      }
      await this.fly({ center: c, range: 180, tilt: 72, heading: this.heading }, 2800);
    },
    stop() { this.gen++; this.stopAnim(); },
    teardown() {
      this.stop();
      if (this.map) { try { this.map.remove(); } catch { /* noop */ } }
      this.map = null;
      $('#earth3d').innerHTML = '';
    }
  };

  /* 予備：Earth Studio 映像（3D地図が使えない環境用） */
  const VideoEngine = {
    place: '',
    takeoff(input) { this.place = input.place; return Video.play(videoAsset('takeoff', this.place), { minMs: 3500 }); },
    idleStart() { Video.play(videoAsset('cruise', this.place), { loop: true }); },
    cruise() { return Promise.resolve(); },
    dive() { return Video.play(videoAsset('dive', this.place), { minMs: 3000 }); },
    stop() { Video.stop(); },
    teardown() { Video.stop(); }
  };

  async function chooseEngine(input) {
    const st = $('#stage');
    await ensureMapsKey();
    if (Earth3D.available()) {
      try {
        await Earth3D.init();
        st.classList.add('mode-3d');
        st.classList.remove('mode-video');
        $('#attribution').textContent = '';
        $('#hud-from').textContent = '出発：' + Earth3D.startLabel;
        return Earth3D;
      } catch (e) {
        console.warn('3D地図フライトを使えないため映像モードにします:', e);
        Earth3D.teardown();
      }
    }
    st.classList.add('mode-video');
    st.classList.remove('mode-3d');
    $('#attribution').textContent = C.EARTH_ATTRIBUTION || '';
    $('#hud-from').textContent = '';
    VideoEngine.place = input.place;
    return VideoEngine;
  }

  /* ストリートビュー */
  const StreetView = {
    // 目的地の近くにあるパノラマを探す（50m → 250m → 1km）
    async find(place) {
      try {
        await withTimeout(loadMaps(), 10000);
        if (!Maps.ok) return null;
        const lib = await google.maps.importLibrary('streetView');
        const svc = new lib.StreetViewService();
        const pref = (lib.StreetViewPreference && lib.StreetViewPreference.NEAREST) || 'nearest';
        for (const radius of [50, 250, 1000]) {
          try {
            const r = await withTimeout(svc.getPanorama({ location: { lat: Number(place.lat), lng: Number(place.lng) }, radius, preference: pref }), 6000);
            const loc = r && r.data && r.data.location;
            if (loc && loc.pano) return { pano: loc.pano, lat: loc.latLng.lat(), lng: loc.latLng.lng() };
          } catch { /* 次の半径へ */ }
        }
      } catch { /* noop */ }
      return null;
    },
    async show(container, pano, place) {
      const lib = await google.maps.importLibrary('streetView');
      container.innerHTML = '';
      const target = { lat: Number(place.lat), lng: Number(place.lng) };
      const heading = distM(pano, target) > 8 ? bearing(pano, target) : 0;
      return new lib.StreetViewPanorama(container, {
        pano: pano.pano,
        pov: { heading, pitch: 4 },
        zoom: 0,
        addressControl: false,
        fullscreenControl: true,
        motionTracking: false,
        motionTrackingControl: false,
        showRoadLabels: false,
        enableCloseButton: false
      });
    }
  };

  /* =========================================================
   *  フライト演出
   * ========================================================= */
  const Flight = { run: 0, skip: false, skipP: null, skipResolve: null, plan: null, input: null, engine: null };

  function track(p) {
    const t = { done: false, value: undefined, error: null };
    t.p = p.then((v) => { t.done = true; t.value = v; return v; }, (e) => { t.done = true; t.error = e; throw e; });
    t.p.catch(() => {});
    return t;
  }
  const alive = (run) => run === Flight.run;
  const race = (p) => Promise.race([p, Flight.skipP]);

  function setPhase(phase, label) {
    $('#stage').dataset.phase = phase;
    $('#hud-phase').textContent = label;
  }
  function sayFlight(text) {
    const b = $('#bubble');
    b.textContent = text;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    $('#telop').textContent = text;
  }
  async function talk(text) {
    if (!text) return;
    sayFlight(text);
    await race(Voice.speak(text));
  }

  async function startFlight(input, cachedPlan) {
    unlockAudio();
    Guide.stop();
    Voice.stop();
    if (Flight.engine) Flight.engine.teardown();
    const run = ++Flight.run;
    Flight.input = input;
    Flight.plan = null;
    Flight.skip = false;
    Flight.skipP = new Promise((r) => { Flight.skipResolve = r; });

    showView('flight');
    const st = $('#stage');
    st.classList.remove('landed', 'mode-3d', 'mode-video');
    st.classList.add('no-video');
    $('#stage-pano').innerHTML = '';
    $('#flight-error').hidden = true;
    $('#btn-skip-flight').disabled = false;
    $('#btn-skip-flight').hidden = false;
    $('#hud-place').textContent = input.place;
    $('#hud-from').textContent = '';
    $('#attribution').textContent = '';
    setPhase('ready', '離陸準備中');
    sayFlight(LINES.preparing);

    const planT = track(cachedPlan ? Promise.resolve(cachedPlan) : api('planFlight', input).then((r) => r.plan));
    planT.p.then((p) => {
      Flight.plan = p;
      const s = p.script || {};
      Voice.prefetch([...(s.cruise || []), s.dive, s.arrival]);
    }).catch(() => {});

    const takeoffLine = pick(LINES.takeoff).replace('{place}', input.place);
    const fillers = shuffle(LINES.filler.slice());
    Voice.prefetch([takeoffLine, fillers[0]]);

    // 3D地図（または映像）の準備と、離陸セリフの音声づくりを同時に進める
    const engineP = chooseEngine(input);
    await Promise.all([
      engineP,
      Promise.race([Voice.fetch(takeoffLine), sleep(7000), planT.p.catch(() => {})])
    ]);
    const engine = await engineP;
    Flight.engine = engine;
    if (!alive(run)) { engine.teardown(); return; }
    if (planT.error) return flightFailed(planT.error, run);

    // ---- 離陸（現在地の上空へ） ----
    setPhase('takeoff', '離陸！');
    SE.play('cry');
    await Promise.all([race(engine.takeoff(input)), talk(takeoffLine)]);
    if (!alive(run)) return;

    // ---- 目的地の確定を待ちながら旋回 ----
    setPhase('cruise', '上空を巡航中');
    if (!Flight.skip) SE.loop('wind');
    engine.idleStart();
    const cruiseStart = Date.now();
    let fi = 0;
    while (!planT.done && fi < fillers.length && !Flight.skip && alive(run)) {
      Voice.prefetch([fillers[fi + 1]]);
      await talk(fillers[fi++]);
    }
    if (!planT.done && alive(run)) sayFlight(Flight.skip ? LINES.skipWait : LINES.waiting);

    let plan;
    try { plan = await planT.p; } catch (err) { if (alive(run)) flightFailed(err, run); return; }
    if (!alive(run)) return;
    const s = plan.script || {};

    // ---- 巡航（思い出の場所の上空へ） ----
    const cruiseP = Flight.skip ? Promise.resolve() : engine.cruise(plan);
    for (const line of (s.cruise || [])) {
      if (Flight.skip || !alive(run)) break;
      await talk(line);
    }
    await race(cruiseP);
    if (engine === VideoEngine) {
      const rest = (Number(C.CRUISE_MIN_SECONDS) || 0) * 1000 - (Date.now() - cruiseStart);
      if (rest > 0 && !Flight.skip) await race(sleep(rest));
    }
    if (!alive(run)) return;

    // ---- 急降下 ----
    if (!Flight.skip) {
      setPhase('dive', '急降下！');
      SE.stop('wind');
      SE.play('whoosh');
      await Promise.all([race(engine.dive(plan)), talk(s.dive)]);
    }
    if (!alive(run)) return;
    SE.stop('wind');
    engine.stop();

    // ---- 着陸：ストリートビューに切り替え ----
    setPhase('landed', '到着！');
    $('#btn-skip-flight').hidden = true;
    const pano = await StreetView.find(plan.place);
    if (!alive(run)) return;
    let arrivalSpoken = false;
    if (pano) {
      try {
        await StreetView.show($('#stage-pano'), pano, plan.place);
        st.classList.add('landed');
      } catch (e) { console.warn(e); }
    }
    if (!Flight.skip && s.arrival) {
      sayFlight(s.arrival);
      await Voice.speak(s.arrival);
      arrivalSpoken = true;
      if (!alive(run)) return;
      await sleep(600);
    }
    if (!alive(run)) return;
    engine.teardown();
    showArrival(plan, { pano, arrivalSpoken });
  }

  function flightFailed(err, run) {
    if (!alive(run)) return;
    SE.stopAll();
    if (Flight.engine) Flight.engine.stop();
    Video.stop();
    Voice.stop();
    setPhase('ready', '引き返し中');
    sayFlight(LINES.failed);
    $('#flight-error-text').textContent = err && err.message ? err.message : '目的地の情報を取得できませんでした';
    $('#flight-error').hidden = false;
    $('#btn-skip-flight').disabled = true;
  }

  function stopEverything() {
    Flight.run++;
    if (Flight.skipResolve) Flight.skipResolve();
    Guide.stop();
    Voice.stop();
    SE.stopAll();
    if (Flight.engine) Flight.engine.teardown();
    Video.stop();
  }

  function bindFlight() {
    $('#btn-skip-flight').addEventListener('click', () => {
      Flight.skip = true;
      if (Flight.skipResolve) Flight.skipResolve();
      Voice.stop();
      SE.stop('wind');
      $('#btn-skip-flight').disabled = true;
      if (!Flight.plan) sayFlight(LINES.skipWait);
    });
    $('#btn-abort').addEventListener('click', () => { stopEverything(); enterHome(); });
    $('#btn-error-home').addEventListener('click', () => {
      stopEverything();
      enterHome();
      const f = $('#form-flight');
      if (Flight.input) { f.place.value = Flight.input.place; f.era.value = Flight.input.era || ''; f.memory.value = Flight.input.memory || ''; }
      f.place.focus();
    });
  }

  /* =========================================================
   *  到着：「あの場所は今」
   * ========================================================= */
  // 解説は「到着のひと言」以外をまとめて1回の音声にする（AI音声の回数を節約）
  const MERGE_GUIDE = !(C.TTS && C.TTS.mergeGuide === false);

  const Guide = {
    run: 0,
    segs: [],
    bounds: null,
    stop() {
      this.run++;
      this.bounds = null;
      Voice.stop();
      markSpeaking(null);
    },
    singles() { return MERGE_GUIDE ? this.segs.filter((x) => x.key === 'arrival') : this.segs; },
    body() { return MERGE_GUIDE ? this.segs.filter((x) => x.key !== 'arrival') : []; },
    mergedText() { return this.body().map((x) => x.text).join('\n'); },
    texts() {
      const t = this.singles().map((x) => x.text);
      if (this.body().length) t.push(this.mergedText());
      return t;
    },
    async play() {
      const run = ++this.run;
      this.bounds = null;
      for (const seg of this.singles()) {
        if (run !== this.run) return;
        markSpeaking(seg.key);
        if (seg.bubble) $('#arrival-bubble').textContent = seg.text;
        await Voice.speak(seg.text);
      }
      const body = this.body();
      if (body.length && run === this.run) {
        const text = this.mergedText();
        let acc = 0;
        this.bounds = body.map((x) => { const b = { key: x.key, start: acc / text.length, bubble: x.bubble, text: x.text }; acc += x.text.length + 1; return b; });
        let cur = -1;
        const onProgress = (f) => {
          if (run !== this.run || !this.bounds) return;
          let idx = 0;
          this.bounds.forEach((b, i) => { if (f >= b.start) idx = i; });
          if (idx === cur) return;
          cur = idx;
          const b = this.bounds[idx];
          markSpeaking(b.key);
          if (b.bubble) $('#arrival-bubble').textContent = b.text;
        };
        onProgress(0);
        await Voice.speak(text, { onProgress });
      }
      if (run === this.run) { this.bounds = null; markSpeaking(null); }
    },
    // 「次へ」：まとめた音声の中では次の段落へ移動
    next() {
      if (this.bounds && Voice.mode === 'audio') {
        const d = Voice.el.duration;
        const f = d ? Voice.el.currentTime / d : 0;
        const nb = this.bounds.find((b) => b.start > f + 0.01);
        if (nb && Voice.seek(nb.start)) return;
      }
      Voice.stop();
    }
  };

  function markSpeaking(key) {
    $$('.guide-sec').forEach((el) => el.classList.toggle('is-speaking', el.dataset.key === key));
    if (key) {
      const el = $(`.guide-sec[data-key="${key}"]`);
      if (el && window.matchMedia('(max-width: 860px)').matches) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  const Arrival = { plan: null, pano: null, saved: false };

  function showArrival(plan, opts = {}) {
    Arrival.plan = plan;
    Arrival.pano = opts.pano || null;
    const s = plan.script || {};
    const p = plan.place || {};
    showView('arrival');

    $('#arr-title').textContent = s.placeName || p.query || '';
    $('#arr-address').textContent = p.address || '';
    $('#arr-era').textContent = plan.era ? `思い出の時期：${plan.era}` : '';
    $('#arrival-bubble').textContent = s.arrival || '';
    $('#g-then').textContent = s.then || '';
    $('#g-now').textContent = s.now || '';
    $('#g-gap').textContent = s.gap || '';
    $('#g-trivia').textContent = s.trivia || '';

    const src = plan.sources || [];
    $('#sources').hidden = !src.length;
    $('#sources-list').innerHTML = src.map((x) =>
      `<li><a href="${esc(x.uri)}" target="_blank" rel="noopener">${esc(x.title)}</a></li>`).join('');

    $('#map-open').href = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
    $('#map-pano').innerHTML = '';
    $('#map-iframe').removeAttribute('src');
    setMapMode(Arrival.pano || !Maps.ok ? 'street' : 'aerial');

    Guide.segs = [
      { key: 'arrival', text: opts.arrivalSpoken ? '' : s.arrival, bubble: true },
      { key: 'then', text: s.then },
      { key: 'now', text: s.now },
      { key: 'gap', text: s.gap },
      { key: 'trivia', text: s.trivia },
      { key: 'closing', text: s.closing, bubble: true }
    ].filter((x) => x.text);
    Voice.prefetch(Guide.texts());
    if (opts.autoplay !== false) Guide.play();

    const hist = State.history.find((x) => x.id === plan.id);
    Arrival.saved = !!(hist && hist.saved);
    setMsg($('#save-place-msg'), '');
    updateSaveButton();

    Compare.setMode('side');
    Compare.renderNow(plan);
    Photos.load(plan);
  }

  function updateSaveButton() {
    const b = $('#btn-save-place');
    b.hidden = !(Arrival.plan && Arrival.plan.id);
    b.setAttribute('aria-pressed', String(Arrival.saved));
    b.textContent = Arrival.saved ? '思い出の場所に登録済み（外す）' : '思い出の場所に登録';
  }

  async function toggleSaveCurrent() {
    const plan = Arrival.plan;
    if (!plan || !plan.id) return;
    const b = $('#btn-save-place');
    b.disabled = true;
    try {
      const r = await api('savePlace', { id: plan.id, saved: !Arrival.saved });
      Arrival.saved = r.saved;
      const hist = State.history.find((x) => x.id === plan.id);
      if (hist) hist.saved = r.saved;
      updateSaveButton();
      setMsg($('#save-place-msg'), r.message, 'ok');
    } catch (err) {
      setMsg($('#save-place-msg'), err.message, 'error');
    } finally {
      b.disabled = false;
    }
  }

  function mapUrl(mode, lat, lng) {
    if (!isPlaceholder(MAPS_KEY)) {
      const key = encodeURIComponent(MAPS_KEY);
      if (mode === 'street') return `https://www.google.com/maps/embed/v1/streetview?key=${key}&location=${lat},${lng}&fov=80&language=ja`;
      if (mode === 'aerial') return `https://www.google.com/maps/embed/v1/view?key=${key}&center=${lat},${lng}&zoom=18&maptype=satellite&language=ja`;
      return `https://www.google.com/maps/embed/v1/place?key=${key}&q=${lat},${lng}&zoom=17&language=ja`;
    }
    if (mode === 'street') return null;
    return `https://maps.google.com/maps?q=${lat},${lng}&t=${mode === 'aerial' ? 'k' : 'm'}&z=${mode === 'aerial' ? 18 : 17}&hl=ja&output=embed`;
  }

  function setMapMode(mode) {
    const plan = Arrival.plan;
    if (!plan) return;
    const { lat, lng } = plan.place;
    $$('.map-tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.map === mode)));
    const iframe = $('#map-iframe');
    const panoBox = $('#map-pano');
    const fb = $('#map-fallback');
    iframe.hidden = true; panoBox.hidden = true; fb.hidden = true;

    if (mode === 'street' && Maps.ok) {
      if (Arrival.pano) {
        panoBox.hidden = false;
        if (!panoBox.childElementCount) StreetView.show(panoBox, Arrival.pano, plan.place).catch(() => {});
      } else {
        fb.hidden = false;
        $('#map-fallback-text').textContent = 'この場所の近くにはストリートビューの写真がないようです。航空写真で見てみてください。';
        $('#map-fallback-link').href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
      }
      return;
    }
    const url = mapUrl(mode, lat, lng);
    if (url) {
      iframe.hidden = false;
      if (iframe.getAttribute('src') !== url) iframe.src = url;
    } else {
      fb.hidden = false;
      $('#map-fallback-text').textContent = 'ストリートビューは Google マップで開けます。';
      $('#map-fallback-link').href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
    }
  }

  function bindArrival() {
    $$('.map-tab').forEach((t) => t.addEventListener('click', () => setMapMode(t.dataset.map)));
    $('#btn-new-flight').addEventListener('click', () => {
      Guide.stop();
      $('#form-flight').reset();
      enterHome();
    });
    $('#btn-save-place').addEventListener('click', toggleSaveCurrent);
    $('#btn-refly').addEventListener('click', () => {
      const p = Arrival.plan;
      if (!p) return;
      startFlight({ place: p.place.query, era: p.era || '', memory: p.memory || '' }, p);
    });
  }

  /* =========================================================
   *  思い出の写真（縮小して登録 → 今の様子と見比べる）
   * ========================================================= */
  const PH = Object.assign({ maxSize: 1600, quality: 0.82, thumbSize: 240, thumbQuality: 0.7, maxFileMB: 40 }, C.PHOTO || {});

  async function loadImageSource(file) {
    if ('createImageBitmap' in window) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* 下の方法で読む */ }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('この画像は読み込めませんでした。JPEG・PNG などの写真を選んでください'));
      im.src = url;
    });
  }

  function renderJpeg(src, max, quality) {
    const w0 = src.naturalWidth || src.width;
    const h0 = src.naturalHeight || src.height;
    const sc = Math.min(1, max / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * sc));
    const h = Math.max(1, Math.round(h0 * sc));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    const dataUrl = c.toDataURL('image/jpeg', quality);
    return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(',') + 1), width: w, height: h };
  }

  const Photos = {
    list: [],
    selectedId: null,
    full: new Map(),
    pending: null,

    async load(plan) {
      this.list = [];
      this.selectedId = null;
      this.clearPending();
      setMsg($('#photo-msg'), '');
      this.renderStrip();
      this.showSelected();
      try {
        const r = await api('listPhotos', { lat: plan.place.lat, lng: plan.place.lng });
        if (Arrival.plan !== plan) return;
        this.list = r.photos || [];
        if (this.list.length) this.selectedId = this.list[this.list.length - 1].id;
        this.renderStrip();
        this.showSelected();
      } catch (err) {
        setMsg($('#photo-msg'), err.message, 'error');
      }
    },

    renderStrip() {
      $('#photo-strip').innerHTML = this.list.map((p) => `
        <button type="button" class="photo-thumb" data-photo="${esc(p.id)}" aria-pressed="${p.id === this.selectedId}" aria-label="${esc(p.caption || '思い出の写真')}">
          ${p.thumb ? `<img src="data:image/jpeg;base64,${p.thumb}" alt="">` : ''}
        </button>`).join('')
        + '<button type="button" class="photo-add" id="btn-photo-add">写真を<br>登録する</button>';
    },

    async showSelected() {
      const p = this.list.find((x) => x.id === this.selectedId);
      const img = $('#cmp-photo');
      const overlay = $('#compare-stage').dataset.mode === 'overlay';
      if (!p) {
        img.hidden = true;
        img.removeAttribute('src');
        $('#cmp-empty').hidden = false;
        $('#photo-info').hidden = true;
        $('#cmp-opacity-wrap').hidden = true;
        return;
      }
      $('#cmp-empty').hidden = true;
      $('#photo-info').hidden = false;
      $('#cmp-opacity-wrap').hidden = !overlay;
      $('#photo-caption').textContent = [p.era, p.caption].filter(Boolean).join('　') || '思い出の写真';
      img.alt = p.caption || '思い出の写真';
      img.hidden = false;
      if (p.thumb) img.src = `data:image/jpeg;base64,${p.thumb}`;
      const id = p.id;
      try {
        const url = await this.fetchFull(id);
        if (this.selectedId === id) img.src = url;
      } catch (err) {
        setMsg($('#photo-msg'), err.message, 'error');
      }
    },

    fetchFull(id) {
      if (!this.full.has(id)) {
        const pr = api('getPhoto', { id }).then((r) =>
          URL.createObjectURL(new Blob([b64ToBytes(r.image)], { type: r.mimeType || 'image/jpeg' })));
        pr.catch(() => this.full.delete(id));
        this.full.set(id, pr);
      }
      return this.full.get(id);
    },

    select(id) {
      this.selectedId = id;
      $$('.photo-thumb').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.photo === id)));
      this.showSelected();
    },

    async pick(file) {
      setMsg($('#photo-msg'), '');
      if (!file) return;
      if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name)) {
        setMsg($('#photo-msg'), '写真（画像ファイル）を選んでください', 'error');
        return;
      }
      if (file.size > PH.maxFileMB * 1024 * 1024) {
        setMsg($('#photo-msg'), `${PH.maxFileMB}MB以下の写真を選んでください`, 'error');
        return;
      }
      setMsg($('#photo-msg'), '写真を縮小しています…');
      try {
        const src = await loadImageSource(file);
        const main = renderJpeg(src, PH.maxSize, PH.quality);
        let thumb = renderJpeg(src, PH.thumbSize, PH.thumbQuality);
        if (thumb.base64.length > 40000) thumb = renderJpeg(src, PH.thumbSize, 0.5);
        if (src.close) src.close();
        this.pending = { main, thumb };
        $('#photo-preview-img').src = main.dataUrl;
        const kb = Math.round(main.base64.length * 0.75 / 1024);
        $('#photo-size-note').textContent = `${main.width}×${main.height}ピクセル・約${kb}KB に縮小して登録します。`;
        $('#photo-preview').hidden = false;
        setMsg($('#photo-msg'), '');
        $('#photo-preview').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (err) {
        setMsg($('#photo-msg'), err.message || '写真を読み込めませんでした', 'error');
      }
    },

    clearPending() {
      this.pending = null;
      $('#form-photo').reset();
      $('#photo-preview').hidden = true;
      $('#photo-preview-img').removeAttribute('src');
    },

    async upload(form) {
      const plan = Arrival.plan;
      if (!this.pending || !plan) return;
      const { main, thumb } = this.pending;
      setBusy(form, true, '登録中…');
      setMsg($('#photo-msg'), '');
      try {
        const r = await api('uploadPhoto', {
          lat: plan.place.lat,
          lng: plan.place.lng,
          placeName: (plan.script && plan.script.placeName) || plan.place.query,
          image: main.base64,
          thumb: thumb.base64,
          caption: form.caption.value.trim(),
          era: form.era.value.trim(),
          width: main.width,
          height: main.height
        });
        if (Arrival.plan !== plan) return;
        const photo = r.photo;
        this.full.set(photo.id, Promise.resolve(URL.createObjectURL(new Blob([b64ToBytes(main.base64)], { type: 'image/jpeg' }))));
        this.list.push(photo);
        this.clearPending();
        this.selectedId = photo.id;
        this.renderStrip();
        this.showSelected();
        setMsg($('#photo-msg'), r.message || '写真を登録しました', 'ok');
        $('#compare').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        setMsg($('#photo-msg'), err.message, 'error');
      } finally {
        setBusy(form, false);
      }
    },

    async remove() {
      const p = this.list.find((x) => x.id === this.selectedId);
      if (!p) return;
      if (!window.confirm('この写真を削除しますか？（元に戻せません）')) return;
      try {
        await api('deletePhoto', { id: p.id });
        this.list = this.list.filter((x) => x.id !== p.id);
        this.full.delete(p.id);
        this.selectedId = this.list.length ? this.list[this.list.length - 1].id : null;
        this.renderStrip();
        this.showSelected();
        setMsg($('#photo-msg'), '写真を削除しました', 'ok');
      } catch (err) {
        setMsg($('#photo-msg'), err.message, 'error');
      }
    }
  };

  /* 「今」の表示（ストリートビュー／ない場所は航空写真） */
  const Compare = {
    async renderNow(plan) {
      const box = $('#cmp-now-view');
      box.innerHTML = '';
      const p = plan.place;
      if (Maps.ok && Arrival.pano) {
        $('#cmp-now-label').textContent = '今';
        try { await StreetView.show(box, Arrival.pano, p); return; } catch { /* 下の方法で表示 */ }
      }
      const useStreet = !Maps.ok && !isPlaceholder(MAPS_KEY);
      const url = mapUrl(useStreet ? 'street' : 'aerial', p.lat, p.lng);
      $('#cmp-now-label').textContent = useStreet ? '今' : '今（航空写真）';
      if (url) box.innerHTML = `<iframe src="${esc(url)}" title="今の様子" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`;
    },
    setMode(mode) {
      $('#compare-stage').dataset.mode = mode;
      $$('.seg-btn').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cmp === mode)));
      $('#cmp-opacity-wrap').hidden = mode !== 'overlay' || !Photos.selectedId;
    }
  };

  function bindPhotos() {
    $('#photo-strip').addEventListener('click', (e) => {
      if (e.target.closest('#btn-photo-add')) { $('#photo-file').click(); return; }
      const b = e.target.closest('.photo-thumb');
      if (b) Photos.select(b.dataset.photo);
    });
    $('#photo-file').addEventListener('change', (e) => Photos.pick(e.target.files && e.target.files[0]));
    $('#form-photo').addEventListener('submit', (e) => { e.preventDefault(); Photos.upload(e.currentTarget); });
    $('#btn-photo-cancel').addEventListener('click', () => { Photos.clearPending(); setMsg($('#photo-msg'), ''); });
    $('#btn-photo-delete').addEventListener('click', () => Photos.remove());
    $$('.seg-btn').forEach((b) => b.addEventListener('click', () => Compare.setMode(b.dataset.cmp)));
    $('#cmp-opacity').addEventListener('input', (e) => {
      $('#compare-stage').style.setProperty('--photo-opacity', e.target.value);
    });
  }

  /* =========================================================
   *  音声コントローラー
   * ========================================================= */
  function bindVoicebar() {
    const prefs = Prefs.get();
    $('#vol-voice').value = prefs.voice;
    $('#vol-se').value = prefs.se;
    Voice.setVolume(Number(prefs.voice));
    SE.setVolume(Number(prefs.se));

    $('#btn-play').addEventListener('click', () => {
      if (Voice.mode) { Voice.togglePause(); return; }
      if (document.body.dataset.view === 'arrival') Guide.play();
    });
    $('#btn-next').addEventListener('click', () => {
      if (document.body.dataset.view === 'arrival') Guide.next(); else Voice.stop();
    });
    $('#btn-replay').addEventListener('click', () => Guide.play());
    $('#vol-voice').addEventListener('input', (e) => {
      const v = Number(e.target.value); Voice.setVolume(v); Prefs.set({ ...Prefs.get(), voice: v });
    });
    $('#vol-se').addEventListener('input', (e) => {
      const v = Number(e.target.value); SE.setVolume(v); Prefs.set({ ...Prefs.get(), se: v });
    });
  }

  /* =========================================================
   *  起動
   * ========================================================= */
  async function boot() {
    $$('[data-eagle]').forEach((el) => { el.innerHTML = eagleSVG(el.dataset.eagle); });
    $$('.eye').forEach((b) => { b.innerHTML = ICON.eye; });
    if (C.APP_NAME) document.title = C.APP_NAME;
    renderVersion();
    if (isPlaceholder(C.GAS_URL)) $('#config-warning').hidden = false;

    bindAuth();
    bindHome();
    bindFlight();
    bindArrival();
    bindPhotos();
    bindVoicebar();

    const s = Session.get();
    if (s && s.token) {
      try {
        const r = await api('verify');
        s.nickname = r.nickname; s.mustChange = r.mustChange;
        Session.set(s);
        if (r.mustChange) openChange(true); else enterHome();
      } catch {
        if (document.body.dataset.view !== 'auth') showView('auth');
      }
    } else {
      showView('auth');
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
