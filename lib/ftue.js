export const STARTER_PACK_SLUGS = Object.freeze([
  "fan-favorites-letterboxd-core",
  "studio-ghibli-gateways",
  "black-cinema-essentials",
]);

export const getFirstRunExperience = (rankingLength) => {
  const count = Math.max(0, Math.floor(Number(rankingLength) || 0));
  if (count === 0) {
    return {
      state: "empty",
      visible: true,
      eyebrow: "How StackRank works",
      title: "Add two movies. Pick the one you prefer.",
      body: "Each choice narrows the list until every movie has an exact rank.",
      showImport: true,
    };
  }
  if (count === 1) {
    return {
      state: "one",
      visible: true,
      eyebrow: "First movie ranked",
      title: "Add one more to start comparing.",
      body: "Choose any movie above or pick one from a pack below.",
      showImport: false,
    };
  }
  return {
    state: "established",
    visible: false,
    eyebrow: "",
    title: "",
    body: "",
    showImport: false,
  };
};

export const selectStarterPacks = (
  packs,
  { preferredSlugs = STARTER_PACK_SLUGS, limit = 3 } = {},
) => {
  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0));
  if (!safeLimit || !Array.isArray(packs)) return [];

  const eligible = packs.filter(
    (pack) =>
      pack &&
      pack.active !== false &&
      typeof pack.slug === "string" &&
      pack.slug &&
      Array.isArray(pack.movies) &&
      pack.movies.length,
  );
  const bySlug = new Map(eligible.map((pack) => [pack.slug, pack]));
  const selected = [];
  const selectedSlugs = new Set();

  preferredSlugs.forEach((slug) => {
    const pack = bySlug.get(slug);
    if (!pack || selectedSlugs.has(slug) || selected.length >= safeLimit) return;
    selected.push(pack);
    selectedSlugs.add(slug);
  });

  eligible
    .slice()
    .sort(
      (a, b) =>
        Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
        a.title.localeCompare(b.title),
    )
    .forEach((pack) => {
      if (selected.length >= safeLimit || selectedSlugs.has(pack.slug)) return;
      selected.push(pack);
      selectedSlugs.add(pack.slug);
    });

  return selected;
};
