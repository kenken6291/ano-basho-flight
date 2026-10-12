/**
 * あの場所は今 ― イーグル隊長の空中散歩
 * Code.gs（Google Apps Script） v1.5.0
 *
 * ■ スクリプトプロパティ（プロジェクトの設定 → スクリプト プロパティ）
 *   GEMINI_API_KEY      （必須）Gemini API キー
 *   GOOGLE_MAPS_API_KEY （必須）Google Maps API キー（3D地図・ストリートビュー・地図表示用）
 *   APP_URL             （推奨）例: https://kenken6291.github.io/ano-basho-flight/
 *   PEPPER              （自動）setup() 実行時に自動生成。絶対に変更しないこと
 *   SPREADSHEET_ID      （任意）未設定ならコンテナバインドのスプレッドシートを使用
 *   GEMINI_MODEL        （任意）既定: gemini-2.5-flash
 *   GEMINI_TTS_MODEL    （任意）既定: gemini-2.5-flash-preview-tts
 *   TTS_VOICE           （任意）既定: Puck（陽気）。Fenrir（勢い）/ Charon（渋め）なども可
 *   USE_SEARCH          （任意）true/false 既定: true（Google検索グラウンディング）
 *   DAILY_FLIGHT_LIMIT  （任意）1人あたりのフライト生成回数/日 既定: 20
 *   DAILY_TTS_LIMIT     （任意）1人あたりの音声生成回数/日 既定: 300
 *   DAILY_PHOTO_LIMIT   （任意）1人あたりの写真登録枚数/日 既定: 30
 *   PHOTO_FOLDER_ID     （自動）思い出の写真を保存するDriveフォルダ。setup() で自動作成
 *   TTS_CACHE_FOLDER_ID （自動）生成した音声のキャッシュ用Driveフォルダ（同じセリフはAPIを呼ばずに再利用）
 *
 * ■ 重要：コードを変更したら「デプロイを管理 → 編集 → バージョン：新バージョン」で再デプロイ
 */

const APP_VERSION = '1.5.0';

const SHEET_MEMBERS = 'members';
const SHEET_FLIGHTS = 'flights';
const SHEET_PHOTOS = 'photos';
const MEMBER_HEADERS = ['email', 'nickname', 'salt', 'hash', 'mustChange', 'failCount', 'lockUntil', 'createdAt', 'lastLogin'];
const FLIGHT_HEADERS = ['timestamp', 'email', 'query', 'address', 'lat', 'lng', 'era', 'memory', 'placeName', 'planJson', 'id', 'saved'];
const PHOTO_HEADERS = ['id', 'email', 'placeKey', 'placeName', 'fileId', 'thumb', 'caption', 'era', 'width', 'height', 'createdAt'];
const SHEET_HEADERS = {};
SHEET_HEADERS[SHEET_MEMBERS] = MEMBER_HEADERS;
SHEET_HEADERS[SHEET_FLIGHTS] = FLIGHT_HEADERS;
SHEET_HEADERS[SHEET_PHOTOS] = PHOTO_HEADERS;
const M = {};
MEMBER_HEADERS.forEach(function (h, i) { M[h] = i; });

const SESSION_TTL = 21600;   // 6時間（CacheService の上限）
const LOCK_LIMIT = 5;        // 連続失敗回数
const LOCK_MINUTES = 15;     // ロック時間
const HASH_ROUNDS = 500;     // ストレッチング回数

const MAX_PHOTOS_PER_PLACE = 20;   // 1か所あたりの登録枚数
const MAX_IMAGE_B64 = 4000000;     // 本体（base64）約3MBまで
const MAX_THUMB_B64 = 45000;       // サムネイル（セルの上限5万文字未満）

/* =========================================================
 *  イーグル隊長 システムプロンプト
 * ========================================================= */
const EAGLE_SYSTEM_PROMPT = [
  'あなたは空の観光ガイド「イーグル隊長」。大きな翼を持つ鷲で、利用者（相棒）を足につかまらせて目的地まで飛んでいく。',
  '',
  '【キャラクター】',
  '・一人称は「オレ」、利用者のことは「相棒」と呼ぶ。',
  '・少しお調子者だが頼もしい。観光ガイドの心得があり、土地の話が大好き。',
  '・語尾は「〜だぜ」「〜だな！」「〜してみな」など。べらんめえ調にしすぎず、品よく陽気に。',
  '・ときどき鷲らしい言い回しを入れる（例：「翼が鳴るぜ」「上昇気流に乗るぞ」「鷲の目はごまかせねえ」）。ただし毎回は使わない。',
  '・利用者は50〜70代も多い。ゆっくり聞き取れるよう、1文は40字以内、難しい言葉や横文字は避ける。',
  '',
  '【事実に関するルール（最優先）】',
  '・確かでない事実は断定しない。「〜だったって話だぜ」「〜かもしれねえな」のようにぼかす。',
  '・実在が確認できない店名・人名・建物名・年号を作らない。具体名は検索などで確認できたものだけ使う。',
  '・分からないことは正直に「オレの地図にも載ってねえ」などと言い、一般的な時代の空気感（その年代の街並み、暮らし）で語る。',
  '・相棒の「思い出メモ」があれば最優先で話に織り込み、思い出を否定しない。',
  '・災害・事故・戦争など悲しい出来事は茶化さず、敬意をもって短く触れる。',
  '・政治的・宗教的な意見は言わない。',
  '',
  '【出力】',
  '・指定されたJSONオブジェクトだけを出力する。前置き、説明、コードブロック記号は書かない。'
].join('\n');

function buildUserPrompt_(ctx) {
  return [
    '【目的地（相棒の入力）】' + ctx.query,
    '【地図上の住所】' + ctx.address + '（緯度' + ctx.lat + '、経度' + ctx.lng + '）',
    '【相棒の思い出の時期】' + (ctx.era || '指定なし'),
    '【相棒の思い出メモ】' + (ctx.memory || 'なし'),
    '【相棒のニックネーム】' + (ctx.nickname || '相棒'),
    '',
    'この場所への上空フライトの実況と、到着後の「あの場所は今」ガイドを作ってくれ。',
    '次のキーを持つJSONオブジェクトだけを出力すること：',
    '{',
    '  "placeName": "目的地の短い呼び名（15字以内）",',
    '  "cruise": ["上空巡航中の実況。目的地へ向かう道中の雑談や、目的地のちょっとした予告。1つ40〜60字", "…", "…"],（3つ）',
    '  "dive": "急降下するときの一言（30字以内。例：しっかりつかまれ、降りるぜ！）",',
    '  "arrival": "到着した第一声（40字以内）",',
    '  "then": "昔の面影。思い出の時期があればその頃の様子。80〜140字",',
    '  "now": "現在の姿。今どうなっているか。80〜140字",',
    '  "gap": "昔と今のギャップへの隊長のツッコミや感想。60〜100字",',
    '  "trivia": "この場所や周辺にまつわる豆知識。60〜100字",',
    '  "closing": "相棒への締めの一言。思い出メモがあればそれに触れる。40〜70字"',
    '}'
  ].join('\n');
}

/* =========================================================
 *  ルーティング
 * ========================================================= */
function doGet() {
  return json_({ ok: true, app: 'ano-basho-flight', version: APP_VERSION });
}

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const pub = { register: register_, login: login_, forgotPassword: forgotPassword_, logout: logout_ };
    const priv = {
      verify: verify_, changePassword: changePassword_, planFlight: planFlight_, tts: tts_, history: history_,
      listPhotos: listPhotos_, uploadPhoto: uploadPhoto_, getPhoto: getPhoto_, deletePhoto: deletePhoto_,
      savePlace: savePlace_, deleteFlight: deleteFlight_,
      mapsKey: mapsKey_
    };

    if (pub[req.action]) {
      return json_(Object.assign({ ok: true, version: APP_VERSION }, pub[req.action](req)));
    }
    if (priv[req.action]) {
      const user = auth_(req.token);
      if (user.mustChange && req.action !== 'changePassword' && req.action !== 'verify') {
        throw err_('パスワードを変更してから利用してください', 'MUST_CHANGE');
      }
      return json_(Object.assign({ ok: true, version: APP_VERSION }, priv[req.action](req, user)));
    }
    throw err_('不明な操作です');
  } catch (ex) {
    if (!ex.userMessage) console.error(ex && ex.stack ? ex.stack : ex);
    return json_({
      ok: false,
      error: ex.userMessage || 'サーバーでエラーが発生しました。時間をおいて試してください',
      code: ex.code || 'ERROR',
      version: APP_VERSION
    });
  }
}

/* =========================================================
 *  会員認証
 * ========================================================= */
function register_(req) {
  const email = normEmail_(req.email);
  const nickname = String(req.nickname || '').trim().slice(0, 20);
  if (!isEmail_(email)) throw err_('メールアドレスの形式を確認してください');
  if (!nickname) throw err_('ニックネームを入力してください');

  return withLock_(function () {
    if (findMember_(email)) {
      throw err_('このメールアドレスは登録済みです。「パスワードを忘れた」から仮パスワードを再発行できます');
    }
    const temp = tempPassword_();
    const salt = Utilities.getUuid();
    sheet_(SHEET_MEMBERS).appendRow([email, safe_(nickname), salt, hash_(temp, salt), true, 0, '', new Date(), '']);
    sendTempMail_(email, nickname, temp, '会員登録ありがとうございます。');
    return { message: '仮パスワードをメールで送りました。メールを確認してログインしてください' };
  });
}

function login_(req) {
  const email = normEmail_(req.email);
  const pw = String(req.password || '');
  if (!email || !pw) throw err_('メールアドレスとパスワードを入力してください');

  return withLock_(function () {
    const m = findMember_(email);
    if (!m) throw err_('メールアドレスまたはパスワードが違います');
    const sh = sheet_(SHEET_MEMBERS);
    const now = new Date();

    const lockUntil = m.v[M.lockUntil];
    if (lockUntil && new Date(lockUntil) > now) {
      const min = Math.ceil((new Date(lockUntil) - now) / 60000);
      throw err_('ログインに' + LOCK_LIMIT + '回失敗したため一時ロック中です。あと約' + min + '分お待ちください', 'LOCKED');
    }

    if (hash_(pw, m.v[M.salt]) !== m.v[M.hash]) {
      const fails = Number(m.v[M.failCount] || 0) + 1;
      if (fails >= LOCK_LIMIT) {
        setCells_(sh, m.row, { failCount: 0, lockUntil: new Date(now.getTime() + LOCK_MINUTES * 60000) });
        throw err_('ログインに' + LOCK_LIMIT + '回失敗しました。' + LOCK_MINUTES + '分間ロックします', 'LOCKED');
      }
      setCells_(sh, m.row, { failCount: fails, lockUntil: '' });
      throw err_('メールアドレスまたはパスワードが違います（あと' + (LOCK_LIMIT - fails) + '回失敗するとロックされます）');
    }

    setCells_(sh, m.row, { failCount: 0, lockUntil: '', lastLogin: now });
    const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    CacheService.getScriptCache().put('s_' + token, email, SESSION_TTL);
    return { token: token, nickname: String(m.v[M.nickname]), mustChange: isTrue_(m.v[M.mustChange]) };
  });
}

function changePassword_(req, user) {
  const cur = String(req.currentPassword || '');
  const nw = String(req.newPassword || '');
  validatePassword_(nw);
  if (cur === nw) throw err_('新しいパスワードは今のパスワードと別のものにしてください');

  return withLock_(function () {
    const m = findMember_(user.email);
    if (!m) throw err_('会員情報が見つかりません', 'AUTH');
    if (hash_(cur, m.v[M.salt]) !== m.v[M.hash]) throw err_('今のパスワード（仮パスワード）が違います');
    const salt = Utilities.getUuid();
    setCells_(sheet_(SHEET_MEMBERS), m.row, { salt: salt, hash: hash_(nw, salt), mustChange: false });
    return { message: 'パスワードを変更しました', nickname: String(m.v[M.nickname]) };
  });
}

function forgotPassword_(req) {
  const email = normEmail_(req.email);
  if (!isEmail_(email)) throw err_('メールアドレスの形式を確認してください');
  withLock_(function () {
    const m = findMember_(email);
    if (!m) return;
    const temp = tempPassword_();
    const salt = Utilities.getUuid();
    setCells_(sheet_(SHEET_MEMBERS), m.row, { salt: salt, hash: hash_(temp, salt), mustChange: true, failCount: 0, lockUntil: '' });
    sendTempMail_(email, String(m.v[M.nickname]), temp, '仮パスワードを再発行しました。');
  });
  return { message: '登録済みのメールアドレスであれば、仮パスワードを送りました。メールを確認してください' };
}

function logout_(req) {
  if (req.token) CacheService.getScriptCache().remove('s_' + req.token);
  return { message: 'ログアウトしました' };
}

// Maps APIキーをログイン中の会員にだけ渡す
// ※地図はブラウザで表示するため、キー自体はブラウザに届きます。保護は HTTP リファラー制限で行います
function mapsKey_(req, user) {
  return { key: prop_('GOOGLE_MAPS_API_KEY', '') };
}

function verify_(req, user) {
  return { nickname: user.nickname, mustChange: user.mustChange };
}

function auth_(token) {
  if (!token) throw err_('ログインしてください', 'AUTH');
  const cache = CacheService.getScriptCache();
  const email = cache.get('s_' + token);
  if (!email) throw err_('ログインの有効期限が切れました。もう一度ログインしてください', 'AUTH');
  const m = findMember_(email);
  if (!m) throw err_('会員情報が見つかりません', 'AUTH');
  cache.put('s_' + token, email, SESSION_TTL); // 使うたびに延長
  return { email: email, nickname: String(m.v[M.nickname]), mustChange: isTrue_(m.v[M.mustChange]), row: m.row };
}

/* =========================================================
 *  フライト（Gemini 台本生成）
 * ========================================================= */
function planFlight_(req, user) {
  const query = String(req.place || '').trim().slice(0, 100);
  if (!query) throw err_('行き先を入力してください');
  const era = String(req.era || '').trim().slice(0, 30);
  const memory = String(req.memory || '').trim().slice(0, 300);

  countDaily_('fl', user.email, Number(prop_('DAILY_FLIGHT_LIMIT', '20')),
    '今日のフライト回数の上限に達しました。また明日いっしょに飛ぼうぜ！');

  const geo = geocode_(query);
  const gen = generateScript_({
    query: query, address: geo.address, lat: geo.lat, lng: geo.lng,
    era: era, memory: memory, nickname: user.nickname
  });

  const plan = {
    id: Utilities.getUuid(),
    place: { query: query, address: geo.address, lat: geo.lat, lng: geo.lng },
    era: era,
    memory: memory,
    script: gen.script,
    sources: gen.sources,
    createdAt: new Date().toISOString()
  };

  try {
    sheet_(SHEET_FLIGHTS).appendRow([
      new Date(), user.email, safe_(query), safe_(geo.address), geo.lat, geo.lng,
      safe_(era), safe_(memory), safe_(plan.script.placeName), JSON.stringify(plan),
      plan.id, false
    ]);
  } catch (e) { console.error(e); }

  return { plan: plan };
}

function geocode_(q) {
  const r = Maps.newGeocoder().setLanguage('ja').setRegion('jp').geocode(q);
  if (r.status !== 'OK' || !r.results || !r.results.length) {
    throw err_('その場所が地図で見つかりませんでした。地名や住所をもう少し詳しく入れてみてください', 'NOT_FOUND');
  }
  const top = r.results[0];
  return {
    address: String(top.formatted_address || q).replace(/^日本、\s*/, '').replace(/^〒\d{3}-\d{4}\s*/, ''),
    lat: top.geometry.location.lat,
    lng: top.geometry.location.lng
  };
}

function generateScript_(ctx) {
  const userPrompt = buildUserPrompt_(ctx);
  const useSearch = prop_('USE_SEARCH', 'true') === 'true';

  let res = callGemini_(EAGLE_SYSTEM_PROMPT, userPrompt, useSearch);
  let obj = parseJson_(res.text);
  if (!obj && useSearch) { // 検索ありでJSONが崩れた場合は検索なし（JSONモード）で再試行
    res = callGemini_(EAGLE_SYSTEM_PROMPT, userPrompt, false);
    obj = parseJson_(res.text);
  }
  if (!obj) throw err_('イーグル隊長が台本を考えきれなかったようです。もう一度試してください', 'AI');
  return { script: normalizeScript_(obj, ctx), sources: res.sources || [] };
}

function normalizeScript_(o, ctx) {
  const s = function (v, d) { v = (v === undefined || v === null) ? '' : String(v).trim(); return v || d; };
  let cruise = Array.isArray(o.cruise) ? o.cruise.map(function (x) { return s(x, ''); }).filter(String) : [];
  if (!cruise.length) cruise = ['いい風だ。このまま' + ctx.query + 'へまっすぐ向かうぜ！'];
  return {
    placeName: s(o.placeName, ctx.query).slice(0, 30),
    cruise: cruise.slice(0, 4),
    dive: s(o.dive, 'しっかりつかまれ、相棒！降りるぜ！'),
    arrival: s(o.arrival, '到着だ！ここが' + ctx.query + 'だぜ。'),
    then: s(o.then, ''),
    now: s(o.now, ''),
    gap: s(o.gap, ''),
    trivia: s(o.trivia, ''),
    closing: s(o.closing, 'また思い出の場所があったら、いつでもオレを呼びな！')
  };
}

function callGemini_(sys, user, useSearch) {
  const key = prop_('GEMINI_API_KEY', '');
  if (!key) throw err_('サーバーの設定（GEMINI_API_KEY）が未完了です', 'CONFIG');
  const model = prop_('GEMINI_MODEL', 'gemini-2.5-flash');

  const body = {
    system_instruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 8192 }
  };
  if (useSearch) body.tools = [{ google_search: {} }];
  else body.generationConfig.responseMimeType = 'application/json';

  const r = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
    {
      method: 'post', contentType: 'application/json',
      headers: { 'x-goog-api-key': key },
      payload: JSON.stringify(body), muteHttpExceptions: true
    });
  const code = r.getResponseCode();
  if (code !== 200) {
    console.error('Gemini error ' + code + ': ' + r.getContentText());
    if (code === 429) throw err_('AIが混み合っています。少し時間をおいて試してください', 'AI');
    throw err_('AIの呼び出しに失敗しました（' + code + '）', 'AI');
  }
  const d = JSON.parse(r.getContentText());
  const c = (d.candidates || [])[0] || {};
  const text = ((c.content || {}).parts || []).map(function (p) { return p.text || ''; }).join('');

  const sources = [];
  const seen = {};
  (((c.groundingMetadata || {}).groundingChunks) || []).forEach(function (ch) {
    if (ch.web && ch.web.uri && !seen[ch.web.uri] && sources.length < 5) {
      seen[ch.web.uri] = true;
      sources.push({ title: ch.web.title || '参考ページ', uri: ch.web.uri });
    }
  });
  return { text: text, sources: sources };
}

function parseJson_(text) {
  if (!text) return null;
  const t = String(text).replace(/```json|```/g, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}

/* =========================================================
 *  音声合成（Gemini TTS）
 * ========================================================= */
function tts_(req, user) {
  const text = String(req.text || '').trim().slice(0, 1500);
  if (!text) throw err_('読み上げる文がありません');

  const model = prop_('GEMINI_TTS_MODEL', 'gemini-2.5-flash-preview-tts');
  const voice = prop_('TTS_VOICE', 'Puck');

  // 1) 同じセリフを前に作っていれば、Drive のキャッシュから返す（API を呼ばない）
  const name = ttsCacheName_(model, voice, text);
  const folder = ttsCacheFolder_();
  const it = folder.getFilesByName(name);
  if (it.hasNext()) {
    const f = it.next();
    return { audio: Utilities.base64Encode(f.getBlob().getBytes()), mimeType: f.getDescription() || 'audio/L16;codec=pcm;rate=24000', cached: true };
  }

  // 2) 上限に達している間は API を呼ばずにすぐ知らせる
  const cache = CacheService.getScriptCache();
  if (cache.get('tts_quota_block')) throw err_('今日はAI音声の上限に達しました', 'TTS_QUOTA');

  countDaily_('tts', user.email, Number(prop_('DAILY_TTS_LIMIT', '300')), '今日の音声の上限に達しました');

  const key = prop_('GEMINI_API_KEY', '');
  if (!key) throw err_('サーバーの設定（GEMINI_API_KEY）が未完了です', 'CONFIG');

  // セリフ本文だけを送る（指示文を付けると、それごと読み上げられてしまうため）
  const body = {
    contents: [{ parts: [{ text: text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
    }
  };
  const r = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
    {
      method: 'post', contentType: 'application/json',
      headers: { 'x-goog-api-key': key },
      payload: JSON.stringify(body), muteHttpExceptions: true
    });
  const code = r.getResponseCode();
  if (code === 429) {
    // 「retry in ○○s」を読み取り、その間は API を呼ばない（最大6時間）
    const m = /retry in ([\d.]+)s/i.exec(r.getContentText());
    const sec = m ? Math.ceil(Number(m[1])) : 3600;
    cache.put('tts_quota_block', '1', Math.max(60, Math.min(21600, sec)));
    console.warn('TTS quota exceeded. retry in ' + sec + 's');
    throw err_('今日はAI音声の上限に達しました', 'TTS_QUOTA');
  }
  if (code !== 200) {
    console.error('TTS error ' + code + ': ' + r.getContentText());
    throw err_('音声の生成に失敗しました', 'TTS');
  }
  const d = JSON.parse(r.getContentText());
  const parts = ((((d.candidates || [])[0] || {}).content || {}).parts) || [];
  const part = parts.filter(function (p) { return p.inlineData && p.inlineData.data; })[0];
  if (!part) throw err_('音声データが空でした', 'TTS');
  const mime = part.inlineData.mimeType || 'audio/L16;codec=pcm;rate=24000';

  // 3) 次回のためにキャッシュへ保存
  try {
    const f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(part.inlineData.data), 'application/octet-stream', name));
    f.setDescription(mime);
  } catch (e) { console.warn('TTS cache save failed: ' + e); }

  return { audio: part.inlineData.data, mimeType: mime };
}

function ttsCacheName_(model, voice, text) {
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, model + '|' + voice + '|' + text, Utilities.Charset.UTF_8);
  return d.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('') + '.pcm';
}

function ttsCacheFolder_() {
  const id = prop_('TTS_CACHE_FOLDER_ID', '');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { console.warn('TTS_CACHE_FOLDER_ID のフォルダが見つかりません。作り直します'); }
  }
  const f = DriveApp.createFolder('ano-basho-flight 音声キャッシュ');
  PropertiesService.getScriptProperties().setProperty('TTS_CACHE_FOLDER_ID', f.getId());
  return f;
}

// 上限ブロックを手動で解除したいとき（モデルを変えた直後など）にエディタから実行
function clearTtsQuotaBlock() {
  CacheService.getScriptCache().remove('tts_quota_block');
  console.log('AI音声の上限ブロックを解除しました');
}

/* =========================================================
 *  フライト履歴
 * ========================================================= */
// 思い出の場所（登録済み）はすべて、最近のフライトは30件まで返す
function history_(req, user) {
  const sh = sheet_(SHEET_FLIGHTS);
  const last = sh.getLastRow();
  if (last < 2) return { items: [] };
  const vals = sh.getRange(2, 1, last - 1, FLIGHT_HEADERS.length).getValues();
  const counts = photoCounts_(user.email);
  const items = [];
  let recent = 0;
  for (let i = vals.length - 1; i >= 0; i--) {
    const v = vals[i];
    if (String(v[1]).toLowerCase() !== user.email) continue;
    const saved = isTrue_(v[11]);
    if (!saved && recent >= 30) continue;
    let plan = null;
    try { plan = JSON.parse(v[9]); } catch (e) { plan = null; }
    if (!plan || !plan.place) continue;
    let id = String(v[10] || '');
    if (!id) { // 旧バージョンの記録にIDを付ける
      id = Utilities.getUuid();
      sh.getRange(i + 2, 11).setValue(id);
    }
    plan.id = id;
    if (!saved) recent++;
    let key = '';
    try { key = placeKey_(plan.place.lat, plan.place.lng); } catch (e) { key = ''; }
    items.push({
      id: id,
      saved: saved,
      date: Utilities.formatDate(new Date(v[0]), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'),
      photoCount: counts[key] || 0,
      plan: plan
    });
  }
  return { items: items };
}

function findFlight_(id, email) {
  if (!id) return null;
  const sh = sheet_(SHEET_FLIGHTS);
  const last = sh.getLastRow();
  if (last < 2) return null;
  const vals = sh.getRange(2, 1, last - 1, FLIGHT_HEADERS.length).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][10]) === String(id)) {
      if (String(vals[i][1]).toLowerCase() !== email) throw err_('この記録を操作する権限がありません');
      return { row: i + 2, v: vals[i] };
    }
  }
  return null;
}

// 思い出の場所に登録／登録を外す
function savePlace_(req, user) {
  const saved = req.saved !== false;
  return withLock_(function () {
    const m = findFlight_(req.id, user.email);
    if (!m) throw err_('フライトの記録が見つかりません', 'NOT_FOUND');
    sheet_(SHEET_FLIGHTS).getRange(m.row, 12).setValue(saved);
    return { saved: saved, message: saved ? '思い出の場所に登録しました' : '思い出の場所から外しました' };
  });
}

// フライトの記録を削除（必要なら、その場所の写真も削除）
function deleteFlight_(req, user) {
  return withLock_(function () {
    const m = findFlight_(req.id, user.email);
    if (!m) throw err_('フライトの記録が見つかりません', 'NOT_FOUND');
    let key = '';
    try { key = placeKey_(m.v[4], m.v[5]); } catch (e) { key = ''; }
    sheet_(SHEET_FLIGHTS).deleteRow(m.row);
    let removed = 0;
    if (req.deletePhotos && key) removed = deletePhotosByPlace_(user.email, key);
    return { message: removed ? '記録と写真' + removed + '枚を削除しました' : '記録を削除しました', removedPhotos: removed };
  });
}

/* =========================================================
 *  思い出の写真
 * ========================================================= */
function placeKey_(lat, lng) {
  const a = Number(lat), b = Number(lng);
  if (!isFinite(a) || !isFinite(b)) throw err_('場所の情報が正しくありません');
  return 'p' + a.toFixed(4) + '_' + b.toFixed(4);
}

function photoFolder_() {
  const id = prop_('PHOTO_FOLDER_ID', '');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { console.warn('PHOTO_FOLDER_ID のフォルダが見つかりません。作り直します'); }
  }
  const f = DriveApp.createFolder('ano-basho-flight 思い出の写真');
  PropertiesService.getScriptProperties().setProperty('PHOTO_FOLDER_ID', f.getId());
  return f;
}

function photoCounts_(email) {
  const sh = sheet_(SHEET_PHOTOS);
  const last = sh.getLastRow();
  const counts = {};
  if (last < 2) return counts;
  sh.getRange(2, 1, last - 1, 3).getValues().forEach(function (v) {
    if (String(v[1]).toLowerCase() === email) counts[String(v[2])] = (counts[String(v[2])] || 0) + 1;
  });
  return counts;
}

function deletePhotosByPlace_(email, key) {
  const sh = sheet_(SHEET_PHOTOS);
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const vals = sh.getRange(2, 1, last - 1, PHOTO_HEADERS.length).getValues();
  let n = 0;
  for (let i = vals.length - 1; i >= 0; i--) { // 下の行から削除
    const v = vals[i];
    if (String(v[1]).toLowerCase() !== email || String(v[2]) !== key) continue;
    try { DriveApp.getFileById(String(v[4])).setTrashed(true); } catch (e) { console.warn(e); }
    sh.deleteRow(i + 2);
    n++;
  }
  return n;
}

function photoOut_(v) {
  return {
    id: String(v[0]),
    thumb: String(v[5] || ''),
    caption: String(v[6] || ''),
    era: String(v[7] || ''),
    width: Number(v[8]) || 0,
    height: Number(v[9]) || 0,
    createdAt: v[10] ? Utilities.formatDate(new Date(v[10]), 'Asia/Tokyo', 'yyyy/MM/dd') : ''
  };
}

function findPhoto_(id, email) {
  const sh = sheet_(SHEET_PHOTOS);
  const last = sh.getLastRow();
  if (last < 2) return null;
  const vals = sh.getRange(2, 1, last - 1, PHOTO_HEADERS.length).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(id)) {
      if (String(vals[i][1]).toLowerCase() !== email) throw err_('この写真を操作する権限がありません');
      return { row: i + 2, v: vals[i] };
    }
  }
  return null;
}

function listPhotos_(req, user) {
  const key = placeKey_(req.lat, req.lng);
  const sh = sheet_(SHEET_PHOTOS);
  const last = sh.getLastRow();
  if (last < 2) return { photos: [] };
  const vals = sh.getRange(2, 1, last - 1, PHOTO_HEADERS.length).getValues();
  const photos = vals
    .filter(function (v) { return String(v[1]).toLowerCase() === user.email && String(v[2]) === key; })
    .map(photoOut_);
  return { photos: photos };
}

function uploadPhoto_(req, user) {
  const key = placeKey_(req.lat, req.lng);
  const image = String(req.image || '');
  if (!image) throw err_('写真のデータがありません');
  if (image.length > MAX_IMAGE_B64) throw err_('写真のサイズが大きすぎます');
  const bytes = Utilities.base64Decode(image);
  if (bytes.length < 4 || bytes[0] !== -1 || bytes[1] !== -40) throw err_('JPEG形式の写真ではありません');
  let thumb = String(req.thumb || '');
  if (thumb.length > MAX_THUMB_B64 || !/^[A-Za-z0-9+/=]+$/.test(thumb)) thumb = '';

  countDaily_('ph', user.email, Number(prop_('DAILY_PHOTO_LIMIT', '30')), '今日の写真登録の上限に達しました。また明日登録してください');

  return withLock_(function () {
    const sh = sheet_(SHEET_PHOTOS);
    const last = sh.getLastRow();
    if (last >= 2) {
      const n = sh.getRange(2, 1, last - 1, 3).getValues()
        .filter(function (v) { return String(v[1]).toLowerCase() === user.email && String(v[2]) === key; }).length;
      if (n >= MAX_PHOTOS_PER_PLACE) throw err_('この場所に登録できる写真は' + MAX_PHOTOS_PER_PLACE + '枚までです');
    }
    const id = Utilities.getUuid();
    const file = photoFolder_().createFile(Utilities.newBlob(bytes, 'image/jpeg', id + '.jpg'));
    const row = [
      id, user.email, key,
      safe_(String(req.placeName || '').slice(0, 50)),
      file.getId(), thumb,
      safe_(String(req.caption || '').trim().slice(0, 100)),
      safe_(String(req.era || '').trim().slice(0, 30)),
      Number(req.width) || '', Number(req.height) || '', new Date()
    ];
    sh.appendRow(row);
    return { photo: photoOut_(row), message: '写真を登録しました' };
  });
}

function getPhoto_(req, user) {
  const m = findPhoto_(req.id, user.email);
  if (!m) throw err_('写真が見つかりません', 'NOT_FOUND');
  const blob = DriveApp.getFileById(String(m.v[4])).getBlob();
  return { image: Utilities.base64Encode(blob.getBytes()), mimeType: blob.getContentType() || 'image/jpeg' };
}

function deletePhoto_(req, user) {
  return withLock_(function () {
    const m = findPhoto_(req.id, user.email);
    if (!m) throw err_('写真が見つかりません', 'NOT_FOUND');
    try { DriveApp.getFileById(String(m.v[4])).setTrashed(true); } catch (e) { console.warn(e); }
    sheet_(SHEET_PHOTOS).deleteRow(m.row);
    return { message: '写真を削除しました' };
  });
}

/* =========================================================
 *  ユーティリティ
 * ========================================================= */
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function err_(msg, code) {
  const e = new Error(msg);
  e.userMessage = msg;
  e.code = code || 'BAD_REQUEST';
  return e;
}
function prop_(k, d) {
  const v = PropertiesService.getScriptProperties().getProperty(k);
  return (v === null || v === '') ? d : v;
}
function ss_() {
  const id = prop_('SPREADSHEET_ID', '');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}
function sheet_(name) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    const headers = SHEET_HEADERS[name];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < SHEET_HEADERS[name].length) {
    // 列が増えたときは見出しを追加
    const headers2 = SHEET_HEADERS[name];
    sh.getRange(1, 1, 1, headers2.length).setValues([headers2]).setFontWeight('bold');
  }
  return sh;
}
function findMember_(email) {
  email = normEmail_(email);
  if (!email) return null;
  const vals = sheet_(SHEET_MEMBERS).getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][M.email]).trim().toLowerCase() === email) return { row: i + 1, v: vals[i] };
  }
  return null;
}
function setCells_(sh, row, obj) {
  Object.keys(obj).forEach(function (k) { sh.getRange(row, M[k] + 1).setValue(obj[k]); });
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function hash_(pw, salt) {
  const pepper = prop_('PEPPER', '');
  let v = salt + ':' + pw + ':' + pepper;
  for (let i = 0; i < HASH_ROUNDS; i++) {
    v = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, v, Utilities.Charset.UTF_8));
  }
  return v;
}
function tempPassword_() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now() + Math.random());
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[(bytes[i] + 256) % chars.length];
  return out;
}
function validatePassword_(pw) {
  if (pw.length < 8) throw err_('パスワードは8文字以上にしてください');
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) throw err_('パスワードは英字と数字を両方含めてください');
}
function normEmail_(e) { return String(e || '').trim().toLowerCase(); }
function isEmail_(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function isTrue_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function safe_(s) { s = String(s || ''); return /^[=+\-@]/.test(s) ? "'" + s : s; }

function countDaily_(kind, email, limit, msg) {
  const key = kind + '_' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd') + '_' + email;
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(key) || 0);
  if (n >= limit) throw err_(msg, 'LIMIT');
  cache.put(key, String(n + 1), 21600);
}

function sendTempMail_(email, nickname, temp, lead) {
  const url = prop_('APP_URL', '');
  MailApp.sendEmail({
    to: email,
    name: 'イーグル隊長（あの場所は今）',
    subject: '【あの場所は今】仮パスワードのお知らせ',
    body: [
      nickname + ' さん',
      '',
      lead,
      '',
      '仮パスワード： ' + temp,
      '',
      'ログインすると、パスワードの変更画面が開きます。',
      'ご自分だけのパスワードに変更してください。',
      url ? '\n' + url : '',
      '',
      '――しっかりつかまってな、相棒！　イーグル隊長より',
      '',
      '※このメールに心当たりがない場合は破棄してください。'
    ].join('\n')
  });
}

/* =========================================================
 *  初期設定・テスト（エディタから手動実行）
 * ========================================================= */
function setup() {
  sheet_(SHEET_MEMBERS);
  sheet_(SHEET_FLIGHTS);
  sheet_(SHEET_PHOTOS);
  console.log('写真フォルダ: ' + photoFolder_().getName());
  console.log('音声キャッシュ: ' + ttsCacheFolder_().getName());
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PEPPER')) {
    props.setProperty('PEPPER', Utilities.getUuid() + Utilities.getUuid());
    console.log('PEPPER を生成しました（変更しないでください）');
  }
  // 権限承認用（Maps・メール・外部通信）
  Maps.newGeocoder().geocode('東京駅');
  console.log('メール残数/日: ' + MailApp.getRemainingDailyQuota());
  console.log('setup 完了 v' + APP_VERSION);
}

function testScript() {
  const geo = geocode_('横浜 山下公園');
  const r = generateScript_({ query: '横浜 山下公園', address: geo.address, lat: geo.lat, lng: geo.lng, era: '1980年代', memory: '', nickname: 'テスト' });
  console.log(JSON.stringify(r, null, 2));
}

function testTts() {
  const r = tts_({ text: 'しっかりつかまれ、相棒！いくぜ！' }, { email: 'test@example.com' });
  console.log(r.mimeType + ' / base64長: ' + r.audio.length);
}
