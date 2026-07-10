"use client";

import { useState } from "react";

type Platform = "desktop" | "ipad" | "iphone";
type Concept = 1 | 2 | 3;

const platforms: Array<{ id: Platform; label: string; note: string }> = [
  { id: "desktop", label: "Desktop", note: "large screen · keyboard + mouse" },
  { id: "ipad", label: "iPad", note: "large screen · touch first" },
  { id: "iphone", label: "iPhone", note: "small screen · touch" },
];

const principles = [
  {
    number: "01",
    title: "Optimize for the next completed ranking",
    copy: "A view, a pack open, or a card impression is not the win. A movie successfully placed is.",
  },
  {
    number: "02",
    title: "Serve recall and recognition",
    copy: "Search handles “I know the movie.” Fresh prompts handle “remind me what I’ve seen.” Both belong above the fold.",
  },
  {
    number: "03",
    title: "Make the movie the actionable unit",
    copy: "Packs are valuable sources and progress systems. The home page should usually surface the next movie, not the container.",
  },
  {
    number: "04",
    title: "Engineer freshness",
    copy: "Mix personalized, timely, essential, and pack-derived candidates. Suppress repeats. Replace a prompt as soon as it is handled.",
  },
  {
    number: "05",
    title: "Turn placement into momentum",
    copy: "Celebrate where the movie landed, then make “rank another” the most natural next move.",
  },
  {
    number: "06",
    title: "Adapt geometry, preserve meaning",
    copy: "Desktop may show action and artifact together. iPhone can separate them. Rank, Ranking, and Lists must still mean the same thing.",
  },
];

const fieldNotes = [
  {
    name: "Flickchart",
    label: "Action is the product",
    copy: "Leads with preference decisions, starts with familiar films, then introduces more diverse and tailored choices.",
    href: "https://www.flickchart.com/faq",
    mark: "FC",
  },
  {
    name: "MovieLens",
    label: "Input earns payoff",
    copy: "Makes the loop explicit: rate movies, build a taste profile, receive better recommendations.",
    href: "https://movielens.org/",
    mark: "ML",
  },
  {
    name: "Netflix",
    label: "Freshness has layers",
    copy: "Personalizes the choice of row, the titles in it, and their order—not merely a random carousel shuffle.",
    href: "https://help.netflix.com/en/node/100639",
    mark: "NX",
  },
  {
    name: "Letterboxd",
    label: "Frequent actions stay close",
    copy: "Keeps logging globally accessible and makes common watchlist state changes a single action.",
    href: "https://letterboxd.com/about/faq/",
    mark: "LB",
  },
  {
    name: "Duolingo",
    label: "Recommend a next step",
    copy: "Reframed a collection of possible lessons as a guided path toward the next useful action.",
    href: "https://blog.duolingo.com/new-duolingo-home-screen-design/",
    mark: "DU",
  },
];

const optionCopy: Record<Concept, { eyebrow: string; title: string; summary: string; risk: string; fit: string }> = {
  1: {
    eyebrow: "Evolution",
    title: "The “Rank Next” rail",
    summary: "Keep the ranking-dominant shell, but replace large pack cards with compact, individual movie prompts.",
    risk: "Low–medium change",
    fit: "Good repeat-use fit",
  },
  2: {
    eyebrow: "Recommended",
    title: "Rank as the launchpad",
    summary: "Make Rank a verb, give the accumulated list its own Ranking destination, and absorb Discover into action.",
    risk: "Medium–high change",
    fit: "Excellent repeat-use fit",
  },
  3: {
    eyebrow: "Bold bet",
    title: "Guided ranking sessions",
    summary: "Present one strong next candidate and turn ranking into a focused, repeatable five-minute ritual.",
    risk: "High change",
    fit: "Potentially highest fit",
  },
};

function MiniPoster({ tone = 0 }: { tone?: number }) {
  return (
    <span className={`mini-poster mini-poster--${tone % 5}`} aria-hidden="true">
      <span />
      <span />
    </span>
  );
}

function RankRows({ compact = false, count = 5 }: { compact?: boolean; count?: number }) {
  const titles = ["American Beauty", "Eternal Sunshine…", "Fight Club", "When Harry Met Sally…", "Fantastic Mr. Fox"];
  return (
    <div className={`rank-rows ${compact ? "rank-rows--compact" : ""}`} aria-hidden="true">
      {titles.slice(0, count).map((title, index) => (
        <div className="rank-row" key={title}>
          <strong>{String(index + 1).padStart(2, "0")}</strong>
          <MiniPoster tone={index} />
          <span>
            <b>{title}</b>
            <small>{[1999, 2004, 1999, 1989, 2009][index]}</small>
          </span>
          <i>•••</i>
        </div>
      ))}
    </div>
  );
}

function SearchMock() {
  return (
    <div className="search-mock" aria-hidden="true">
      <span>⌕</span>
      <span>Search for a movie</span>
    </div>
  );
}

function PromptRow({ title, reason, tone }: { title: string; reason: string; tone: number }) {
  return (
    <div className="prompt-row" aria-hidden="true">
      <MiniPoster tone={tone} />
      <span>
        <b>{title}</b>
        <small>{reason}</small>
      </span>
      <em>Rank</em>
    </div>
  );
}

function DeviceShell({ platform, children }: { platform: Platform; children: React.ReactNode }) {
  return (
    <div className={`device device--${platform}`}>
      <div className="device__bar">
        <span>STACKRANK</span>
        <span className="device__nav">Rank&nbsp;&nbsp; Ranking&nbsp;&nbsp; Lists</span>
        <span>◉</span>
      </div>
      <div className="device__screen">{children}</div>
      {platform === "iphone" ? (
        <div className="device__bottom-nav">
          <b>↑<small>Rank</small></b>
          <b>≡<small>Ranking</small></b>
          <b>☷<small>Lists</small></b>
        </div>
      ) : null}
    </div>
  );
}

function ConceptMockup({ concept, platform }: { concept: Concept; platform: Platform }) {
  if (concept === 1) {
    return (
      <DeviceShell platform={platform}>
        <div className="concept-one">
          <section className="mock-ranking">
            <div className="mock-section-head"><b>Current ranking</b><span>Review · Filter · Share</span></div>
            <RankRows count={platform === "iphone" ? 3 : 5} />
          </section>
          <section className="mock-action-rail">
            <b>Add to your ranking</b>
            <SearchMock />
            <div className="mock-section-head"><b>Rank next</b><span>Change picks</span></div>
            <PromptRow title="The Apartment" reason="Inspired by your #4" tone={2} />
            <PromptRow title="Raiders of the Lost Ark" reason="Essentials · Adventure" tone={3} />
            <PromptRow title="Arrival" reason="Continue a movie pack" tone={4} />
            <button type="button" tabIndex={-1}>View all packs →</button>
          </section>
        </div>
      </DeviceShell>
    );
  }

  if (concept === 2) {
    return (
      <DeviceShell platform={platform}>
        <div className="concept-two">
          <section className="mock-launchpad">
            <div className="mock-kicker">RANK ANOTHER MOVIE</div>
            <SearchMock />
            <div className="mock-section-head"><b>Suggested to rank</b><span>Fresh mix · 6 picks</span></div>
            <div className="movie-grid" aria-hidden="true">
              {["The Apartment", "Arrival", "Akira", "Heat", "Moonlight", "The Grand Budapest Hotel"].map((title, index) => (
                <div className="movie-card" key={title}>
                  <MiniPoster tone={index} />
                  <span><b>{title}</b><small>{index % 2 ? "Inspired by your ranking" : "Essential you may know"}</small></span>
                  <em>Rank</em>
                </div>
              ))}
            </div>
            <div className="source-chips"><span>Inspired</span><span>Continue a pack</span><span>Essentials</span></div>
          </section>
          <aside className="mock-ranking-preview">
            <div className="mock-section-head"><b>Your ranking</b><span>119 movies</span></div>
            <RankRows compact count={4} />
            <button type="button" tabIndex={-1}>Open full ranking →</button>
          </aside>
        </div>
      </DeviceShell>
    );
  }

  return (
    <DeviceShell platform={platform}>
      <div className="concept-three">
        <section className="session-stage">
          <div className="mock-kicker">WHAT SHOULD WE RANK NEXT?</div>
          <div className="session-movie">
            <MiniPoster tone={2} />
            <span><b>The Apartment</b><small>Inspired by When Harry Met Sally…, your #4</small></span>
          </div>
          <button className="session-primary" type="button" tabIndex={-1}>Rank this movie</button>
          <div className="session-secondary"><span>Haven’t seen · Save</span><span>Not interested</span></div>
          <div className="session-modes"><b>Quick one</b><span>Rank 5 movies</span><span>Choose a source</span></div>
        </section>
        <aside className="session-context">
          <div className="mock-section-head"><b>Where it could land</b><span>Your top five</span></div>
          <RankRows compact count={5} />
        </aside>
      </div>
    </DeviceShell>
  );
}

function CurrentStateDiagram({ kind }: { kind: Platform }) {
  return (
    <div className={`current-frame current-frame--${kind}`} aria-hidden="true">
      <div className="current-frame__bar"><b>STACKRANK</b><span>Rank · Discover · Lists</span></div>
      <div className="current-frame__body">
        <section className="current-list"><b>Current ranking</b><RankRows compact count={kind === "iphone" ? 4 : 5} /></section>
        <section className="current-rail">
          <b>Add to your ranking</b><SearchMock />
          <b>Continue ranking</b>
          <div className="static-pack"><span>PACK</span><b>John Williams Scores</b><small>10 of 12 ranked</small></div>
          <div className="static-pack"><span>PACK</span><b>Christmas & Christmas-ish</b><small>10 of 14 ranked</small></div>
          <div className="static-pack"><span>PACK</span><b>Hans Zimmer Scores</b><small>8 of 12 ranked</small></div>
          <div className="buried-prompt">↓ First personalized movie</div>
        </section>
      </div>
      <div className="fold-line"><span>FIRST VIEWPORT ENDS</span></div>
    </div>
  );
}

export default function Home() {
  const [platform, setPlatform] = useState<Platform>("desktop");

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="StackRank home strategy, back to top">
          <span>SR</span>
          <b>StackRank / Home strategy</b>
        </a>
        <nav aria-label="Page sections">
          <a href="#diagnosis">Diagnosis</a>
          <a href="#principles">Principles</a>
          <a href="#options">Options</a>
          <a href="#recommendation">Direction</a>
        </nav>
        <a className="header-pill" href="#options">3 futures ↓</a>
      </header>

      <section className="hero" id="top">
        <div className="hero__copy">
          <p className="eyebrow">Product & design review · July 2026</p>
          <h1>Ranking is<br /><i>the verb.</i></h1>
          <p className="hero__dek">The ranked list is StackRank’s artifact and payoff. The home page should be the workshop that keeps it growing.</p>
          <div className="hero__actions">
            <a href="#options">Explore three directions <span>→</span></a>
            <a href="#diagnosis">See the diagnosis</a>
          </div>
        </div>
        <div className="hero__graphic" aria-label="The dominant returning use case is ranking more movies">
          <div className="use-case-meter">
            <div className="use-case-meter__main"><strong>90%</strong><span>rank more movies</span></div>
            <div className="use-case-meter__rest"><strong>10%</strong><span>inspect / modify</span></div>
          </div>
          <div className="verb-loop">
            <span>Prompt</span><b>→</b><span>Compare</span><b>→</b><span>Place</span><b>→</b><span className="verb-loop__hot">Again</span>
          </div>
          <p>Design the first viewport around momentum, then let the list prove the value.</p>
        </div>
      </section>

      <section className="thesis-strip" aria-label="Design thesis">
        <span>WORKSHOP, NOT MUSEUM</span><span>·</span><span>RECOGNITION + RECALL</span><span>·</span><span>ONE MOVIE CLOSER</span><span>·</span><span>FRESH BY DESIGN</span>
      </section>

      <section className="section section--dark" id="diagnosis">
        <div className="section-heading section-heading--split">
          <div><p className="eyebrow">01 / The diagnosis</p><h2>We fixed the old hierarchy.<br />Then we kept going.</h2></div>
          <p>The redesign correctly pulled a populated ranking into the first viewport. But it made the artifact so dominant that the repeat action became a narrow afterthought.</p>
        </div>
        <div className="evidence-grid">
          <article><strong>712px</strong><span>desktop ranking workspace</span><p>versus a 400px action rail in the audited 1440px layout</p></article>
          <article><strong>15k px</strong><span>ranking panel height</span><p>for a mature 119-movie list—beautiful repetition, low action density</p></article>
          <article><strong>843px</strong><span>first personalized pick</span><p>on iPhone Discover, effectively behind the bottom navigation</p></article>
          <article><strong>0</strong><span>browse-led prompts</span><p>on the populated iPhone Rank destination above the current list</p></article>
        </div>
        <div className="current-devices">
          <article><div className="device-label"><b>Desktop</b><span>artifact dominates</span></div><CurrentStateDiagram kind="desktop" /></article>
          <article><div className="device-label"><b>iPad</b><span>large pack targets</span></div><CurrentStateDiagram kind="ipad" /></article>
          <article><div className="device-label"><b>iPhone</b><span>prompts below fold</span></div><CurrentStateDiagram kind="iphone" /></article>
        </div>
        <div className="root-cause">
          <span>ROOT CAUSE</span>
          <p>The home page spends premium space on <b>containers and progress</b>, while the actual movies a person can rank now wait below them.</p>
        </div>
      </section>

      <section className="section field-section">
        <div className="section-heading section-heading--split">
          <div><p className="eyebrow">02 / Signals from the field</p><h2>Borrow the behavior.<br />Not the costume.</h2></div>
          <p>Comparable products point toward an action-first loop, a recommended next step, and personalization at more than one layer.</p>
        </div>
        <div className="field-grid">
          {fieldNotes.map((note) => (
            <a key={note.name} href={note.href} target="_blank" rel="noreferrer">
              <span className="field-mark">{note.mark}</span>
              <p>{note.name}</p><h3>{note.label}</h3><span>{note.copy}</span><b>Read source ↗</b>
            </a>
          ))}
        </div>
      </section>

      <section className="section principles-section" id="principles">
        <div className="section-heading"><p className="eyebrow">03 / Design philosophy</p><h2>Six rules for the next home.</h2></div>
        <div className="principle-grid">
          {principles.map((principle) => (
            <article key={principle.number}>
              <span>{principle.number}</span><h3>{principle.title}</h3><p>{principle.copy}</p>
            </article>
          ))}
        </div>
        <div className="action-unit">
          <span>PACK</span><b>→</b><span>THE NEXT MOVIE IN THAT PACK</span>
          <p>Keep the system. Change what earns the spotlight.</p>
        </div>
      </section>

      <section className="section options-section" id="options">
        <div className="section-heading section-heading--split">
          <div><p className="eyebrow">04 / Three possible futures</p><h2>Same product.<br />Different conviction.</h2></div>
          <p>Switch platforms to see how each direction changes composition without changing the underlying product meaning.</p>
        </div>
        <div className="platform-picker" role="group" aria-label="Preview platform">
          {platforms.map((item) => (
            <button key={item.id} type="button" className={platform === item.id ? "is-active" : ""} aria-pressed={platform === item.id} onClick={() => setPlatform(item.id)}>
              <b>{item.label}</b><span>{item.note}</span>
            </button>
          ))}
        </div>

        {([1, 2, 3] as Concept[]).map((concept) => {
          const item = optionCopy[concept];
          return (
            <article className={`option option--${concept}`} key={concept}>
              <div className="option__head">
                <div><p className="eyebrow">Option {concept} · {item.eyebrow}</p><h3>{item.title}</h3><p>{item.summary}</p></div>
                <div className="option__badges"><span>{item.fit}</span><span>{item.risk}</span></div>
              </div>
              <ConceptMockup concept={concept} platform={platform} />
              <div className="option__platform-notes">
                {concept === 1 ? (
                  <><p><b>Desktop</b> Three compact movie prompts replace the pack stack in the existing rail.</p><p><b>iPad</b> Two-pane in landscape; a horizontal prompt shelf above the list in portrait.</p><p><b>iPhone</b> Search, two “Rank next” prompts, then the current ranking still peeks into view.</p></>
                ) : concept === 2 ? (
                  <><p><b>Desktop</b> A 60–65% action workspace plus a handsome ranking preview.</p><p><b>iPad</b> Two panes when space allows; action grid first in portrait and split-screen.</p><p><b>iPhone</b> Rank becomes prompts; Ranking becomes the full list; Lists stays focused.</p></>
                ) : (
                  <><p><b>Desktop</b> A focused session stage with the ranking held as useful context.</p><p><b>iPad</b> Large touch targets and a deliberate one-candidate-at-a-time rhythm.</p><p><b>iPhone</b> Full-screen quick-one or five-movie sessions, with search always one step away.</p></>
                )}
              </div>
              <div className="option__tradeoff">
                <b>{concept === 2 ? "Why it wins" : "The tradeoff"}</b>
                <p>{concept === 1 ? "Fastest correction and safest implementation, but it still treats ranking more as supporting work beside the artifact." : concept === 2 ? "It matches the dominant job without forcing a new ritual. Discovery becomes a means to rank, and the list keeps its own first-class home." : "The strongest habit loop and the most distinctive product idea, but candidate quality and seen/unseen uncertainty make it the riskiest starting point."}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="section comparison-section">
        <div className="section-heading"><p className="eyebrow">05 / Decision table</p><h2>Choose the level of conviction.</h2></div>
        <div className="comparison-table" role="table" aria-label="Comparison of the three design directions">
          <div className="comparison-row comparison-row--head" role="row"><span>Direction</span><span>Repeat ranking</span><span>List visibility</span><span>Freshness</span><span>Change</span></div>
          <div className="comparison-row" role="row"><b>1 · Rank Next rail</b><span><i style={{ width: "68%" }} />Good</span><span>Highest</span><span>Good</span><span>Low–medium</span></div>
          <div className="comparison-row comparison-row--winner" role="row"><b>2 · Rank launchpad <em>pick</em></b><span><i style={{ width: "94%" }} />Excellent</span><span>High</span><span>Excellent</span><span>Medium–high</span></div>
          <div className="comparison-row" role="row"><b>3 · Ranking sessions</b><span><i style={{ width: "100%" }} />Potentially highest</span><span>Contextual</span><span>Excellent</span><span>High</span></div>
        </div>
      </section>

      <section className="section recommendation-section" id="recommendation">
        <div className="recommendation-card">
          <p className="eyebrow">The call</p>
          <h2>Choose Option 2.<br /><i>Borrow momentum from Option 3.</i></h2>
          <p className="recommendation-dek">Make Rank the launchpad, give the full artifact a dedicated Ranking destination, and end every successful placement with a fresh invitation to rank another.</p>
          <div className="recommendation-grid">
            <article><span>01</span><b>Rename the mental model</b><p>Rank / Ranking / Lists. Discovery becomes a source inside the Rank job.</p></article>
            <article><span>02</span><b>Demote the container</b><p>Packs remain powerful deeper down, but individual movies earn first-viewport space.</p></article>
            <article><span>03</span><b>Keep the payoff visible</b><p>Desktop and iPad show a ranking preview. iPhone keeps the full list one tab away.</p></article>
            <article><span>04</span><b>Close the loop</b><p>“Landed at #27” becomes the bridge to a replacement candidate—not a dead end.</p></article>
          </div>
        </div>
        <div className="decision-panel">
          <p className="eyebrow">Alignment questions</p>
          <ol>
            <li><span>01</span><p>Are we comfortable replacing <b>Rank / Discover / Lists</b> with <b>Rank / Ranking / Lists</b>?</p></li>
            <li><span>02</span><p>Are packs primarily a browse destination and candidate source—not first-viewport home content?</p></li>
            <li><span>03</span><p>Should the default home show roughly <b>six prompts on desktop, three to four on iPad, and two on iPhone</b>?</p></li>
          </ol>
        </div>
      </section>

      <section className="section measurement-section">
        <div className="section-heading section-heading--split"><div><p className="eyebrow">06 / Prove it</p><h2>Measure momentum,<br />not admiration.</h2></div><p>Use privacy-bounded, title-free events. The important question is whether a returning visit produces more completed rankings without degrading trust in the list.</p></div>
        <div className="metric-grid">
          <article><span>Primary</span><b>Completed rankings / session</b></article>
          <article><span>Speed</span><b>Time to first ranking start</b></article>
          <article><span>Quality</span><b>Start → completion rate</b></article>
          <article><span>Source</span><b>Search vs prompt vs pack mix</b></article>
          <article><span>Guardrail</span><b>Ranking / Review / Share opens</b></article>
          <article><span>Health</span><b>Cancellation and return rate</b></article>
        </div>
      </section>

      <footer>
        <div><span className="footer-mark">SR</span><p><b>StackRank home strategy</b><br />Product & design proposal · no StackRank product changes</p></div>
        <a href="https://www.stackrankapp.com/movies" target="_blank" rel="noreferrer">Open the live product ↗</a>
      </footer>
    </main>
  );
}
