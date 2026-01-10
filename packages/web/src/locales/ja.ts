const messages = {
  common: {
    all: 'すべて',
    category: 'カテゴリ',
    manga: '漫画',
    tags: 'タグ',
  },
  categories: {
    AI_ARTBOOK: 'AI 画集',
    CG_ARTBOOK: 'CG 画集',
    COSPLAY: 'コスプレ',
    DOUJINSHI: '同人誌',
    DOUJINSHI_CHINESE: '中国語同人誌',
    DOUJINSHI_JAPANESE: '日本語同人誌',
    MAGAZINE_SHORT_CHINESE: '中国語短編マガジン',
    MAGAZINE_SHORT_JAPANESE: '日本語短編マガジン',
    TANKOUBON_CHINESE: '中国語単行本',
    TANKOUBON_JAPANESE: '日本語単行本',
  },
  list: {
    loading: '漫画を読み込み中...',
    empty: 'まだ漫画がありません。',
    noCover: '表紙なし',
    coverAlt: '「{title}」の表紙',
    searchPlaceholder: 'タイトルまたはタグで検索',
    searchLabel: '漫画を検索',
  },
  viewer: {
    backToList: '一覧に戻る',
    loadingPages: 'ページを読み込み中...',
    empty: 'ページが見つかりません。',
    pageAlt: '{index} ページ',
    pageCount: '{count} ページ',
    pageCountSingle: '{count} ページ',
  },
  rating: {
    label: '評価',
    value: '評価 {value}/5',
    valueShort: '{value}/5',
    unrated: '未評価',
    set: '{value} 星に設定',
    updateFailed: '評価の更新に失敗しました',
  },
  pagination: {
    label: 'ページネーション',
    prev: '前へ',
    next: '次へ',
  },
  errors: {
    loadManga: '漫画の読み込みに失敗しました',
    invalidMangaId: '無効な漫画IDです',
  },
  meta: {
    listTitle: 'Yomi Manga - マンガライブラリー',
    viewerTitle: 'Yomi Manga - {title}',
    viewerTitleFallback: 'Yomi Manga - ビューアー',
  },
  locale: {
    label: '言語',
    english: '英語',
    chinese: '中国語',
    japanese: '日本語',
  },
}

export default messages
