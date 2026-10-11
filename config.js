/**
 * あの場所は今 ― イーグル隊長の空中散歩
 * config.js（設定はここに集約）
 *
 * GitHub Actions を使う場合は __GAS_API_URL__ / __GOOGLE_MAPS_API_KEY__ が
 * Secrets の値に自動で置き換わります。手動運用なら直接書き換えてください。
 */
window.APP_CONFIG = {
  APP_NAME: 'あの場所は今 ― イーグル隊長の空中散歩',
  APP_VERSION: 'v1.0.0',

  // GAS ウェブアプリURL（…/exec）
  GAS_URL: 'https://script.google.com/macros/s/AKfycbx8EiFChsysjJAe9kHTF1kHJdcjKnsTRWrn2XgeEKpvC8CP0YUcmO_qhRuS3zkQTPbN/exec',

  // Google Maps Embed API キー（HTTPリファラー制限必須）
  // 未設定でも航空写真・地図は表示されます（ストリートビューはGoogleマップへのリンク表示）
  MAPS_EMBED_API_KEY: 'AIzaSyBn945ysEAHA_93bp-fx7XSpgUs8YJP6Wk',

  SESSION_KEY: 'abf_session',
  PREFS_KEY: 'abf_prefs',

  // 巡航フェーズの最短秒数（実況が短くてもこれだけは飛ぶ）
  CRUISE_MIN_SECONDS: 10,

  TTS: {
    useGemini: true,          // GAS経由の Gemini TTS を使う
    fallbackWebSpeech: true   // 失敗時はブラウザ読み上げで代用
  },

  // 映像・効果音アセット
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

  // 行き先に特定の言葉が含まれるときだけ使う専用映像（任意）
  // 例: { keywords: ['東京タワー', '芝公園'], cruise: { driveId: 'xxxx' }, dive: { url: 'assets/video/tokyo-tower-dive.mp4' } }
  SPECIAL_FLIGHTS: [],

  // Google Earth Studio 映像の帰属表示
  EARTH_ATTRIBUTION: '映像：Google Earth'
};
