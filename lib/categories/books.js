export const BOOKS_CATEGORY = Object.freeze({
  id: "books",
  path: "/books",
  // The extensionful alias keeps the no-rewrite Python development server
  // useful; hosted environments always use the canonical /books route.
  documentPathAliases: Object.freeze(["/books.html"]),
  labels: Object.freeze({
    singular: "book",
    plural: "books",
    savedList: "Read next",
    hiddenList: "Not for me",
    artwork: "cover",
  }),
  provider: Object.freeze({
    id: "openlibrary",
    name: "Open Library",
  }),
  artwork: Object.freeze({ aspectRatio: 2 / 3 }),
  exportFilePrefix: "stackrank-books",
});

const workIdFromKey = (value) => {
  const match = String(value || "").match(/^\/?works\/(OL\d+W)$/i);
  return match ? match[1].toUpperCase() : "";
};

export function bookCoverUrl(coverId, size = "M") {
  const id = Number(coverId);
  const normalizedSize = ["S", "M", "L"].includes(size) ? size : "M";
  return Number.isInteger(id) && id > 0
    ? `https://covers.openlibrary.org/b/id/${id}-${normalizedSize}.jpg?default=false`
    : "";
}

export function normalizeBookSearchResult(value) {
  const sourceId = workIdFromKey(value?.key || value?.sourceId);
  const title = String(value?.title || "").trim();
  if (!sourceId || !title) return null;
  const authors = (Array.isArray(value?.authors)
    ? value.authors
    : Array.isArray(value?.author_name)
      ? value.author_name
      : [])
    .map((author) => String(author || "").trim())
    .filter(Boolean)
    .slice(0, 3);
  const year = Number(value?.year ?? value?.first_publish_year);
  const coverId = Number(value?.coverId ?? value?.cover_i);
  return {
    entityRef: {
      domain: "books",
      type: "work",
      source: "openlibrary",
      id: sourceId,
    },
    snapshot: {
      primaryText: title,
      secondaryText: authors.join(", "),
      year: Number.isInteger(year) && year > 0 ? year : null,
      image: {
        url: bookCoverUrl(coverId, "M"),
        alt: `${title} cover`,
        assetId:
          Number.isInteger(coverId) && coverId > 0
            ? `openlibrary-cover:${coverId}`
            : "",
      },
    },
    providerData: {
      coverId: Number.isInteger(coverId) && coverId > 0 ? coverId : null,
      authors,
    },
  };
}

const book = (sourceId, title, author, year, coverId) =>
  normalizeBookSearchResult({
    key: `/works/${sourceId}`,
    title,
    author_name: [author],
    first_publish_year: year,
    cover_i: coverId,
  });

export const BOOK_STARTER_SHELVES = Object.freeze([
  Object.freeze({
    id: "modern-essentials",
    title: "Modern essentials",
    items: Object.freeze([
      book("OL5735363W", "The Hunger Games", "Suzanne Collins", 2008, 12646537),
      book("OL5781992W", "The Kite Runner", "Khaled Hosseini", 2003, 14846827),
      book("OL18766691W", "Where the Crawdads Sing", "Delia Owens", 2018, 8362947),
      book("OL17930367W", "Becoming", "Michelle Obama", 2018, 8824664),
    ]),
  }),
  Object.freeze({
    id: "short-books-big-impact",
    title: "Short books, big impact",
    items: Object.freeze([
      book("OL1168007W", "Animal Farm", "George Orwell", 1945, 11261770),
      book("OL23204W", "Of Mice and Men", "John Steinbeck", 1937, 14319003),
      book("OL872932W", "Siddhartha", "Hermann Hesse", 1922, 6562535),
      book("OL498556W", "Metamorphosis", "Franz Kafka", 1915, 12820198),
    ]),
  }),
  Object.freeze({
    id: "beloved-science-fiction",
    title: "Beloved science fiction",
    items: Object.freeze([
      book("OL893415W", "Dune", "Frank Herbert", 1965, 11481354),
      book("OL27258W", "Neuromancer", "William Gibson", 1984, 283860),
      book("OL49488W", "Ender's Game", "Orson Scott Card", 1985, 12996033),
      book("OL59800W", "The Left Hand of Darkness", "Ursula K. Le Guin", 1969, 10618463),
    ]),
  }),
]);
