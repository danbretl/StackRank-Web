export const CATEGORY_BACKUP_KIND = "stackrank-category-backup";
export const CATEGORY_BACKUP_VERSION = 1;

const validCategory = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ""));

export function buildCategoryBackup(category, items, exportedAt = new Date().toISOString()) {
  if (!validCategory(category)) return null;
  return {
    kind: CATEGORY_BACKUP_KIND,
    version: CATEGORY_BACKUP_VERSION,
    category,
    exportedAt,
    ranking: Array.isArray(items) ? items : [],
  };
}

export function parseCategoryBackup(raw, expectedCategory) {
  if (!validCategory(expectedCategory)) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (
      !parsed ||
      parsed.kind !== CATEGORY_BACKUP_KIND ||
      parsed.version !== CATEGORY_BACKUP_VERSION ||
      parsed.category !== expectedCategory ||
      !Array.isArray(parsed.ranking)
    ) {
      return null;
    }
    return {
      category: parsed.category,
      exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : null,
      ranking: parsed.ranking,
    };
  } catch (_error) {
    return null;
  }
}
