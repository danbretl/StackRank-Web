"use client";

import { useState } from "react";

type Device = "desktop" | "ipad-landscape" | "ipad-portrait" | "iphone-portrait" | "iphone-landscape";
type SearchState = "resting" | "focused" | "typed" | "loading" | "results" | "error";
type DirectionId = "measured" | "spotlight" | "billboard";

const devices: Array<{ id: Device; label: string; note: string }> = [
  { id: "desktop", label: "Desktop", note: "1440 × 900 · fine pointer" },
  { id: "ipad-landscape", label: "iPad ↔", note: "1024 × 768 · touch" },
  { id: "ipad-portrait", label: "iPad ↕", note: "820 × 1180 · touch" },
  { id: "iphone-portrait", label: "iPhone ↕", note: "390 × 844 · touch" },
  { id: "iphone-landscape", label: "iPhone ↔", note: "844 × 390 · touch" },
];

const searchStates: Array<{ id: SearchState; label: string }> = [
  { id: "resting", label: "Resting" },
  { id: "focused", label: "Focused" },
  { id: "typed", label: "Typed" },
  { id: "loading", label: "Loading" },
  { id: "results", label: "Results" },
  { id: "error", label: "Error" },
];

const directions = [
  {
    id: "measured" as DirectionId,
    number: "01",
    title: "Measured lift",
    scale: "58px field",
    alignment: "Centered at rest · left when active",
    shortcut: "/",
    verdict: "Safest",
    summary: "A deliberate step up from the shipped bar. It adds emphasis through a bounded 760px group and active-state alignment, while preserving today’s compact page rhythm.",
  },
  {
    id: "spotlight" as DirectionId,
    number: "02",
    title: "Spotlight field",
    scale: "72px field",
    alignment: "Centered label · left-scanning results",
    shortcut: "⌘ / Ctrl K",
    verdict: "Recommended to test",
    summary: "The action feels celebrated without becoming a hero panel. A wide editorial field owns one clean band; results become a focused overlay and discovery remains visible immediately below.",
  },
  {
    id: "billboard" as DirectionId,
    number: "03",
    title: "Purposefully oversized",
    scale: "96px field",
    alignment: "Centered through typed input",
    shortcut: "/",
    verdict: "Provocation",
    summary: "A high-conviction search instrument that tests the upper bound. It is visually memorable, but asks whether active text can remain centered without slowing result scanning.",
  },
];

const packNames = ["Studio Ghibli Gateways", "One-Location Pressure", "Viola Davis Essentials"];
const movieNames = ["The Apartment", "Moonlight", "No Country for Old Men"];

function Brand() {
  return <div className="mock-brand"><b>STACKRANK</b><span>MOVIES</span></div>;
}

function SearchField({ direction, state, tiny = false }: { direction: DirectionId; state: SearchState; tiny?: boolean }) {
  const typed = ["typed", "loading", "results", "error"].includes(state);
  const value = state === "error" ? "Mulholland Drv" : typed ? "Mulholland Drive" : "Search for a movie";
  return (
    <div className={`search-field search-field--${direction} is-${state} ${tiny ? "is-tiny" : ""}`}>
      <span className="search-icon" aria-hidden="true">⌕</span>
      <span className="search-value">{value}</span>
      {state === "loading" ? <span className="spinner" aria-label="Loading" /> : <kbd>{direction === "spotlight" ? "⌘K" : "/"}</kbd>}
      {state === "error" ? <small>Couldn’t reach movie search. Try again.</small> : null}
    </div>
  );
}

function SearchResults() {
  return (
    <div className="search-results">
      {["Mulholland Drive", "Mulholland Dr.", "Drive My Car"].map((title, index) => (
        <div key={title} className={index === 0 ? "is-selected" : ""}>
          <span className={`poster tone-${index + 1}`} aria-hidden="true" />
          <span><b>{title}</b><small>{[2001, 1999, 2021][index]}</small></span>
          {index === 0 ? <em>Enter ↵</em> : null}
        </div>
      ))}
    </div>
  );
}

function PackCard({ index, direction }: { index: number; direction: DirectionId }) {
  const handled = [7, 4, 9][index];
  const ranked = [5, 3, 7][index];
  const saved = [1, 1, 1][index];
  const hidden = [1, 0, 1][index];
  return (
    <div className={`pack-card pack-card--${direction}`}>
      <span className={`pack-art tone-${index + 2}`} aria-hidden="true"><i /><i /><i /><i /></span>
      <span className="pack-copy"><b>{packNames[index]}</b><small>{index === 0 ? "Handmade worlds and patient wonder" : index === 1 ? "Limited space, rising tension" : "Authority, wit, grief, and total command"}</small></span>
      <span className="pack-state">{index === 1 ? "Continue" : "In progress"}</span>
      {direction === "measured" ? (
        <span className="progress-line"><i style={{ width: `${handled * 8}%` }} /><small>{handled} / 12 handled</small></span>
      ) : direction === "spotlight" ? (
        <span className="progress-segments" aria-label={`${ranked} ranked, ${saved} saved, ${hidden} hidden`}>
          <i className="ranked" style={{ flex: ranked }} /><i className="saved" style={{ flex: saved }} /><i className="hidden" style={{ flex: hidden }} /><i className="remaining" style={{ flex: 12 - handled }} />
          <small>{ranked} ranked · {saved} saved · {hidden} hidden</small>
        </span>
      ) : (
        <span className="progress-ring" style={{ "--p": `${handled * 8.33}%` } as React.CSSProperties}><b>{handled}</b><small>/12</small></span>
      )}
      <span className="pack-affordance">{direction === "measured" ? "Open →" : direction === "spotlight" ? "Continue pack" : "→"}</span>
    </div>
  );
}

function SuggestionLanes({ direction }: { direction: DirectionId }) {
  return (
    <div className={`suggestion-lanes suggestion-lanes--${direction}`}>
      {movieNames.map((title, index) => (
        <section key={title}>
          <header><span><b>{["INSPIRED BY PARASITE", "ALL-TIME ESSENTIALS", "POPULAR NOW"][index]}</b><small>{["Because it’s #1 on your list", "Recognized favorites before 2016", "Popular on TMDB right now"][index]}</small></span><i>↻</i></header>
          <div className="movie-prompt"><span className={`poster tone-${index + 1}`} /><span><b>{title}</b><small>{["Recommended from Parasite", "A 2000s drama essential", "Popular now · Drama"][index]}</small></span><em>Rank</em></div>
        </section>
      ))}
    </div>
  );
}

function Prototype({ direction, device, state }: { direction: DirectionId; device: Device; state: SearchState }) {
  return (
    <div className={`prototype prototype--${device} prototype--${direction}`}>
      <div className="prototype-topbar"><Brand /><span className="mock-nav"><b>Rank</b><span>Ranking</span><span>Lists</span></span><i>⚙</i></div>
      <div className="rank-surface">
        <span className="rank-label">Rank another</span>
        <div className="search-wrap"><SearchField direction={direction} state={state} />{state === "results" ? <SearchResults /> : null}</div>
      </div>
      <main className="mock-main">
        <header className="section-head"><span><b>FRESH MOVIE PACKS</b><small>Fresh mix · 114 packs available</small></span><span><i>↻</i><b>View all packs</b></span></header>
        <div className="pack-grid">{packNames.map((_, index) => <PackCard key={index} index={index} direction={direction} />)}</div>
        <SuggestionLanes direction={direction} />
      </main>
      {device.startsWith("iphone") ? <div className="bottom-nav"><b>↑<small>Rank</small></b><b>▦<small>Ranking</small></b><b>☷<small>Lists</small></b></div> : null}
    </div>
  );
}

function StateStrip({ direction }: { direction: DirectionId }) {
  return <div className="state-strip">{searchStates.map((state) => <div key={state.id}><b>{state.label}</b><SearchField direction={direction} state={state.id} tiny />{state.id === "results" ? <SearchResults /> : null}</div>)}</div>;
}

export default function Home() {
  const [device, setDevice] = useState<Device>("desktop");
  const [state, setState] = useState<SearchState>("resting");

  return (
    <main>
      <header className="site-header"><a href="#top"><span>SR</span><b>RANK SURFACE / 03</b></a><nav><a href="#directions">Directions</a><a href="#states">States</a><a href="#packs">Packs</a><a href="#decisions">Decisions</a></nav><span>PRIVATE DESIGN BRIEF</span></header>

      <section className="hero" id="top">
        <div><p className="eyebrow">STACKRANK · RANK SURFACE REFINEMENT · JULY 2026</p><h1>Make the action<br /><i>feel inevitable.</i></h1><p className="lede">The shipped Rank Bar fixed density. This brief tests how much more prominence search can carry—and how the surrounding movie and pack surfaces can simplify—without drifting back into ceremonial hero space.</p></div>
        <aside><Brand /><div className="hero-scale"><span>SHIPPED</span><i /><span>58</span><i /><span>72</span><i /><span>96</span></div><p>Three scales. Six search states. Five responsive canvases. One real search control in the eventual product.</p></aside>
      </section>

      <section className="guardrail-strip"><b>SHIPPED BAR IS THE BASELINE</b><span>Search prominence is reopened</span><span>Containment and pack cards are exploration only</span><span>No production direction is approved here</span></section>

      <section className="section directions" id="directions">
        <div className="section-heading"><div><p className="eyebrow">01 / THREE LEVELS OF CONVICTION</p><h2>Scale the field.<br />Keep the page moving.</h2></div><p>Use the controls to hold content constant while testing geometry and state. Phone landscape remains a first-class mobile shell, not a shrunken desktop.</p></div>
        <div className="control-deck">
          <div className="device-picker" role="group" aria-label="Preview device">{devices.map((item) => <button key={item.id} onClick={() => setDevice(item.id)} className={device === item.id ? "is-active" : ""} aria-pressed={device === item.id}><b>{item.label}</b><small>{item.note}</small></button>)}</div>
          <div className="state-picker" role="group" aria-label="Search state">{searchStates.map((item) => <button key={item.id} onClick={() => setState(item.id)} className={state === item.id ? "is-active" : ""} aria-pressed={state === item.id}>{item.label}</button>)}</div>
        </div>
        {directions.map((direction) => <article className={`direction direction--${direction.id}`} key={direction.id}><div className="direction-copy"><span>OPTION {direction.number}</span><h3>{direction.title}</h3><p>{direction.summary}</p><dl><div><dt>Scale</dt><dd>{direction.scale}</dd></div><div><dt>Alignment</dt><dd>{direction.alignment}</dd></div><div><dt>Shortcut</dt><dd>{direction.shortcut}</dd></div></dl><b className="verdict">{direction.verdict}</b></div><Prototype direction={direction.id} device={device} state={state} /></article>)}
      </section>

      <section className="section states" id="states"><div className="section-heading"><div><p className="eyebrow">02 / SEARCH IS A SEQUENCE</p><h2>Judge all six states.<br />Not one empty field.</h2></div><p>Option 2 makes the strongest case for centered resting copy that snaps to left-aligned active scanning. Option 3 intentionally keeps typed text centered to expose the tradeoff.</p></div>{directions.map((direction) => <article key={direction.id}><header><b>{direction.number} · {direction.title}</b><span>{direction.alignment}</span></header><StateStrip direction={direction.id} /></article>)}</section>

      <section className="section containment"><div className="section-heading"><div><p className="eyebrow">03 / LOWER CONTAINMENT</p><h2>Bound the movie.<br />Not every ancestor.</h2></div><p>All three preserve clear interactive boundaries. The variable is whether each source needs its own filled container, a ruled lane, or only a labeled shelf.</p></div><div className="containment-grid">{directions.map((direction) => <article key={direction.id}><b>{direction.number} · {direction.id === "measured" ? "Soft source panels" : direction.id === "spotlight" ? "Ruled editorial lanes" : "Open shelves"}</b><SuggestionLanes direction={direction.id} /></article>)}</div></section>

      <section className="section pack-lab" id="packs"><div className="section-heading"><div><p className="eyebrow">04 / PACK CARD LAB</p><h2>Progress should explain<br />what “handled” means.</h2></div><p>Completion remains based on ranked + saved + hidden. The card is the button in every version, with one strong focus outline and no nested fake button.</p></div><div className="pack-lab-grid">{directions.map((direction, index) => <article key={direction.id}><header><b>{direction.number} · {direction.id === "measured" ? "Compact horizontal" : direction.id === "spotlight" ? "Segmented states" : "Circular summary"}</b><span>{direction.id === "spotlight" ? "Most informative" : direction.id === "measured" ? "Lowest visual cost" : "Best at-a-glance"}</span></header><PackCard index={index} direction={direction.id} /><p>{direction.id === "measured" ? "Use “handled,” not “ranked.” State and affordance stay separate but compact." : direction.id === "spotlight" ? "The bar names ranked, saved, and hidden without changing completion semantics." : "A ring makes overall progress scannable; a secondary detail line must still explain the components."}</p></article>)}</div></section>

      <section className="section decisions" id="decisions"><div className="decision-call"><p className="eyebrow">A TESTABLE LEAD</p><h2>Prototype Option 2 first.</h2><p>The 72px Spotlight field is the strongest midpoint: prominent enough to feel like the product’s core verb, restrained enough to keep packs in the same viewport, and naturally compatible with left-aligned autocomplete results.</p><div><span>Borrow Option 1’s <b>/ shortcut</b> for lower browser-chrome collision.</span><span>Borrow Option 2’s <b>segmented pack progress</b>.</span><span>Keep the shipped mobile <b>flex shelves and momentum scroll</b>.</span></div></div><aside><p className="eyebrow">DECISIONS REQUIRED</p><ol><li><b>Scale</b><span>58, 72, or 96px?</span></li><li><b>Alignment</b><span>Centered only at rest, or while typing?</span></li><li><b>Shortcut</b><span>/ or Command/Ctrl+K?</span></li><li><b>Containment</b><span>Soft panels, ruled lanes, or open shelves?</span></li><li><b>Pack progress</b><span>Compact, segmented, or circular?</span></li></ol></aside></section>

      <footer><div><b>STACKRANK</b><span>Rank surface refinement · design exploration only</span></div><a href="https://www.stackrankapp.com/movies" target="_blank" rel="noreferrer">Open shipped baseline ↗</a></footer>
    </main>
  );
}
