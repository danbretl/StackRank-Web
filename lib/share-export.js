// Share text/data export builders — the section model behind the Markdown / Text
// / JSON exports, plus the two text serializers.
//
// Pure: state-coupled inputs (queue lists + runtime displays, pack summary /
// featured) arrive via `ctx`; the app gathers them and calls in. This is the
// surface where the "omit empty sections" rule and the packs block live, both
// regression-prone, so it's worth pinning down.

import { decadeLabel, rankedCountLabel, formatShortDate } from "./format.js?v=1";
import { sharePackCardStatus } from "./packs.js?v=5";

// Top / bottom pick groups from a ranking (≤5 each, non-overlapping).
export function getSharePickGroups(insights) {
  const movies = insights.enrichedRanking || [];
  const bestCount = Math.min(5, Math.ceil(movies.length / 2));
  const worstCount = Math.min(5, Math.floor(movies.length / 2));
  return {
    best: movies.slice(0, bestCount),
    worst: worstCount ? movies.slice(movies.length - worstCount) : [],
    worstStartRank: worstCount ? movies.length - worstCount + 1 : 0,
  };
}

export function movieExportLine(movie, rank = null) {
  const year = movie.year ? ` (${movie.year})` : "";
  return `${rank ? `${rank}. ` : ""}${movie.title}${year}`;
}

export function buildNativeImageShareData(files) {
  return { files };
}

// Most-recently-added queue items first. Queue moves stamp savedAt/hiddenAt and
// push to the end, so array order remains the fallback for legacy entries.
export function recentQueueItems(list, timestampKey, count) {
  return [...(Array.isArray(list) ? list : [])]
    .map((movie, index) => ({ movie, index }))
    .sort(
      (a, b) =>
        (Number(b.movie?.[timestampKey] || 0) - Number(a.movie?.[timestampKey] || 0)) ||
        (b.index - a.index),
    )
    .slice(0, Math.max(0, Number(count) || 0))
    .map((entry) => entry.movie);
}

// The three "meta" cards above the full list — date provenance when per-movie
// rank dates are tracked, else a coarser fallback.
export function shareRankingMetaCards(insights) {
  if (insights.perMovieRankDatesTracked) {
    return [
      { label: "First movie ranked on", value: insights.firstRankedAt ? formatShortDate(insights.firstRankedAt) : "Not tracked" },
      { label: "Most recent movie ranked", value: insights.lastRankedAt ? formatShortDate(insights.lastRankedAt) : "Not tracked" },
      { label: "Most ranked in one day", value: insights.busiestDay ? rankedCountLabel(insights.busiestDay.count) : "Not tracked" },
    ];
  }
  return [
    { label: "List last updated", value: insights.rankingUpdatedAt ? formatShortDate(insights.rankingUpdatedAt) : "Not tracked" },
    { label: "Per-movie rank dates", value: "Not tracked" },
    { label: "Most ranked in one day", value: "Not tracked" },
  ];
}

// Builds the ordered section list. `ctx` carries the state-coupled inputs:
//   { tone, watchList, notInterestedList, watchRuntimeDisplay,
//     hiddenRuntimeDisplay, hiddenRuntimeLabel, packSummary, packFeatured }
// Sections self-omit when their toggle is off OR they have no content — that
// omission is the rule the empty-section feature relies on.
export function buildShareExportSections(insights, options, ctx) {
  const { tone } = ctx;
  const picks = getSharePickGroups(insights);
  const sections = [];

  if (options.top && picks.best.length) {
    sections.push({
      key: "top",
      title: tone.topTitle,
      subtitle: tone.topSub,
      lines: picks.best.map((movie, index) => movieExportLine(movie, index + 1)),
    });
  }

  if (options.bottom && picks.worst.length) {
    sections.push({
      key: "bottom",
      title: tone.bottomTitle,
      subtitle: tone.bottomSub,
      lines: picks.worst.map((movie, index) => movieExportLine(movie, picks.worstStartRank + index)),
    });
  }

  if (options.eras && insights.decades.length) {
    const topDecade = insights.topDecade ? decadeLabel(insights.topDecade.decade) : "Unknown";
    const oldest = insights.oldest ? `${insights.oldest.year} - ${insights.oldest.movie.title}` : "Unknown";
    const newest = insights.newest ? `${insights.newest.year} - ${insights.newest.movie.title}` : "Unknown";
    const decadeRows = insights.decades.slice(0, 6).sort((a, b) => b.decade - a.decade);
    sections.push({
      key: "eras",
      title: tone.erasTitle,
      subtitle: "Release years across your ranking",
      lines: [
        `Highest ranked decade: ${topDecade}`,
        `Average release year: ${insights.averageYear ? String(insights.averageYear) : "Unknown"}`,
        `Oldest ranked movie: ${oldest}`,
        `Newest ranked movie: ${newest}`,
        "",
        "Ranked movies by decade:",
        ...decadeRows.map((item) => `${decadeLabel(item.decade)}: ${rankedCountLabel(item.count)}`),
      ],
    });
  }

  if (options.genres && insights.genres.length) {
    const bottomPull =
      insights.bottomGenres.find((item) => item.name !== insights.genres[0].name) || insights.bottomGenres[0];
    const lines = [
      `Highest ranked genre: ${insights.genres[0].name} (${rankedCountLabel(insights.genres[0].count)})`,
      `Lowest ranked genre: ${bottomPull?.name || "Unknown"}${bottomPull ? ` (${rankedCountLabel(bottomPull.count)})` : ""}`,
      "",
      "Ranked movies by genre:",
      ...insights.genres.slice(0, 6).map((item) => `${item.name}: ${rankedCountLabel(item.count)}`),
    ];
    sections.push({ key: "genres", title: tone.genresTitle, subtitle: "Genres that rise to the top", lines });
  }

  if (options.people && (insights.directors.length || insights.cast.length)) {
    const lines = [
      `Highest ranked director: ${insights.directors[0]?.name || "Unknown"}${
        insights.directors[0] ? ` (${rankedCountLabel(insights.directors[0].count)})` : ""
      }`,
      `Highest ranked cast member: ${insights.cast[0]?.name || "Unknown"}${
        insights.cast[0] ? ` (${rankedCountLabel(insights.cast[0].count)})` : ""
      }`,
      "",
      "Directors by ranked appearances:",
      ...insights.directors.slice(0, 8).map((item) => `${item.name}: ${rankedCountLabel(item.count)}`),
      "",
      "Cast by ranked appearances:",
      ...insights.cast.slice(0, 8).map((item) => `${item.name}: ${rankedCountLabel(item.count)}`),
    ];
    sections.push({ key: "people", title: tone.peopleTitle, subtitle: "Directors and cast that rise to the top", lines });
  }

  if (options.queues && (ctx.watchList.length || ctx.notInterestedList.length)) {
    const watchTitles = ctx.watchList.slice(0, 3).map((movie) => movie.title).join(" / ") || "Nothing saved";
    const hiddenTitles = ctx.notInterestedList.slice(0, 3).map((movie) => movie.title).join(" / ") || "Nothing hidden";
    sections.push({
      key: "queues",
      title: tone.queuesTitle,
      subtitle: "Movies outside the ranked stack",
      lines: [
        `Saved for later: ${ctx.watchList.length}`,
        `Pending watch time: ${ctx.watchRuntimeDisplay.value}`,
        watchTitles,
        `Hidden from view: ${ctx.notInterestedList.length}`,
        `${ctx.hiddenRuntimeLabel}: ${ctx.hiddenRuntimeDisplay.value}`,
        hiddenTitles,
      ],
    });
  }

  if (options.packs && ctx.packSummary && ctx.packSummary.engaged) {
    const summary = ctx.packSummary;
    const featured = ctx.packFeatured || [];
    const lines = [
      `Packs completed: ${summary.completed}`,
      `Packs in progress: ${summary.inProgress}`,
      `Pack movies ranked: ${summary.rankedCount}`,
    ];
    if (summary.topCategory) lines.push(`Most explored category: ${summary.topCategory}`);
    if (featured.length) {
      lines.push("", "Packs you're working through:");
      featured.forEach(({ pack, stats }) => {
        lines.push(`${pack.title} - ${sharePackCardStatus(stats)}`);
      });
    }
    sections.push({ key: "packs", title: tone.packsTitle, subtitle: "Curated sets you're working through", lines });
  }

  if (options.fullList && insights.enrichedRanking.length) {
    const metaCards = shareRankingMetaCards(insights);
    sections.push({
      key: "fullList",
      title: tone.listTitle,
      subtitle: "Every movie, top to bottom",
      lines: [
        ...metaCards.map((item) => `${item.label}: ${item.value}`),
        "",
        ...insights.enrichedRanking.map((movie, index) => movieExportLine(movie, index + 1)),
      ],
    });
  }

  return sections;
}

// Serializers. `generated` is a pre-formatted date string (kept out of here so
// these stay deterministic and testable).
export function sectionsToMarkdown(title, generated, sections) {
  return [
    `# ${title}`,
    "",
    `Generated ${generated}`,
    ...sections.flatMap((section) => [
      "",
      `## ${section.title}`,
      ...(section.subtitle ? [`_${section.subtitle}_`, ""] : []),
      ...section.lines,
    ]),
  ].join("\n");
}

export function sectionsToText(title, generated, sections) {
  return [
    title,
    `Generated ${generated}`,
    ...sections.flatMap((section) => [
      "",
      section.title,
      ...(section.subtitle ? [section.subtitle] : []),
      ...section.lines,
    ]),
  ].join("\n");
}
