/* あの場所は今 ― イーグル隊長の空中散歩  app.js v1.0.0 */
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
    showView('home');
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

    $('#history-list').addEventListener('click', (e) => {
      const b = e.target.closest('[data-replay]');
      if (!b) return;
      const item = State.history[Number(b.dataset.replay)];
      if (!item) return;
      const p = item.plan;
      startFlight({ place: p.place.query, era: p.era || '', memory: p.memory || '' }, p);
    });
  }

  async function loadHistory() {
    const box = $('#history-list');
    box.innerHTML = '<p class="muted">読み込み中…</p>';
    try {
      const r = await api('history');
      State.history = r.items || [];
      renderHistory();
    } catch (err) {
      box.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    }
  }

  function renderHistory() {
    const box = $('#history-list');
    if (!State.history.length) {
      box.innerHTML = '<p class="empty">まだフライトの記録はありません。搭乗券に行き先を書いて、隊長と飛んでみましょう。</p>';
      return;
    }
    box.innerHTML = State.history.map((it, i) => {
      const p = it.plan || {};
      const name = (p.script && p.script.placeName) || (p.place && p.place.query) || '';
      return `<div class="history-item">
        <strong>${esc(name)}</strong>
        <span class="meta">${esc(p.place && p.place.address)}<br>${esc(it.date)}${p.era ? '／' + esc(p.era) : ''}</span>
        <button type="button" class="btn btn-ghost" data-replay="${i}">もう一度飛ぶ</button>
      </div>`;
    }).join('');
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

    fetch(text) {
      if (!text) return Promise.resolve(null);
      if (this.cache.has(text)) return this.cache.get(text);
      const p = (C.TTS && C.TTS.useGemini === false)
        ? Promise.resolve(null)
        : api('tts', { text }).then((r) => audioToUrl(r.audio, r.mimeType)).catch(() => null);
      this.cache.set(text, p);
      return p;
    },
    prefetch(list) { (list || []).filter(Boolean).forEach((t) => this.fetch(t)); },

    speak(text) {
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
            this.el.onerror = () => this._fallback(text, id);
            this.el.play().catch(() => this._fallback(text, id));
          } else {
            this._fallback(text, id);
          }
        });
      });
    },
    _fallback(text, id) {
      if (id !== this.seq || this.fbId === id) return;
      this.fbId = id;
      if (C.TTS && C.TTS.fallbackWebSpeech !== false && 'speechSynthesis' in window) {
        this.mode = 'speech';
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ja-JP'; u.rate = 1.05; u.pitch = 0.85; u.volume = this.vol;
        u.onend = () => this._done(id);
        u.onerror = () => this._done(id);
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
      this.el.onended = null; this.el.onerror = null;
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
   *  フライト演出
   * ========================================================= */
  const Flight = { run: 0, skip: false, skipP: null, skipResolve: null, plan: null, input: null };

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
    const run = ++Flight.run;
    Flight.input = input;
    Flight.plan = null;
    Flight.skip = false;
    Flight.skipP = new Promise((r) => { Flight.skipResolve = r; });

    showView('flight');
    $('#flight-error').hidden = true;
    $('#btn-skip-flight').disabled = false;
    $('#hud-place').textContent = input.place;
    $('#attribution').textContent = C.EARTH_ATTRIBUTION || '';
    $('#stage').classList.add('no-video');
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

    // 離陸セリフの音声ができるまで（最大7秒）待つ
    await Promise.race([Voice.fetch(takeoffLine), sleep(7000), planT.p.catch(() => {})]);
    if (!alive(run)) return;
    if (planT.error) return flightFailed(planT.error, run);

    // ---- 離陸 ----
    setPhase('takeoff', '離陸！');
    SE.play('cry');
    await Promise.all([
      race(Video.play(videoAsset('takeoff', input.place), { minMs: 3500 })),
      talk(takeoffLine)
    ]);
    if (!alive(run)) return;

    // ---- 巡航 ----
    setPhase('cruise', '上空を巡航中');
    if (!Flight.skip) SE.loop('wind');
    Video.play(videoAsset('cruise', input.place), { loop: true });
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
    for (const line of (s.cruise || [])) {
      if (Flight.skip || !alive(run)) break;
      await talk(line);
    }
    const rest = (Number(C.CRUISE_MIN_SECONDS) || 0) * 1000 - (Date.now() - cruiseStart);
    if (rest > 0 && !Flight.skip) await race(sleep(rest));
    if (!alive(run)) return;

    // ---- 急降下 ----
    if (!Flight.skip) {
      setPhase('dive', '急降下！');
      SE.stop('wind');
      SE.play('whoosh');
      await Promise.all([
        race(Video.play(videoAsset('dive', input.place), { minMs: 3000 })),
        talk(s.dive)
      ]);
    }
    if (!alive(run)) return;

    SE.stop('wind');
    Video.stop();
    showArrival(plan);
  }

  function flightFailed(err, run) {
    if (!alive(run)) return;
    SE.stopAll();
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
  const Guide = {
    run: 0,
    segs: [],
    stop() {
      this.run++;
      Voice.stop();
      markSpeaking(null);
    },
    async play(from = 0) {
      const run = ++this.run;
      for (let i = from; i < this.segs.length; i++) {
        if (run !== this.run) return;
        const seg = this.segs[i];
        markSpeaking(seg.key);
        if (seg.bubble) $('#arrival-bubble').textContent = seg.text;
        await Voice.speak(seg.text);
      }
      if (run === this.run) markSpeaking(null);
    }
  };

  function markSpeaking(key) {
    $$('.guide-sec').forEach((el) => el.classList.toggle('is-speaking', el.dataset.key === key));
    if (key) {
      const el = $(`.guide-sec[data-key="${key}"]`);
      if (el && window.matchMedia('(max-width: 860px)').matches) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  let currentPlan = null;

  function showArrival(plan) {
    currentPlan = plan;
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
    setMapMode('street');

    Guide.segs = [
      { key: 'arrival', text: s.arrival, bubble: true },
      { key: 'then', text: s.then },
      { key: 'now', text: s.now },
      { key: 'gap', text: s.gap },
      { key: 'trivia', text: s.trivia },
      { key: 'closing', text: s.closing, bubble: true }
    ].filter((x) => x.text);
    Voice.prefetch(Guide.segs.map((x) => x.text));
    Guide.play(0);
  }

  function mapUrl(mode, lat, lng) {
    const k = C.MAPS_EMBED_API_KEY;
    if (!isPlaceholder(k)) {
      const key = encodeURIComponent(k);
      if (mode === 'street') return `https://www.google.com/maps/embed/v1/streetview?key=${key}&location=${lat},${lng}&fov=80&language=ja`;
      if (mode === 'aerial') return `https://www.google.com/maps/embed/v1/view?key=${key}&center=${lat},${lng}&zoom=18&maptype=satellite&language=ja`;
      return `https://www.google.com/maps/embed/v1/place?key=${key}&q=${lat},${lng}&zoom=17&language=ja`;
    }
    if (mode === 'street') return null;
    return `https://maps.google.com/maps?q=${lat},${lng}&t=${mode === 'aerial' ? 'k' : 'm'}&z=${mode === 'aerial' ? 18 : 17}&hl=ja&output=embed`;
  }

  function setMapMode(mode) {
    if (!currentPlan) return;
    const { lat, lng } = currentPlan.place;
    $$('.map-tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.map === mode)));
    const url = mapUrl(mode, lat, lng);
    const iframe = $('#map-iframe');
    const fb = $('#map-fallback');
    if (url) {
      fb.hidden = true;
      iframe.hidden = false;
      if (iframe.src !== url) iframe.src = url;
    } else {
      iframe.hidden = true;
      fb.hidden = false;
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
    $('#btn-refly').addEventListener('click', () => {
      if (!currentPlan) return;
      const p = currentPlan;
      startFlight({ place: p.place.query, era: p.era || '', memory: p.memory || '' }, p);
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
      if (document.body.dataset.view === 'arrival') Guide.play(0);
    });
    $('#btn-next').addEventListener('click', () => Voice.stop());
    $('#btn-replay').addEventListener('click', () => Guide.play(0));
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
