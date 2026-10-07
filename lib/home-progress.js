// Count-only preview: never treat a legacy or another owner's mirror as anonymous.
export function localRankingCount({ safetyRaw, authRaw, rawKey, field = "items", now = Date.now() }) {
  try {
    let owner = "anonymous";
    const session = authRaw ? JSON.parse(authRaw) : null;
    if (session?.user?.id && Number(session.expires_at) * 1000 > now) owner = `user:${session.user.id}`;
    const document = JSON.parse(safetyRaw || "null");
    if (document?.version !== 1) return 0;
    const raw = document.owners?.[owner]?.raw?.[rawKey];
    if (typeof raw !== "string") return 0;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length;
    return Array.isArray(parsed?.[field]) ? parsed[field].length : 0;
  } catch (_error) { return 0; }
}
