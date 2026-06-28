export const parsePublishableKeys = (raw: string | undefined): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.values(parsed).filter((value): value is string => typeof value === "string" && value.length > 0);
  } catch (_error) {
    return [];
  }
};

export const isPublishableKeyAllowed = (candidate: string | null, configuredKeys: string[]) =>
  Boolean(candidate && configuredKeys.includes(candidate));

export const hasValidPublishableKey = (req: Request) =>
  isPublishableKeyAllowed(
    req.headers.get("apikey"),
    parsePublishableKeys(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")),
  );
