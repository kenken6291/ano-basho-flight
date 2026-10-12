/**
 * あの場所は今 ― イーグル隊長の空中散歩
 * config.js（設定はここに集約）
 */
window.APP_CONFIG = {
  APP_NAME: 'あの場所は今 ― イーグル隊長の空中散歩',
  APP_VERSION: 'v1.5.0',

  // GAS ウェブアプリURL（…/exec）
  GAS_URL: 'https://script.google.com/macros/s/AKfycbx8EiFChsysjJAe9kHTF1kHJdcjKnsTRWrn2XgeEKpvC8CP0YUcmO_qhRuS3zkQTPbN/exec',

  // Google Maps APIキーは GAS のスクリプトプロパティ「GOOGLE_MAPS_API_KEY」に設定します
  // （ログイン後にサーバーから受け取るため、ここには書きません）

  SESSION_KEY: 'abf_session',
  PREFS_KEY: 'abf_prefs',

  // 3D地図フライト（現在地 → 思い出の場所）
  FLIGHT3D: {
    enabled: true,          // false にすると Earth Studio 映像モードだけで飛ぶ
    mapsVersion: 'beta',    // Maps JavaScript API のバージョン
    mode: 'HYBRID',         // HYBRID（地名ラベルあり）／SATELLITE（写真のみ）
    useGeolocation: true,   // 現在地から出発する
    // 現在地が使えないときの出発地
    defaultStart: { name: '東京駅', lat: 35.681236, lng: 139.767125 }
  },

  // 思い出の写真（登録前にブラウザで縮小）
  PHOTO: {
    maxSize: 1600,       // 長辺の最大ピクセル
    quality: 0.82,       // JPEG画質
    thumbSize: 240,      // 一覧用サムネイルの長辺
    thumbQuality: 0.7,
    maxFileMB: 40        // 元の写真として選べる最大サイズ
  },

  // 映像モード（3D地図が使えない環境用）の巡航最短秒数
  CRUISE_MIN_SECONDS: 10,

  TTS: {
    useGemini: true,          // GAS経由の Gemini TTS を使う
    fallbackWebSpeech: true,  // 失敗時・上限到達時はブラウザ読み上げで代用
    mergeGuide: true          // 到着後の解説をまとめて1回の音声にする（AI音声の回数を節約）
  },

  // 予備の映像・効果音アセット
  //  url     : 優先して使う（GitHub Pages リポジトリ内に置くのが最も安定）
  //  driveId : url が無い／読み込めない場合に使う Google Drive のファイルID
  ASSETS: {
    video: {
      takeoff: { url: 'assets/video/takeoff.mp4', driveId: '' },
      cruise:  { url: 'assets/video/cruise.mp4',  driveId: '' },
      dive:    { url: 'assets/video/dive.mp4',    driveId: '' }
    },
    se: {
      cry:    { url: 'assets/se/eagle-cry.mp3', driveId: '' },  // 鷲の鳴き声（離陸時）
      wind:   { url: 'assets/se/wind-loop.mp3', driveId: '' },  // 風切り音（巡航中ループ）
      whoosh: { url: 'assets/se/whoosh.mp3',    driveId: '' }   // 急降下
    }
  },

  // 映像モード用：行き先に特定の言葉が含まれるときだけ使う専用映像（任意）
  SPECIAL_FLIGHTS: [],

  // 映像モード時の帰属表示
  EARTH_ATTRIBUTION: '映像：Google Earth'
};
