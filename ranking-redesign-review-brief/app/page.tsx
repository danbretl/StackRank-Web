"use client";

import { useState } from "react";

type DeviceKey =
  | "desktop"
  | "ipad-landscape"
  | "ipad-portrait"
  | "iphone-portrait"
  | "iphone-landscape";

type Capture = "rank" | "ranking" | "options" | "posters" | "compact" | "you";

const devices: Record<DeviceKey, { label: string; short: string; viewport: string }> = {
  desktop: { label: "Desktop", short: "Desktop", viewport: "1440 × 900" },
  "ipad-landscape": { label: "iPad landscape", short: "iPad · L", viewport: "1024 × 768 @2×" },
  "ipad-portrait": { label: "iPad portrait", short: "iPad · P", viewport: "820 × 1180 @2×" },
  "iphone-portrait": { label: "iPhone portrait", short: "iPhone · P", viewport: "390 × 844 @3×" },
  "iphone-landscape": { label: "iPhone landscape", short: "iPhone · L", viewport: "844 × 390 @3×" },
};

const capturePath = (device: DeviceKey, capture: Capture) =>
  `/screens/${device}-${capture}.png`;

function Screenshot({
  device,
  capture,
  alt,
  crop,
}: {
  device: DeviceKey;
  capture: Capture;
  alt: string;
  crop?: "top" | "middle" | "controls";
}) {
  return (
    <figure className={`capture ${crop ? `capture--${crop}` : ""}`} data-device={device}>
      <img src={capturePath(device, capture)} alt={alt} />
    </figure>
  );
}

const decisionItems = [
  ["Rank", "The action loop", "Find something relevant, rank it, feel the progress, and continue."],
  ["Ranking", "The list itself", "View, share, inspect, filter, and deliberately change the order."],
  ["You", "Value returned", "Use the taste, progress, and saved intent created by ranking."],
];

export default function Home() {
  const [device, setDevice] = useState<DeviceKey>("desktop");
  const selected = devices[device];

  return (
    <main>
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="StackRank implementation review home">
          STACKRANK <span>IMPLEMENTATION REVIEW</span>
        </a>
        <nav aria-label="Review sections">
          <a href="#rank">Rank</a>
          <a href="#ranking">Ranking</a>
          <a href="#order">Order changes</a>
          <a href="#you">You</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">Implemented · ready for review</div>
        <h1>Rank. Ranking. You.</h1>
        <p className="hero-copy">
          The approved redesign is now in the app. This is a guided inspection of real responsive
          captures—not concept art—so the remaining conversation can be about what is actually on screen.
        </p>
        <div className="commit-line">
          <span>Build</span> 5dd8a08 <i /> <span>Verification</span> 234 Node · 21 Deno · 29 E2E
        </div>
        <div className="principles">
          {decisionItems.map(([title, subtitle, body]) => (
            <article key={title}>
              <span>{title}</span>
              <h2>{subtitle}</h2>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="device-bar" aria-label="Platform preview selector">
        <div>
          <span className="device-label">Inspect platform</span>
          <div className="device-tabs" role="group" aria-label="Choose a responsive platform">
            {(Object.keys(devices) as DeviceKey[]).map((key) => (
              <button
                type="button"
                key={key}
                className={key === device ? "is-active" : ""}
                aria-pressed={key === device}
                onClick={() => setDevice(key)}
              >
                <span className="wide-label">{devices[key].label}</span>
                <span className="short-label">{devices[key].short}</span>
              </button>
            ))}
          </div>
        </div>
        <p><strong>{selected.label}</strong><span>{selected.viewport}</span></p>
      </section>

      <section className="review-section" id="rank">
        <div className="section-heading">
          <div><span className="number">01</span><p className="kicker">The ranking loop</p></div>
          <h2>Rank owns discovery and action.</h2>
          <p>Everything on this destination should create another relevant ranking decision without losing orientation.</p>
        </div>
        <div className="hero-capture">
          <Screenshot device={device} capture="rank" alt={`Rank destination on ${selected.label}`} />
          <div className="capture-label"><span>Live implementation</span>{selected.label}</div>
        </div>
        <div className="annotation-grid">
          <article><span>1</span><h3>Search is the primary action</h3><p>A 72px desktop field establishes hierarchy. On any destination, <kbd>/</kbd> returns here and focuses it.</p></article>
          <article><span>2</span><h3>Recently ranked orients</h3><p>A compact rail acknowledges the activity without turning the destination into list management.</p></article>
          <article><span>3</span><h3>Packs become one target</h3><p>The whole card opens the pack. Segmented progress makes momentum readable without filling the card with controls.</p></article>
          <article><span>4</span><h3>Suggestions read as lanes</h3><p>Ruled editorial rows keep the page dense and scannable while each movie retains an immediate Rank action.</p></article>
        </div>
        <div className="zoom-row">
          <div><p>Search + recent activity</p><Screenshot device={device} capture="rank" alt="Rank search and recently ranked detail" crop="top" /></div>
          <div><p>Pack shelf + suggestion lanes</p><Screenshot device={device} capture="rank" alt="Rank packs and suggestions detail" crop="middle" /></div>
        </div>
      </section>

      <section className="review-section review-section--dark" id="ranking">
        <div className="section-heading">
          <div><span className="number">02</span><p className="kicker">The list artifact</p></div>
          <h2>Ranking is the full experience.</h2>
          <p>There is no separate fullscreen mode. The native page combines the strengths of the former list and poster experiences.</p>
        </div>
        <div className="split-captures">
          <div>
            <div className="capture-label"><span>Detailed · default</span>{selected.label}</div>
            <Screenshot device={device} capture="ranking" alt={`Detailed ranking on ${selected.label}`} />
          </div>
          <div>
            <div className="capture-label"><span>Display & filters</span>One combined panel</div>
            <Screenshot device={device} capture="options" alt={`Ranking display and filters on ${selected.label}`} />
          </div>
        </div>
        <div className="control-priorities">
          <span>Active view</span><b>Display & filters</b><b className="touch-priority">Move <em>touch</em></b><b>Share</b><span>Review order</span>
        </div>
        <div className="view-grid">
          <article>
            <Screenshot device={device} capture="ranking" alt={`Detailed ranking view on ${selected.label}`} crop="middle" />
            <span>01 · Detailed</span><h3>Context-rich rows</h3><p>Closest to the previous main Ranking page. Best for inspection and management.</p>
          </article>
          <article>
            <Screenshot device={device} capture="posters" alt={`Poster ranking view on ${selected.label}`} crop="middle" />
            <span>02 · Posters</span><h3>The list in all its glory</h3><p>A visual grid carrying forward what worked best about fullscreen.</p>
          </article>
          <article>
            <Screenshot device={device} capture="compact" alt={`Compact ranking view on ${selected.label}`} crop="middle" />
            <span>03 · Compact</span><h3>Maximum scan density</h3><p>Rank, title, and year for fast traversal of a long list.</p>
          </article>
        </div>
      </section>

      <section className="review-section" id="order">
        <div className="section-heading">
          <div><span className="number">03</span><p className="kicker">Density must not hide how order changes</p></div>
          <h2>Reordering stays explicit in every modality.</h2>
          <p>The UI gets denser, but the interaction contract remains visible and predictable.</p>
        </div>
        <div className="order-grid">
          <article><span className="mode">Mouse</span><h3>Drag anywhere</h3><p>Rows and posters remain direct manipulation targets with a fine pointer.</p><small>Fastest path for desktop</small></article>
          <article><span className="mode">Keyboard</span><h3>Focus Move, then arrows</h3><p>Move handles preserve explicit focus and live rank announcements.</p><small>Arrow Up / Down</small></article>
          <article><span className="mode">Touch</span><h3>Enter Move mode</h3><p>A high-priority header control exposes handles; dragging remains handle-only.</p><small>Prevents accidental moves</small></article>
          <article><span className="mode">Filtered</span><h3>Reordering pauses</h3><p>Changing a partial view cannot silently change the canonical list order.</p><small>Clear filters to move</small></article>
        </div>
        <div className="order-proof">
          <div>
            <p className="mini-title">The presentation control</p>
            <Screenshot device={device} capture="options" alt={`Display and filter controls on ${selected.label}`} crop="controls" />
          </div>
          <div className="decision-note">
            <p className="mini-title">Deliberately removed</p>
            <h3>No Jump to #</h3>
            <p>It assumed a user knew a rank before seeing the list. Search and filtering are more natural paths to a known movie.</p>
            <hr />
            <h3>No fullscreen fork</h3>
            <p>The three native views keep one mental model, one set of controls, and one canonical destination.</p>
          </div>
        </div>
      </section>

      <section className="review-section review-section--accent" id="you">
        <div className="section-heading">
          <div><span className="number">04</span><p className="kicker">A green-field third destination</p></div>
          <h2>You returns the value ranking creates.</h2>
          <p>V1 is a fixed, widget-based dashboard. It can become adaptive later without making “Tonight” the permanent hero.</p>
        </div>
        <div className="you-layout">
          <div className="hero-capture">
            <Screenshot device={device} capture="you" alt={`You dashboard on ${selected.label}`} />
            <div className="capture-label"><span>V1 dashboard</span>{selected.label}</div>
          </div>
          <div className="widget-list">
            <article><span>01</span><h3>Your progress</h3><p>A light stats payoff and a natural home for future milestones.</p></article>
            <article><span>02</span><h3>Tonight</h3><p>A useful widget near the top—not a permanent definition of the tab.</p></article>
            <article><span>03</span><h3>Taste Explorer</h3><p>The clearest expression of insight generated by a ranked list.</p></article>
            <article><span>04</span><h3>Watch next</h3><p>The saved-intent queue gets equal utility without elevating hidden movies.</p></article>
            <article className="secondary-widget"><span>Quiet</span><h3>Hidden movies</h3><p>Available as secondary management, not a dashboard peer.</p></article>
          </div>
        </div>
        <p className="empty-state-note"><strong>Critical mass is allowed.</strong> Empty states can explain the payoff and point back to Rank instead of forcing every widget to appear useful too early.</p>
      </section>

      <section className="review-section checklist" id="checklist">
        <div className="section-heading">
          <div><span className="number">05</span><p className="kicker">What I would review first</p></div>
          <h2>Five judgment calls now visible in context.</h2>
        </div>
        <ol>
          <li><span>01</span><div><h3>Does Rank create the intended loop?</h3><p>Search prominence, recent orientation, packs, and suggestion density.</p></div></li>
          <li><span>02</span><div><h3>Does “You” feel like the right destination name?</h3><p>The product structure is now concrete enough to judge the label honestly.</p></div></li>
          <li><span>03</span><div><h3>Are the three view labels and header priorities intuitive?</h3><p>Detailed / Posters / Compact; Display & filters / Move / Share / Review order.</p></div></li>
          <li><span>04</span><div><h3>Is Review order quiet enough?</h3><p>Present when useful, but not pretending to be an everyday primary action.</p></div></li>
          <li><span>05</span><div><h3>Is the You widget order a credible V1?</h3><p>Especially progress stats, Tonight’s prominence, and Watch next.</p></div></li>
        </ol>
        <aside>
          <span>Intentionally deferred</span>
          <p>Shared search · user-customizable widgets · Recently ranked duplication · navigation experiments beyond “You” · further gamification · any return of fullscreen or Jump to #</p>
        </aside>
      </section>

      <footer>
        <strong>STACKRANK</strong>
        <p>Rank Bar density follow-up · implementation review · July 2026</p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
