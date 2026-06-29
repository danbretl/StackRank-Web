import { movieYear } from "./movie.js";

export const TASTE_EXPLORER_MIN_MOVIES = 5;

const recurring = (items = []) => items.find((item) => Number(item?.count) >= 2) || null;

const tasteSignal = ({ type, value, eyebrow, description, count, subject = type }) => ({
  id: `${type}:${value}`,
  type,
  value,
  eyebrow,
  description,
  count,
  subject,
});

export function buildTasteSignals(insights = {}) {
  const signals = [];
  const genre = recurring(insights.genres);
  if (genre) {
    signals.push(
      tasteSignal({
        type: "genre",
        value: genre.name,
        eyebrow: "Genre pull",
        description: `${genre.count} movies · strongest near the top`,
        count: genre.count,
      }),
    );
  }

  const recurringDecade =
    (insights.decades || []).find((item) => Number(item?.count) >= 2) ||
    (Number(insights.topDecade?.count) >= 2 ? insights.topDecade : null);
  const decade = Number(recurringDecade?.decade);
  const decadeCount = Number(recurringDecade?.count) || 0;
  if (Number.isInteger(decade) && decadeCount >= 2) {
    signals.push(
      tasteSignal({
        type: "decade",
        value: `${decade}s`,
        eyebrow: "Era pull",
        description: `${decadeCount} movies · strongest recurring era`,
        count: decadeCount,
      }),
    );
  }

  const director = recurring(insights.directors);
  const cast = recurring(insights.cast);
  const person =
    !director
      ? cast
      : !cast
        ? director
        : director.score >= cast.score
          ? director
          : cast;
  if (person) {
    const isDirector = person === director;
    signals.push(
      tasteSignal({
        type: isDirector ? "director" : "cast",
        value: person.name,
        eyebrow: "Repeat collaborator",
        description: `${person.count} movies · highest-ranked ${isDirector ? "director" : "cast member"}`,
        count: person.count,
        subject: isDirector ? "director" : "cast member",
      }),
    );
  }

  return signals;
}

const normalized = (value) => String(value || "").trim().toLocaleLowerCase();

export function movieMatchesTasteSignal(movie, signal) {
  if (!movie || !signal) return false;
  const target = normalized(signal.value);
  if (signal.type === "decade") {
    const year = movieYear(movie);
    return Boolean(year) && `${Math.floor(year / 10) * 10}s` === signal.value;
  }
  if (signal.type === "genre") {
    return (movie.genres || []).some((genre) => normalized(genre) === target);
  }
  if (signal.type === "director") {
    return normalized(movie.director) === target;
  }
  if (signal.type === "cast") {
    return (movie.cast || []).some((name) => normalized(name) === target);
  }
  return false;
}

export function tasteSignalEntries(ranking = [], signal) {
  return ranking
    .map((movie, index) => ({ movie, index }))
    .filter(({ movie }) => movieMatchesTasteSignal(movie, signal));
}

export function tasteSignalPackQuery(signal) {
  return signal?.value || "";
}

const normalizedSearchText = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();

export function tasteMatchingPacks(packs = [], signal) {
  const terms = normalizedSearchText(tasteSignalPackQuery(signal)).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return packs.filter((pack) => {
    const metadata = normalizedSearchText([pack.title, pack.subtitle, pack.category].join(" "));
    return terms.every((term) => metadata.includes(term));
  });
}
