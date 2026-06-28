const normalizedQuery = (value) => String(value || "").trim().toLocaleLowerCase();

export const filterFullscreenRanking = (ranking, query = "") => {
  const needle = normalizedQuery(query);
  return ranking
    .map((movie, index) => ({ movie, index }))
    .filter(({ movie }) => {
      if (!needle) return true;
      return `${movie?.title || ""} ${movie?.year || ""}`.toLocaleLowerCase().includes(needle);
    });
};

export const gridNavigationTarget = ({
  currentIndex,
  key,
  columnCount,
  itemCount,
}) => {
  if (!Number.isInteger(currentIndex) || itemCount <= 0) return -1;
  const lastIndex = itemCount - 1;
  const columns = Math.max(1, Number(columnCount) || 1);
  if (key === "Home") return 0;
  if (key === "End") return lastIndex;
  if (key === "ArrowLeft") return Math.max(0, currentIndex - 1);
  if (key === "ArrowRight") return Math.min(lastIndex, currentIndex + 1);
  if (key === "ArrowUp") return Math.max(0, currentIndex - columns);
  if (key === "ArrowDown") return Math.min(lastIndex, currentIndex + columns);
  return currentIndex;
};

export const moveRankingItem = (items, fromIndex, toIndex) => {
  const copy = Array.isArray(items) ? [...items] : [];
  if (
    !Number.isInteger(fromIndex) ||
    fromIndex < 0 ||
    fromIndex >= copy.length ||
    !Number.isFinite(toIndex)
  ) {
    return copy;
  }
  const [moved] = copy.splice(fromIndex, 1);
  const destination = Math.max(0, Math.min(copy.length, Math.round(toIndex)));
  copy.splice(destination, 0, moved);
  return copy;
};

export const gridDropIndex = (rects, pointerX, pointerY) => {
  if (!Array.isArray(rects) || rects.length === 0) return 0;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  rects.forEach((rect, index) => {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const normalizedX = (pointerX - centerX) / Math.max(1, rect.width);
    const normalizedY = (pointerY - centerY) / Math.max(1, rect.height);
    const distance = normalizedX ** 2 + normalizedY ** 2;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  const nearest = rects[nearestIndex];
  const withinRow = pointerY >= nearest.top && pointerY <= nearest.top + nearest.height;
  const after = withinRow
    ? pointerX >= nearest.left + nearest.width / 2
    : pointerY >= nearest.top + nearest.height / 2;
  return nearestIndex + (after ? 1 : 0);
};
