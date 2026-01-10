const messages = {
  common: {
    all: 'All',
    category: 'Category',
    manga: 'Manga',
    tags: 'Tags',
  },
  categories: {
    AI_ARTBOOK: 'AI Art',
    CG_ARTBOOK: 'CG Art',
    COSPLAY: 'Cosplay',
    DOUJINSHI: 'Doujin',
    DOUJINSHI_CHINESE: 'CN Doujin',
    DOUJINSHI_JAPANESE: 'JP Doujin',
    MAGAZINE_SHORT_CHINESE: 'CN Short Mag',
    MAGAZINE_SHORT_JAPANESE: 'JP Short Mag',
    TANKOUBON_CHINESE: 'CN Tanko',
    TANKOUBON_JAPANESE: 'JP Tanko',
  },
  list: {
    loading: 'Loading manga...',
    empty: 'No manga yet.',
    noCover: 'No cover',
    coverAlt: '{title} cover',
    searchPlaceholder: 'Search title or tag',
    searchLabel: 'Search manga',
  },
  viewer: {
    backToList: 'Back to list',
    loadingPages: 'Loading pages...',
    empty: 'No pages found.',
    pageAlt: 'Page {index}',
    pageCount: '{count} pages',
    pageCountSingle: '{count} page',
  },
  rating: {
    label: 'Rating',
    value: 'Rated {value}/5',
    valueShort: '{value}/5',
    unrated: 'Not rated',
    set: 'Set {value} stars',
    updateFailed: 'Failed to update rating',
  },
  pagination: {
    label: 'Pagination',
    prev: 'Prev',
    next: 'Next',
  },
  errors: {
    loadManga: 'Failed to load manga',
    invalidMangaId: 'Invalid manga id',
  },
  meta: {
    listTitle: 'Yomi Manga - Manga Library',
    viewerTitle: 'Yomi Manga - {title}',
    viewerTitleFallback: 'Yomi Manga - Manga Reader',
  },
  locale: {
    label: 'Language',
    english: 'English',
    chinese: 'Chinese',
    japanese: 'Japanese',
  },
}

export default messages
