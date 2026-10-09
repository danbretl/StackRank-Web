// Public viewers never need an account session or owner columns. The legacy
// lookup is only for the client-first rollout before the RPC migration exists.
export const PUBLIC_SHARE_AUTH_OPTIONS = Object.freeze({
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
});

export const readPublicShare = async (client, { category, slug }) => {
  const dogs = category === "dogs";
  if ((!dogs && category !== "movies") || !(dogs ? /^[a-z0-9]{12}$/ : /^[a-z0-9]{10}$/).test(slug)) {
    return { data: null, error: null };
  }
  let result = await client.rpc(dogs ? "read_dog_share" : "read_movie_share", { share_slug: slug }).maybeSingle();
  if (result.error?.code === "PGRST202") {
    // Missing function in the schema cache only. Never downgrade on permission,
    // network, server, malformed-response or missing/revoked-snapshot outcomes.
    let query = client.from(dogs ? "category_shared_lists" : "shared_lists")
      .select(dogs ? "slug,category,payload,created_at,updated_at" : "payload, updated_at")
      .eq("slug", slug);
    query = dogs ? query.eq("category", "dogs") : query.eq("revoked", false);
    result = await query.maybeSingle();
  }
  if (result.error || !result.data) return result;
  const allowed = new Set(dogs
    ? ["slug", "category", "payload", "created_at", "updated_at"]
    : ["slug", "payload", "updated_at"]);
  if (Array.isArray(result.data) || typeof result.data !== "object" ||
      Object.keys(result.data).some((key) => !allowed.has(key)) ||
      (result.data.slug !== undefined && result.data.slug !== slug) ||
      (dogs && result.data.category !== "dogs")) {
    return { data: null, error: { message: "Unexpected public snapshot response" } };
  }
  return result;
};
