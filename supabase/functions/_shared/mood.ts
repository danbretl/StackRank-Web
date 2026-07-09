// Mood/vibe interpreter for the "Pick something for tonight" feature.
//
// Pure and dependency-free so it can be Deno-tested alongside the other
// _shared modules. `interpretMood` turns free text ("something cozy and
// funny", "mind-bending 80s sci-fi") into a bounded profile of TMDB genre
// weights, keyword targets, an optional era range, and an optional runtime
// hint. `scoreMoodMatch` scores one candidate movie's facts against that
// profile and reports which signals matched so the client can explain the
// pick. No TMDB ratings are ever consulted — mood fit is about content
// signals, not consensus quality.

export type MoodSense = {
  id: string;
  label: string;
  terms: string[];
  genres?: Record<string, number>;
  keywords?: string[];
  runtimeHint?: "short" | "long";
  olderBias?: boolean;
};

export type MoodEra = { from: number; to: number; label: string };

export type MoodProfile = {
  input: string;
  senses: MoodSense[];
  recognized: string[];
  genres: Record<string, number>;
  keywords: string[];
  era: MoodEra | null;
  runtimeHint: "short" | "long" | null;
  olderBias: boolean;
  readable: boolean;
};

export type MoodCandidateFacts = {
  genres?: string[];
  keywords?: string[];
  year?: number | null;
};

export type MoodMatch = {
  score: number;
  senses: string[];
  keywords: string[];
  era: string | null;
};

// Curated vibe lexicon. Genre weights are -1..1 (negative = the vibe avoids
// that genre); keywords are normalized fragments matched against TMDB keyword
// names. Terms are matched as whole words/phrases in the normalized input.
export const MOOD_SENSES: MoodSense[] = [
  {
    id: "cozy",
    label: "cozy",
    terms: ["cozy", "cosy", "comfy", "comfort", "comforting", "snug", "rainy day", "warm blanket", "hygge"],
    genres: { Family: 0.6, Comedy: 0.45, Romance: 0.35, Animation: 0.4, Horror: -0.8, War: -0.6, Thriller: -0.3 },
    keywords: ["feel good", "friendship", "small town", "christmas", "cooking", "heartwarming", "holiday"],
  },
  {
    id: "feel-good",
    label: "feel-good",
    terms: ["feel good", "feelgood", "uplifting", "wholesome", "heartwarming", "pick me up", "happy", "cheerful", "optimistic"],
    genres: { Comedy: 0.5, Family: 0.4, Music: 0.3, Romance: 0.3, Horror: -0.7, War: -0.5 },
    keywords: ["feel good", "inspiring", "underdog", "friendship", "hope", "kindness"],
  },
  {
    id: "funny",
    label: "funny",
    terms: ["funny", "laugh", "laughs", "laugh out loud", "hilarious", "comedy", "silly", "goofy", "lighthearted", "light hearted", "witty"],
    genres: { Comedy: 1, Horror: -0.4 },
    keywords: ["parody", "satire", "spoof", "buddy", "comedy"],
  },
  {
    id: "romantic",
    label: "romantic",
    terms: ["romantic", "romance", "date night", "love story", "swoony", "rom com", "romcom"],
    genres: { Romance: 1, Comedy: 0.2, Drama: 0.2 },
    keywords: ["love", "wedding", "falling in love", "romance"],
  },
  {
    id: "scary",
    label: "scary",
    terms: ["scary", "horror", "spooky", "creepy", "frightening", "terrifying", "haunted", "halloween", "chilling"],
    genres: { Horror: 1, Thriller: 0.4, Mystery: 0.3, Family: -0.6 },
    keywords: ["ghost", "haunting", "slasher", "supernatural", "haunted house", "monster", "demonic", "possession"],
  },
  {
    id: "tense",
    label: "tense",
    terms: ["tense", "suspense", "suspenseful", "thriller", "edge of my seat", "edge of your seat", "gripping", "nail biting"],
    genres: { Thriller: 1, Crime: 0.5, Mystery: 0.5 },
    keywords: ["heist", "conspiracy", "hostage", "cat and mouse", "serial killer", "kidnapping"],
  },
  {
    id: "mind-bending",
    label: "mind-bending",
    terms: ["mind bending", "mindbending", "mind bender", "trippy", "surreal", "head trip", "cerebral", "makes you think", "brainy", "twisty", "plot twist", "mindblowing", "mind blowing"],
    genres: { "Science Fiction": 0.7, Mystery: 0.5, Thriller: 0.3, Fantasy: 0.2 },
    keywords: ["time travel", "parallel", "dream", "memory", "simulation", "plot twist", "nonlinear", "psychological", "identity", "time loop"],
  },
  {
    id: "action",
    label: "action-packed",
    terms: ["action", "action packed", "adrenaline", "explosive", "high octane", "fast paced"],
    genres: { Action: 1, Adventure: 0.5 },
    keywords: ["car chase", "martial arts", "explosion", "spy", "chase", "one man army"],
  },
  {
    id: "adventure",
    label: "adventurous",
    terms: ["adventure", "adventurous", "quest", "journey", "expedition", "swashbuckling"],
    genres: { Adventure: 1, Fantasy: 0.4, Action: 0.3 },
    keywords: ["quest", "expedition", "treasure", "survival", "jungle", "island"],
  },
  {
    id: "epic",
    label: "epic",
    terms: ["epic", "grand", "sprawling", "saga", "sweeping"],
    genres: { Adventure: 0.5, War: 0.4, History: 0.4, Fantasy: 0.4, Drama: 0.2 },
    keywords: ["empire", "battle", "kingdom", "epic"],
    runtimeHint: "long",
  },
  {
    id: "chill",
    label: "chill",
    terms: ["chill", "chilled", "easy watch", "easygoing", "mellow", "relaxed", "relaxing", "low key", "breezy", "turn my brain off", "brain off", "casual"],
    genres: { Comedy: 0.5, Family: 0.3, Animation: 0.3, Romance: 0.2, Horror: -0.5, Thriller: -0.3, War: -0.4 },
    keywords: ["feel good", "friendship", "road trip"],
  },
  {
    id: "tearjerker",
    label: "a good cry",
    terms: ["sad", "cry", "tearjerker", "tear jerker", "weepy", "emotional", "devastating", "good cry", "heartbreaking"],
    genres: { Drama: 1, Romance: 0.3 },
    keywords: ["grief", "loss", "tragedy", "terminal illness", "death", "farewell"],
  },
  {
    id: "thoughtful",
    label: "thoughtful",
    terms: ["thoughtful", "contemplative", "slow burn", "meditative", "quiet", "introspective", "arthouse", "art house", "character driven"],
    genres: { Drama: 0.8, Mystery: 0.2, History: 0.2 },
    keywords: ["character study", "existential", "loneliness", "philosophy", "melancholy"],
  },
  {
    id: "dark",
    label: "dark",
    terms: ["dark", "bleak", "grim", "gritty", "noir", "brutal", "disturbing"],
    genres: { Crime: 0.6, Thriller: 0.5, Drama: 0.3, Horror: 0.3, Family: -0.8 },
    keywords: ["neo noir", "film noir", "corruption", "revenge", "dystopia", "anti hero", "violence", "moral ambiguity"],
  },
  {
    id: "weird",
    label: "weird",
    terms: ["weird", "strange", "bizarre", "offbeat", "quirky", "oddball", "unconventional", "cult classic"],
    genres: { Fantasy: 0.3, "Science Fiction": 0.3, Comedy: 0.3 },
    keywords: ["surreal", "absurd", "cult", "eccentric", "dark comedy"],
  },
  {
    id: "whimsical",
    label: "whimsical",
    terms: ["whimsical", "whimsy", "magical", "charming", "fairy tale", "fairytale", "enchanting", "delightful"],
    genres: { Fantasy: 0.8, Family: 0.5, Animation: 0.5, Comedy: 0.2 },
    keywords: ["fairy tale", "magic", "imagination", "wonder"],
  },
  {
    id: "nostalgic",
    label: "nostalgic",
    terms: ["nostalgic", "nostalgia", "throwback", "retro", "old school", "classic"],
    keywords: ["coming of age", "childhood", "high school"],
    olderBias: true,
  },
  {
    id: "sci-fi",
    label: "sci-fi",
    terms: ["sci fi", "scifi", "science fiction", "space", "futuristic", "cyberpunk", "robots", "aliens", "dystopian"],
    genres: { "Science Fiction": 1 },
    keywords: ["space", "alien", "robot", "artificial intelligence", "cyberpunk", "dystopia", "outer space", "spaceship"],
  },
  {
    id: "fantasy",
    label: "fantastical",
    terms: ["fantasy", "wizards", "dragons", "sword and sorcery", "mythical"],
    genres: { Fantasy: 1, Adventure: 0.3 },
    keywords: ["magic", "dragon", "wizard", "sword and sorcery", "mythology", "elves"],
  },
  {
    id: "crime",
    label: "crime",
    terms: ["crime", "heist", "gangster", "mob", "mafia", "detective", "whodunit", "who done it", "murder mystery", "true crime"],
    genres: { Crime: 1, Mystery: 0.6, Thriller: 0.4 },
    keywords: ["heist", "gangster", "mafia", "detective", "murder", "investigation", "undercover", "organized crime"],
  },
  {
    id: "mystery",
    label: "mysterious",
    terms: ["mystery", "mysterious", "puzzle", "puzzling", "clues"],
    genres: { Mystery: 1, Thriller: 0.4, Crime: 0.3 },
    keywords: ["investigation", "detective", "secret", "disappearance", "conspiracy"],
  },
  {
    id: "family",
    label: "family night",
    terms: ["family movie", "family night", "with the kids", "kids", "children", "all ages", "family friendly"],
    genres: { Family: 1, Animation: 0.7, Adventure: 0.3, Horror: -1, Crime: -0.6 },
    keywords: ["family", "talking animals", "friendship"],
  },
  {
    id: "animated",
    label: "animated",
    terms: ["animated", "animation", "anime", "cartoon"],
    genres: { Animation: 1 },
    keywords: ["anime"],
  },
  {
    id: "musical",
    label: "musical",
    terms: ["musical", "sing along", "singalong", "music"],
    genres: { Music: 1 },
    keywords: ["musical", "singer", "band", "dancing", "concert"],
  },
  {
    id: "true-story",
    label: "true story",
    terms: ["documentary", "true story", "real life", "based on a true story", "docu"],
    genres: { Documentary: 0.9, History: 0.3 },
    keywords: ["based on true story", "biography", "based on real events"],
  },
  {
    id: "war",
    label: "war",
    terms: ["war", "battlefield", "military", "combat"],
    genres: { War: 1, History: 0.4, Action: 0.3 },
    keywords: ["world war", "soldier", "battle", "vietnam war"],
  },
  {
    id: "western",
    label: "western",
    terms: ["western", "cowboys", "wild west"],
    genres: { Western: 1 },
    keywords: ["cowboy", "outlaw", "frontier", "gunslinger"],
  },
  {
    id: "period",
    label: "period piece",
    terms: ["historical", "period piece", "period drama", "costume drama", "history"],
    genres: { History: 1, Drama: 0.3 },
    keywords: ["period drama", "royalty", "based on true story", "19th century"],
  },
  {
    id: "sports",
    label: "sports",
    terms: ["sports", "sport", "underdog story"],
    genres: { Drama: 0.3 },
    keywords: ["boxing", "baseball", "football", "basketball", "sports", "underdog"],
  },
  {
    id: "inspiring",
    label: "inspiring",
    terms: ["inspiring", "inspirational", "motivating", "triumphant"],
    genres: { Drama: 0.4, Family: 0.2 },
    keywords: ["underdog", "triumph", "based on true story", "inspiring", "perseverance"],
  },
  {
    id: "intense",
    label: "intense",
    terms: ["intense", "visceral", "hard hitting", "unrelenting", "white knuckle"],
    genres: { Thriller: 0.6, Drama: 0.4, Crime: 0.3, War: 0.3 },
    keywords: ["survival", "revenge", "psychological"],
  },
  {
    id: "short",
    label: "something quick",
    terms: ["short", "quick", "not too long", "under 90", "brief", "snappy"],
    runtimeHint: "short",
  },
  {
    id: "long",
    label: "a long one",
    terms: ["long", "three hours", "marathon", "big night"],
    runtimeHint: "long",
  },
];

const DECADE_WORDS: Record<string, number> = {
  twenties: 1920,
  thirties: 1930,
  forties: 1940,
  fifties: 1950,
  sixties: 1960,
  seventies: 1970,
  eighties: 1980,
  nineties: 1990,
  aughts: 2000,
  noughties: 2000,
};

export const normalizeMoodText = (value: string): string =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[-_/]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasPhrase = (haystack: string, phrase: string): boolean => {
  const index = haystack.indexOf(phrase);
  if (index < 0) return false;
  const before = index === 0 ? " " : haystack[index - 1];
  const afterIndex = index + phrase.length;
  const after = afterIndex >= haystack.length ? " " : haystack[afterIndex];
  return before === " " && after === " ";
};

const detectEra = (normalized: string): MoodEra | null => {
  const fourDigit = normalized.match(/\b(19[0-9]0|20[0-2]0)s\b/);
  if (fourDigit) {
    const from = Number(fourDigit[1]);
    return { from, to: from + 9, label: `${from}s` };
  }
  const twoDigit = normalized.match(/\b([2-9]0)s\b/);
  if (twoDigit) {
    const tens = Number(twoDigit[1]);
    const from = tens >= 30 ? 1900 + tens : 2000 + tens;
    return { from, to: from + 9, label: `${from}s` };
  }
  for (const [word, from] of Object.entries(DECADE_WORDS)) {
    if (hasPhrase(normalized, word)) {
      return { from, to: from + 9, label: `${from}s` };
    }
  }
  return null;
};

export function interpretMood(input: string): MoodProfile {
  const normalized = normalizeMoodText(String(input || "").slice(0, 160));
  const padded = ` ${normalized} `;
  const senses = normalized
    ? MOOD_SENSES.filter((sense) => sense.terms.some((term) => hasPhrase(padded, ` ${term} `.trim()) || hasPhrase(normalized, term)))
    : [];

  const genres: Record<string, number> = {};
  const keywords = new Set<string>();
  let runtimeHint: "short" | "long" | null = null;
  let olderBias = false;
  senses.forEach((sense) => {
    Object.entries(sense.genres || {}).forEach(([name, weight]) => {
      const current = genres[name] || 0;
      genres[name] = Math.abs(weight) > Math.abs(current) ? weight : current;
    });
    (sense.keywords || []).forEach((keyword) => keywords.add(keyword));
    if (sense.runtimeHint && !runtimeHint) runtimeHint = sense.runtimeHint;
    if (sense.olderBias) olderBias = true;
  });

  const era = detectEra(normalized);
  return {
    input: normalized,
    senses,
    recognized: senses.map((sense) => sense.label),
    genres,
    keywords: Array.from(keywords),
    era,
    runtimeHint,
    olderBias,
    readable: senses.length > 0 || era !== null,
  };
}

const normalizeKeyword = (value: string): string => normalizeMoodText(value);

// Score one candidate's facts against a mood profile. Returns 0..1 plus the
// matched signals so the client can phrase "Matches your vibe — feel-good,
// time travel" style reasons.
export function scoreMoodMatch(
  profile: MoodProfile,
  facts: MoodCandidateFacts,
): MoodMatch {
  const senses: string[] = [];
  const matchedKeywords: string[] = [];
  let eraLabel: string | null = null;

  if (!profile.readable) {
    return { score: 0, senses, keywords: matchedKeywords, era: eraLabel };
  }

  const candidateGenres = new Set(
    (facts.genres || []).map((genre) => String(genre || "").toLowerCase()),
  );
  let genrePositive = 0;
  let genreNegative = 0;
  Object.entries(profile.genres).forEach(([name, weight]) => {
    if (!candidateGenres.has(name.toLowerCase())) return;
    if (weight >= 0) genrePositive += weight;
    else genreNegative += weight;
  });
  genrePositive = Math.min(genrePositive, 1.2);

  const candidateKeywords = (facts.keywords || []).map((keyword) => ({
    raw: String(keyword || ""),
    normalized: normalizeKeyword(String(keyword || "")),
  }));
  const profileKeywords = profile.keywords.map(normalizeKeyword).filter(Boolean);
  let keywordScore = 0;
  candidateKeywords.forEach((candidate) => {
    if (!candidate.normalized) return;
    const hit = profileKeywords.some(
      (fragment) =>
        candidate.normalized.includes(fragment) || fragment.includes(candidate.normalized),
    );
    if (hit && !matchedKeywords.includes(candidate.raw)) {
      matchedKeywords.push(candidate.raw);
      keywordScore += 0.45;
    }
  });
  keywordScore = Math.min(keywordScore, 0.9);

  let eraScore = 0;
  const year = Number(facts.year);
  if (profile.era && Number.isInteger(year) && year >= profile.era.from && year <= profile.era.to) {
    eraScore += 0.5;
    eraLabel = profile.era.label;
  }
  if (profile.olderBias && Number.isInteger(year) && year <= 2000) {
    eraScore += 0.25;
  }

  profile.senses.forEach((sense) => {
    const genreHit = Object.entries(sense.genres || {}).some(
      ([name, weight]) => weight > 0 && candidateGenres.has(name.toLowerCase()),
    );
    const keywordHit = (sense.keywords || [])
      .map(normalizeKeyword)
      .some((fragment) =>
        candidateKeywords.some(
          (candidate) =>
            candidate.normalized.includes(fragment) || fragment.includes(candidate.normalized),
        ),
      );
    if ((genreHit || keywordHit) && !senses.includes(sense.label)) {
      senses.push(sense.label);
    }
  });

  const raw = genrePositive * 0.75 + keywordScore + eraScore + genreNegative * 0.6;
  const score = Math.max(0, Math.min(1, raw / 1.6));
  return { score, senses, keywords: matchedKeywords.slice(0, 4), era: eraLabel };
}
