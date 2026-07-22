export type OpenLibraryBookResult = {
  key: string;
  title: string;
  authors: string[];
  year: number | null;
  coverId: number | null;
};

const workKey = (value: unknown) => {
  const match = String(value || "").match(/^\/works\/(OL\d+W)$/i);
  return match ? `/works/${match[1].toUpperCase()}` : "";
};

export const normalizeOpenLibraryBook = (
  value: Record<string, unknown>,
): OpenLibraryBookResult | null => {
  const key = workKey(value?.key);
  const title = String(value?.title || "").trim();
  if (!key || !title) return null;
  const authors = (Array.isArray(value?.author_name) ? value.author_name : [])
    .map((author) => String(author || "").trim())
    .filter(Boolean)
    .slice(0, 3);
  const year = Number(value?.first_publish_year);
  const coverId = Number(value?.cover_i);
  return {
    key,
    title,
    authors,
    year: Number.isInteger(year) && year > 0 ? year : null,
    coverId: Number.isInteger(coverId) && coverId > 0 ? coverId : null,
  };
};

export const normalizeOpenLibraryBooks = (
  values: unknown,
  limit = 8,
): OpenLibraryBookResult[] => {
  if (!Array.isArray(values)) return [];
  const results: OpenLibraryBookResult[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const book = normalizeOpenLibraryBook(value as Record<string, unknown>);
    if (!book || seen.has(book.key)) continue;
    seen.add(book.key);
    results.push(book);
    if (results.length >= limit) break;
  }
  return results;
};
