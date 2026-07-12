"use client";

import { useEffect, useMemo, useState } from "react";

type Direction = {
  id: number;
  title: string;
  shortTitle: string;
  image: string;
  score: number;
  tags: string[];
  idea: string;
  strength: string;
  watchout: string;
  verdict: string;
};

const directions: Direction[] = [
  {
    id: 1,
    title: "Binary Stair",
    shortTitle: "Binary Stair",
    image: "/boards/01-binary-stair.webp",
    score: 7.4,
    tags: ["comparison-first"],
    idea:
      "Two opposing choice tiles resolve into a three-step stack, with an abstract S emerging between them.",
    strength:
      "It makes compare, order, and movement legible in one compact silhouette, and the category tabs are immediately understandable.",
    watchout:
      "The angular forms can read as logistics or directional arrows, and the descending half risks implying a drop rather than a rank.",
    verdict: "Clear mechanics; less ownable as a culture brand.",
  },
  {
    id: 2,
    title: "The Pivot",
    shortTitle: "The Pivot",
    image: "/boards/02-the-pivot.webp",
    score: 6.2,
    tags: ["comparison-first"],
    idea:
      "An S and R share a central decision diamond, turning the product name into a monogram around a choice point.",
    strength:
      "It is unmistakably tied to the initials and creates a visible place for category-specific accents.",
    watchout:
      "The construction is too intricate at small sizes and leans toward fintech, sports, or esports rather than personal taste.",
    verdict: "Clever monogram; wrong emotional register.",
  },
  {
    id: 3,
    title: "Rank Fold",
    shortTitle: "Rank Fold",
    image: "/boards/03-rank-fold.webp",
    score: 9.2,
    tags: ["shortlist", "collection-first"],
    idea:
      "One folded ribbon becomes three stacked layers; a small notch marks the place where a new item enters the order.",
    strength:
      "It balances product truth, category neutrality, small-size clarity, and an ownable S-shaped silhouette better than any other direction.",
    watchout:
      "The next round must keep it from collapsing into a generic menu or database icon and sharpen the insertion detail.",
    verdict: "Best foundation for the master brand.",
  },
  {
    id: 4,
    title: "Insertion Cursor",
    shortTitle: "Insertion Cursor",
    image: "/boards/04-insertion-cursor.webp",
    score: 8.4,
    tags: ["comparison-first"],
    idea:
      "A bracketed list holds a diamond at its insertion point, translating binary insertion into one diagrammatic mark.",
    strength:
      "This is the most literal explanation of what StackRank actually does and would animate beautifully during ranking.",
    watchout:
      "It behaves more like a UI glyph than a brand mark, and the four brackets plus lines lose confidence below 24px.",
    verdict: "Excellent product iconography; secondary-brand potential.",
  },
  {
    id: 5,
    title: "Pick / Place",
    shortTitle: "Pick / Place",
    image: "/boards/05-pick-place.webp",
    score: 8.8,
    tags: ["shortlist", "comparison-first"],
    idea:
      "Two offset cards meet at one registration point, then can pivot and settle into a vertical stack.",
    strength:
      "It is the most memorable consumer-app icon in the set and gives the brand a natural compare-and-settle motion language.",
    watchout:
      "The ranking story depends on motion; static, it can read as swapping, matching, or simply two generic cards.",
    verdict: "Strongest expressive and motion direction.",
  },
  {
    id: 6,
    title: "Versus Gate",
    shortTitle: "Versus Gate",
    image: "/boards/06-versus-gate.webp",
    score: 6.8,
    tags: ["comparison-first"],
    idea:
      "Two opposing bracket forms create a gate around three ordered lines: comparison in, ranked result out.",
    strength:
      "The head-to-head mechanic is prominent and the icon remains recognizable across many sizes.",
    watchout:
      "The stance is combative and angular, pulling the product toward debate, code, or esports instead of reflective preference.",
    verdict: "Mechanically sound; emotionally too aggressive.",
  },
  {
    id: 7,
    title: "The Index",
    shortTitle: "The Index",
    image: "/boards/07-the-index.webp",
    score: 7.8,
    tags: ["collection-first"],
    idea:
      "Three slim index tabs form an ordered personal collection, crossed by the rule that identifies a rank.",
    strength:
      "It is calm, category-agnostic, and naturally supports a shelf-like family across movies, books, and games.",
    watchout:
      "It can be mistaken for a bar chart, office archive, or building, and says less about comparison than the top concepts.",
    verdict: "A durable system with a quieter product story.",
  },
  {
    id: 8,
    title: "Open Slot",
    shortTitle: "Open Slot",
    image: "/boards/08-open-slot.webp",
    score: 9.0,
    tags: ["shortlist", "collection-first"],
    idea:
      "A diamond enters an S-shaped opening inside four horizontal bands, making exact placement the center of the mark.",
    strength:
      "It expresses binary insertion more precisely than the other compact app icons and creates a satisfying motion sequence.",
    watchout:
      "The detached diamond can become visual debris, and the stacked bands risk a database or menu reading at small sizes.",
    verdict: "Best direct product metaphor; close second overall.",
  },
  {
    id: 9,
    title: "The Rank Cut",
    shortTitle: "The Rank Cut",
    image: "/boards/09-the-rank-cut.webp",
    score: 8.2,
    tags: ["type-led"],
    idea:
      "A diagonal decision cut passes through the S and R, carrying three small rank rules into a distinctive wordmark.",
    strength:
      "It treats the name as the brand, feels editorial rather than app-generic, and offers the strongest typographic system.",
    watchout:
      "It requires real custom-lettering craft, while the extracted icon is less immediate and less warm than the leading marks.",
    verdict: "The right typographic influence, not the whole answer.",
  },
  {
    id: 10,
    title: "Taste Loop",
    shortTitle: "Taste Loop",
    image: "/boards/10-taste-loop.webp",
    score: 7.1,
    tags: ["comparison-first"],
    idea:
      "Two preference paths loop through a choice and resolve into three parallel ranked endpoints.",
    strength:
      "It is the friendliest direction, suggests discovery, and could become a lively animation throughout the product.",
    watchout:
      "The mark resembles a network, service workflow, or cable symbol and does not communicate ordered preference quickly enough.",
    verdict: "Friendly motion language; weak hierarchy signal.",
  },
];

const rankedDirections = [...directions].sort((a, b) => b.score - a.score);
const finalRankById = new Map(
  rankedDirections.map((direction, index) => [direction.id, index + 1]),
);

const filters = [
  { id: "all", label: "All 10" },
  { id: "shortlist", label: "Shortlist 3" },
  { id: "comparison-first", label: "Comparison-first" },
  { id: "collection-first", label: "Collection-first" },
  { id: "type-led", label: "Type-led" },
];

const criteria = [
  {
    number: "01",
    title: "Product truth",
    copy: "Does the mark imply comparing, inserting, and arriving at an exact order?",
  },
  {
    number: "02",
    title: "Category range",
    copy: "Can it move from Movies to Books or Board Games without changing its core idea?",
  },
  {
    number: "03",
    title: "Small-size strength",
    copy: "Does it remain distinct in navigation, a favicon, and an app tile?",
  },
  {
    number: "04",
    title: "Ownability",
    copy: "Can the silhouette and wordmark become recognizably StackRank over time?",
  },
  {
    number: "05",
    title: "Expression",
    copy: "Does it support motion, sharing, and a consumer brand with real personality?",
  },
];

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="arrow-icon">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="close-icon">
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

function DirectionEntry({
  direction,
  onOpen,
}: {
  direction: Direction;
  onOpen: (direction: Direction) => void;
}) {
  return (
    <article className="direction-entry" id={`direction-${direction.id}`}>
      <button
        className="board-frame"
        type="button"
        onClick={() => onOpen(direction)}
        aria-label={`View the full ${direction.title} presentation board`}
      >
        <img src={direction.image} alt={`${direction.title} logo system board`} />
        <span className="board-open-label">
          View full board <ArrowIcon />
        </span>
      </button>
      <div className="direction-analysis">
        <div className="direction-heading">
          <span className="direction-number">
            {String(direction.id).padStart(2, "0")}
          </span>
          <div>
            <h3>{direction.title}</h3>
            <p>{direction.score.toFixed(1)} / 10</p>
          </div>
        </div>
        <dl>
          <div>
            <dt>Idea</dt>
            <dd>{direction.idea}</dd>
          </div>
          <div>
            <dt>Strength</dt>
            <dd>{direction.strength}</dd>
          </div>
          <div>
            <dt>Watch-out</dt>
            <dd>{direction.watchout}</dd>
          </div>
        </dl>
        <p className="direction-verdict">{direction.verdict}</p>
      </div>
    </article>
  );
}

export function IdentityBrief({ reviewerName }: { reviewerName: string }) {
  const [filter, setFilter] = useState("all");
  const [activeBoard, setActiveBoard] = useState<Direction | null>(null);

  const visibleDirections = useMemo(
    () =>
      filter === "all"
        ? directions
        : directions.filter((direction) => direction.tags.includes(filter)),
    [filter],
  );

  useEffect(() => {
    if (!activeBoard) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveBoard(null);
      if (event.key === "ArrowRight") {
        const next = directions[activeBoard.id % directions.length];
        setActiveBoard(next);
      }
      if (event.key === "ArrowLeft") {
        const previous = directions[(activeBoard.id - 2 + directions.length) % directions.length];
        setActiveBoard(previous);
      }
    };

    document.body.classList.add("is-lightbox-open");
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.classList.remove("is-lightbox-open");
      window.removeEventListener("keydown", handleKey);
    };
  }, [activeBoard]);

  const openDirection = (id: number) => {
    setFilter("all");
    requestAnimationFrame(() => {
      document
        .getElementById(`direction-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand-lockup" href="#overview">
          <strong>StackRank</strong>
          <span>/ Identity brief</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#comparison-overview">At a glance</a>
          <a href="#directions">Directions</a>
          <a href="#recommendation">Recommendation</a>
        </nav>
        <details className="reviewer-menu">
          <summary>{reviewerName}</summary>
          <a href="/signout-with-chatgpt?return_to=%2F">Sign out</a>
        </details>
      </header>

      <section className="hero" id="overview">
        <div className="hero-copy">
          <h1>Ten ways to make preference visible.</h1>
          <p className="hero-deck">
            A category-neutral identity for ranking movies now—and
            <em> almost anything</em> next.
          </p>
          <p className="hero-method">Comparison · order · collection · extension</p>
          <a className="text-link" href="#directions">
            See all directions <ArrowIcon />
          </a>
        </div>
        <div className="shortlist" aria-label="Top three directions">
          {rankedDirections.slice(0, 3).map((direction, index) => (
            <button key={direction.id} onClick={() => openDirection(direction.id)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{direction.shortTitle}</strong>
              <ArrowIcon />
            </button>
          ))}
        </div>
        <div className="spectrum" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <p className="hero-date">July 2026 · Design exploration</p>
      </section>

      <section className="brief-section" aria-labelledby="brief-title">
        <div className="section-intro">
          <h2 id="brief-title">The brief behind the marks</h2>
          <p>
            StackRank is not a movie database and not a generic list app. Its
            distinctive behavior is a sequence of small choices that produces a
            precise, personal order. The identity needs to hold that idea while
            leaving the subject matter open.
          </p>
        </div>
        <div className="criteria-list">
          {criteria.map((criterion) => (
            <article key={criterion.number}>
              <span>{criterion.number}</span>
              <h3>{criterion.title}</h3>
              <p>{criterion.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="comparison-overview"
        id="comparison-overview"
        aria-labelledby="comparison-overview-title"
      >
        <div className="comparison-overview-header">
          <div>
            <h2 id="comparison-overview-title">All ten at a glance</h2>
            <p>
              The complete exploration on one wall. Compare silhouette, density,
              wordmark character, and category behavior before opening any board.
            </p>
          </div>
          <p className="comparison-overview-key">
            Concept number · Final rank · Score
          </p>
        </div>
        <div className="comparison-wall">
          {directions.map((direction) => (
            <button
              key={direction.id}
              type="button"
              onClick={() => setActiveBoard(direction)}
              aria-label={`Open ${direction.title}, ranked ${finalRankById.get(direction.id)} overall`}
            >
              <span className="comparison-wall-image">
                <img
                  src={direction.image}
                  alt={`${direction.title} logo system overview`}
                />
              </span>
              <span className="comparison-wall-caption">
                <span>{String(direction.id).padStart(2, "0")}</span>
                <strong>{direction.title}</strong>
                <span>
                  Rank {finalRankById.get(direction.id)} · {direction.score.toFixed(1)}
                </span>
              </span>
            </button>
          ))}
        </div>
        <p className="comparison-overview-note">
          Select any board for a full-size view. Use arrow keys to move through the set.
        </p>
      </section>

      <section className="directions-section" id="directions">
        <div className="directions-header">
          <div>
            <h2>The directions</h2>
            <p>
              Ten distinct answers to the same brief. Select any direction to
              inspect the full board.
            </p>
          </div>
          <p className="direction-count">{visibleDirections.length} shown</p>
        </div>
        <div className="filter-row" role="group" aria-label="Filter logo directions">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? "is-active" : ""}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="direction-list">
          {visibleDirections.map((direction) => (
            <DirectionEntry
              key={direction.id}
              direction={direction}
              onOpen={setActiveBoard}
            />
          ))}
        </div>
      </section>

      <section className="recommendation" id="recommendation">
        <div className="recommendation-hero">
          <div>
            <p>Recommendation</p>
            <h2>Build from Rank Fold.</h2>
            <p>
              It is the clearest balance of product truth, category neutrality,
              small-size strength, and room to become a real brand.
            </p>
          </div>
          <div className="fold-motif" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="recommendation-body">
          <div className="final-ranking">
            <h3>The final ranking</h3>
            <ol>
              {rankedDirections.map((direction, index) => (
                <li key={direction.id}>
                  <button onClick={() => openDirection(direction.id)}>
                    <span>{index + 1}</span>
                    <strong>{direction.shortTitle}</strong>
                    <em>{direction.score.toFixed(1)}</em>
                    <ArrowIcon />
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="hybrid-plan">
            <article>
              <span>01</span>
              <h3>Core mark</h3>
              <p>Refine Rank Fold’s three-layer S and make the insertion notch unmistakable.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Wordmark</h3>
              <p>Borrow The Rank Cut’s typographic discipline without carrying over its severity.</p>
            </article>
            <article>
              <span>03</span>
              <h3>Motion</h3>
              <p>Use Pick / Place’s compare-and-settle behavior to make the system feel alive.</p>
            </article>
          </div>
        </div>

        <div className="next-round">
          <div>
            <h3>One more round, with fewer ideas.</h3>
            <p>
              Develop three production-ready variants of the recommended system,
              test them at 16–64px, and validate the category family before
              choosing the final mark.
            </p>
          </div>
          <a className="primary-action" href="#direction-3">
            Review Rank Fold <ArrowIcon />
          </a>
        </div>
        <div className="spectrum spectrum-bottom" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>

      <footer>
        <p>StackRank identity exploration · Private working brief</p>
        <a href="#overview">Back to top ↑</a>
      </footer>

      {activeBoard ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={`${activeBoard.title} full board`}>
          <button
            className="lightbox-backdrop"
            type="button"
            onClick={() => setActiveBoard(null)}
            aria-label="Close full board"
          />
          <div className="lightbox-panel">
            <div className="lightbox-toolbar">
              <div>
                <span>{String(activeBoard.id).padStart(2, "0")}</span>
                <strong>{activeBoard.title}</strong>
                <em>{activeBoard.score.toFixed(1)} / 10</em>
              </div>
              <button type="button" onClick={() => setActiveBoard(null)} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <img src={activeBoard.image} alt={`${activeBoard.title} logo presentation board at full size`} />
            <div className="lightbox-nav">
              <button
                type="button"
                onClick={() =>
                  setActiveBoard(
                    directions[(activeBoard.id - 2 + directions.length) % directions.length],
                  )
                }
              >
                ← Previous
              </button>
              <p>{activeBoard.verdict}</p>
              <button
                type="button"
                onClick={() => setActiveBoard(directions[activeBoard.id % directions.length])}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
