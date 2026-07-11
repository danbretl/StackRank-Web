"use client";

import { useState } from "react";

type Device = "desktop" | "ipad-landscape" | "ipad-portrait" | "iphone-portrait" | "iphone-landscape";
type DirectionId = "library" | "you" | "studio";

const devices: Array<{ id: Device; label: string; note: string }> = [
  { id: "desktop", label: "Desktop", note: "1440 × 900 · mouse" },
  { id: "ipad-landscape", label: "iPad ↔", note: "1024 × 768 · touch" },
  { id: "ipad-portrait", label: "iPad ↕", note: "820 × 1180 · touch" },
  { id: "iphone-portrait", label: "iPhone ↕", note: "390 × 844 · touch" },
  { id: "iphone-landscape", label: "iPhone ↔", note: "844 × 390 · touch" },
];

const directions = [
  {
    id: "library" as DirectionId,
    number: "01",
    title: "The living ledger",
    nav: ["Rank", "Ranking", "Library"],
    third: "Library",
    accent: "Acid",
    verdict: "Recommended",
    summary: "Keep Ranking as the unmistakable artifact. Move queues, Recently ranked, and Taste Explorer into a broader Library destination with one shared search field above every surface.",
    ownership: "Library owns personal history and discovery; Ranking stays narrowly about order.",
  },
  {
    id: "you" as DirectionId,
    number: "02",
    title: "Artifact + you",
    nav: ["Rank", "Ranking", "You"],
    third: "You",
    accent: "Coral",
    verdict: "Warmest",
    summary: "Pair the objective-looking ranked list with a deliberately personal home. You gathers taste signals, recent activity, Watch next, and Hidden into a compact dashboard.",
    ownership: "You owns Recently ranked; Rank may show only a single contextual return link.",
  },
  {
    id: "studio" as DirectionId,
    number: "03",
    title: "Ranking studio",
    nav: ["Rank", "Stack", "My space"],
    third: "My space",
    accent: "Blue",
    verdict: "Provocation",
    summary: "Treat the ordered list as an active workspace: dense rows, a selected-movie inspector, and an explicit edit mode. The bolder naming tests how far the product can generalize beyond movies.",
    ownership: "My space owns saved, hidden, recent, and taste. Stack owns only the canonical order.",
  },
];

const movies = [
  ["Parasite", "2019", "Bong Joon Ho", "scarlet"],
  ["Moonlight", "2016", "Barry Jenkins", "blue"],
  ["The Apartment", "1960", "Billy Wilder", "cream"],
  ["Spirited Away", "2001", "Hayao Miyazaki", "green"],
  ["No Country for Old Men", "2007", "Coen brothers", "orange"],
  ["Do the Right Thing", "1989", "Spike Lee", "pink"],
  ["Portrait of a Lady on Fire", "2019", "Céline Sciamma", "violet"],
];

function Brand() {
  return <div className="mock-brand"><b>STACKRANK</b><span>MOVIES</span></div>;
}

function RankingRows({ device, direction }: { device: Device; direction: DirectionId }) {
  const touch = device !== "desktop";
  const shown = device === "iphone-landscape" ? 3 : device === "iphone-portrait" ? 5 : 7;
  return (
    <div className={`ranking-rows rows--${direction}`}>
      {movies.slice(0, shown).map(([title, year, director, tone], index) => (
        <article key={title} className={index === 1 && direction === "studio" ? "is-selected" : ""}>
          <span className="rank-number">{String(index + 1).padStart(2, "0")}</span>
          <span className={`mini-poster tone-${tone}`} aria-hidden="true" />
          <span className="movie-copy"><b>{title}</b><small>{year} · {director}</small></span>
          {direction === "library" ? <span className="rank-note">{index < 2 ? "Top pick" : index === 3 ? "Moved 2↑" : ""}</span> : null}
          {direction === "you" ? <span className="rank-date">{index < 3 ? `${index + 1}d ago` : ""}</span> : null}
          <span className="row-action">{touch ? "•••" : direction === "studio" ? "Inspect" : "Info"}</span>
          <span className="move-handle" aria-label="Move">{touch ? "≡" : "⋮⋮"}</span>
        </article>
      ))}
    </div>
  );
}

function Prototype({ direction, device }: { direction: DirectionId; device: Device }) {
  const spec = directions.find((item) => item.id === direction)!;
  const phone = device.startsWith("iphone");
  return (
    <div className={`prototype prototype--${device} direction--${direction}`}>
      <header className="app-topbar">
        <Brand />
        {!phone ? <nav>{spec.nav.map((item, index) => <b key={item} className={index === 1 ? "is-active" : ""}>{item}</b>)}</nav> : null}
        <span className="gear">⚙</span>
      </header>
      <div className="global-search"><span>⌕</span><b>Search movies, ranking, and lists</b><kbd>/</kbd></div>
      <main className="ranking-shell">
        <div className="ranking-toolbar">
          <div><small>YOUR CANONICAL ORDER</small><h3>{direction === "studio" ? "My stack" : "Current ranking"} <i>37</i></h3></div>
          <div className="toolbar-actions">
            <button>Review</button>
            {!phone ? <button>{direction === "studio" ? "Density" : "Full screen"}</button> : null}
            <button className="move-button">Move</button>
            <button className="overflow-button">•••</button>
          </div>
        </div>
        <div className="ranking-workspace">
          <section>
            {direction === "you" ? <div className="ranking-pulse"><b>37 films</b><span>7 ranked this month</span><span>Last change 2h ago</span></div> : null}
            <RankingRows device={device} direction={direction} />
          </section>
          {direction === "studio" && !phone ? <aside className="inspector"><span className="large-poster tone-blue" /><small>SELECTED · #2</small><h4>Moonlight</h4><p>A tender coming-of-age drama directed by Barry Jenkins.</p><button>Open details</button><button>Re-rank</button></aside> : null}
          {direction === "library" && device === "desktop" ? <aside className="ledger-aside"><small>ORDER HEALTH</small><b>8 pairs ready to review</b><p>Audit the places most likely to have shifted as your taste evolved.</p><button>Start review →</button><small>RECENT CHANGE</small><b>Spirited Away moved to #4</b></aside> : null}
        </div>
      </main>
      {phone ? <nav className="bottom-nav">{spec.nav.map((item, index) => <b key={item} className={index === 1 ? "is-active" : ""}><i>{["↑", "▦", "●"][index]}</i><small>{item}</small></b>)}</nav> : null}
    </div>
  );
}

function PersonalSpace({ direction }: { direction: DirectionId }) {
  const spec = directions.find((item) => item.id === direction)!;
  return (
    <article className={`personal-card personal-card--${direction}`}>
      <header><Brand /><nav>{spec.nav.map((item, index) => <b key={item} className={index === 2 ? "is-active" : ""}>{item}</b>)}</nav></header>
      <div className="personal-heading"><small>{spec.third.toUpperCase()}</small><h3>{direction === "library" ? "Everything around your ranking." : direction === "you" ? "Your movie life, in one place." : "Signals, queues, and history."}</h3></div>
      <div className="personal-grid">
        <section className="taste-card"><small>TASTE EXPLORER</small><b>{direction === "library" ? "Your modern auteurs" : "Character under pressure"}</b><div><i /><i /><i /></div><span>Open ranking lens →</span></section>
        <section className="recent-card"><small>RECENTLY RANKED</small>{movies.slice(0, 3).map(([title], index) => <span key={title}><i>{index + 1}</i><b>{title}</b><em>{index + 1}d</em></span>)}</section>
        <section className="queue-card"><small>LISTS</small><span><b>Watch next</b><em>18</em></span><span><b>Hidden</b><em>42</em></span></section>
      </div>
      <p>{spec.ownership}</p>
    </article>
  );
}

export default function Home() {
  const [device, setDevice] = useState<Device>("desktop");

  return (
    <main>
      <header className="site-header"><a href="#top"><span>SR</span><b>RANKING / PERSONAL SPACE</b></a><nav><a href="#directions">Directions</a><a href="#interaction">Interaction</a><a href="#personal">Personal space</a><a href="#decision">Decision</a></nav><span>PRIVATE DESIGN BRIEF</span></header>

      <section className="hero" id="top">
        <div><p className="eyebrow">STACKRANK · RESPONSIVE SYSTEM EXPLORATION · JULY 2026</p><h1>The list is the<br /><i>artifact.</i></h1><p className="lede">Ranking needs to feel denser and more capable without becoming an admin table. This brief tests where search, count, actions, editing, history, taste, and queues should live across five real device conditions.</p></div>
        <aside><div className="hero-stack"><span>01</span><b>ORDER</b><i>37</i><span>02</span><b>HISTORY</b><i>7</i><span>03</span><b>TASTE</b><i>3</i></div><p>One stable row contract.<br />Three destination models.<br />Five responsive canvases.</p></aside>
      </section>

      <section className="guardrails"><b>EXPLORATION, NOT IMPLEMENTATION</b><span>Shared search is conceptual</span><span>Navigation names are proposals</span><span>Recently and Taste remain shipped until approval</span></section>

      <section className="section directions" id="directions">
        <div className="section-heading"><div><p className="eyebrow">01 / THREE COHERENT SYSTEMS</p><h2>Choose the ownership model,<br />then tune the density.</h2></div><p>Each direction holds movie order and interaction semantics steady. What changes is information hierarchy: the third destination, secondary modules, and how much workspace chrome Ranking earns.</p></div>
        <div className="device-picker" role="group" aria-label="Preview device">{devices.map((item) => <button key={item.id} onClick={() => setDevice(item.id)} className={device === item.id ? "is-active" : ""} aria-pressed={device === item.id}><b>{item.label}</b><small>{item.note}</small></button>)}</div>
        {directions.map((direction) => <article className={`direction-card direction-card--${direction.id}`} key={direction.id}><div className="direction-copy"><span>OPTION {direction.number}</span><h3>{direction.title}</h3><p>{direction.summary}</p><dl><div><dt>Navigation</dt><dd>{direction.nav.join(" / ")}</dd></div><div><dt>Third destination</dt><dd>{direction.third}</dd></div><div><dt>Visual cue</dt><dd>{direction.accent}</dd></div></dl><b className="verdict">{direction.verdict}</b></div><Prototype direction={direction.id} device={device} /></article>)}
      </section>

      <section className="section interaction" id="interaction">
        <div className="section-heading"><div><p className="eyebrow">02 / ONE ROW, THREE INPUT CONTRACTS</p><h2>Density must not hide<br />how order changes.</h2></div><p>The visual row stays stable. Only the affordance and mode change with input capability, so an iPad does not inherit mouse assumptions and a desktop does not pay for permanent touch chrome.</p></div>
        <div className="matrix"><div className="matrix-head"><b>INPUT</b><b>ENTRY</b><b>MOVE</b><b>SECONDARY ACTIONS</b><b>COMMIT / ESCAPE</b></div><div><b>Mouse</b><span>Hover row or handle</span><span>Drag anywhere; handle clarifies</span><span>Overflow remains quiet</span><span>Drop / Escape cancels</span></div><div><b>Keyboard</b><span>Focus Move handle</span><span>Arrow Up / Down</span><span>Tab to overflow</span><span>Live rank announcement</span></div><div><b>Touch / pen</b><span>Tap Move in header</span><span>Explicit handles appear</span><span>Row tap still opens detail</span><span>Done / interruption cancels</span></div></div>
        <div className="row-anatomy"><span className="rank-number">02</span><span className="mini-poster tone-blue" /><span className="movie-copy"><b>Moonlight</b><small>2016 · Barry Jenkins</small></span><span className="anatomy-label label-info">Detail / overflow</span><span className="row-action">•••</span><span className="anatomy-label label-move">Move contract</span><span className="move-handle">≡</span></div>
      </section>

      <section className="section personal" id="personal">
        <div className="section-heading"><div><p className="eyebrow">03 / THE THIRD DESTINATION</p><h2>Give personal signals<br />a durable home.</h2></div><p>Taste Explorer and Recently ranked should no longer compete with the canonical order. These three shells show the same modules under different naming and tone.</p></div>
        <div className="personal-list">{directions.map((direction) => <PersonalSpace key={direction.id} direction={direction.id} />)}</div>
      </section>

      <section className="section widths"><div className="section-heading"><div><p className="eyebrow">04 / REPRESENTATIVE WIDTH RULES</p><h2>Recompose.<br />Do not reinvent.</h2></div><p>Available width controls layout; pointer capability controls interaction. The ranked row keeps the same reading order everywhere.</p></div><div className="width-cards"><article><b>≥ 1100</b><h3>Desktop workspace</h3><p>Shared search sits in global chrome. Ranking may add a narrow review or inspector rail. Count stays inline with the title; actions remain named.</p></article><article><b>721–1099</b><h3>iPad composition</h3><p>Single-column list, no squeezed side rail. Search stays full width. Actions collapse selectively; touch always enters explicit Move mode.</p></article><article><b>≤ 720 + phone landscape</b><h3>Phone shell</h3><p>Count stacks with title, bottom navigation remains fixed, rows tighten without dropping posters, and overflow absorbs rare actions—not Move.</p></article></div></section>

      <section className="section decision" id="decision"><div><p className="eyebrow">A PRODUCT RECOMMENDATION</p><h2>Start with Library.</h2><p><b>The living ledger</b> asks for the fewest naming leaps while solving the actual ownership problem. Ranking remains the canonical artifact; Library becomes an honest umbrella for Watch next, Hidden, Recently ranked, and Taste Explorer.</p><ul><li>Keep <b>Ranking</b> as the destination name.</li><li>Rename <b>Lists → Library</b> only if the umbrella tests clearly.</li><li>Place shared search above destination content and remove Ranking’s Add action only in the same change.</li><li>Keep Review visible; keep Move explicit on touch; move rare actions to overflow.</li></ul></div><aside><p className="eyebrow">APPROVAL GATES</p><ol><li><b>Third destination</b><span>Library, You, or My space?</span></li><li><b>Recently ranked</b><span>Which destination owns it?</span></li><li><b>Taste Explorer</b><span>Personal home or Ranking utility?</span></li><li><b>Shared search</b><span>Global band or destination-local?</span></li><li><b>Desktop rail</b><span>Review health, inspector, or none?</span></li></ol></aside></section>

      <footer><div><b>STACKRANK</b><span>Ranking and personal-space redesign · exploration only</span></div><a href="https://www.stackrankapp.com/movies" target="_blank" rel="noreferrer">Open shipped baseline ↗</a></footer>
    </main>
  );
}
