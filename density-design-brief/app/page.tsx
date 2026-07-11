"use client";

import { useState } from "react";

type Device = "desktop" | "ipad" | "iphone";
type OptionId = "calibrated" | "rankbar" | "workbench";

const devices: Array<{ id: Device; label: string; note: string }> = [
  { id: "desktop", label: "Desktop", note: "Fine pointer · wide canvas" },
  { id: "ipad", label: "iPad", note: "Coarse pointer · large canvas" },
  { id: "iphone", label: "iPhone", note: "Coarse pointer · narrow canvas" },
];

const options = [
  {
    id: "calibrated" as OptionId,
    number: "01",
    title: "Calibrated compression",
    tagline: "Keep the architecture. Rewrite the spacing contract.",
    gain: "≈45% less pre-content height",
    risk: "Low implementation risk",
    verdict: "The safest correction",
    summary:
      "The current hierarchy remains recognizable, but the search becomes a compact utility panel, section wrappers lose redundant padding, and the whole system moves to a tighter responsive spacing scale.",
    desktop:
      "Search title and field share one row. Discovery begins immediately below, with no large internal top gap.",
    ipad:
      "The same composition holds. Touch targets remain 48px; only surrounding air compresses.",
    iphone:
      "Search stays 56px tall, but the heading becomes a small label and panels stop adding edge-to-edge padding twice.",
  },
  {
    id: "rankbar" as OptionId,
    number: "02",
    title: "The Rank Bar",
    tagline: "Turn the primary action into persistent app chrome.",
    gain: "≈65% less pre-content height",
    risk: "Moderate, contained change",
    verdict: "Recommended",
    summary:
      "Search graduates from a hero-like card into a dedicated action bar directly beneath navigation. Discovery becomes the page body, so packs and individual movies enter the first viewport by default.",
    desktop:
      "A 52px action bar spans the canvas. Keyboard focus can land in it on load; content begins one rhythm step later.",
    ipad:
      "The bar remains full width and sticky after scroll. Its 52px target is comfortably touchable without becoming a hero.",
    iphone:
      "A compact sticky Rank field sits below the 44px header. Tapping it can expand search suggestions over content.",
  },
  {
    id: "workbench" as OptionId,
    number: "03",
    title: "The Ranking Workbench",
    tagline: "Use desktop width as structure, not merely longer rows.",
    gain: "≈70% less vertical delay on desktop",
    risk: "Highest layout complexity",
    verdict: "Strong power-user direction",
    summary:
      "On large screens, ranking actions live in a compact left rail while discovery fills the remaining canvas. It makes search and pack continuation continuously available without consuming vertical space.",
    desktop:
      "A 300px action rail anchors search and active-pack continuation. Packs and movies begin at the top of the main pane.",
    ipad:
      "The rail becomes a horizontal dock to protect content width. The design converges toward Option 2.",
    iphone:
      "The rail disappears entirely; the phone uses the same sticky Rank field as Option 2.",
  },
];

const packNames = ["Women Behind Camera", "Hans Zimmer", "Fan Favorite", "Heist", "John Williams", "Documentary"];
const movieNames = ["Pride & Prejudice", "When We First Met", "Scary Movie"];

function MiniPacks({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`mini-packs ${compact ? "is-compact" : ""}`}>
      {packNames.map((name, index) => (
        <div className="mini-pack" key={name}>
          <div className={`mini-poster tone-${(index % 4) + 1}`} aria-hidden="true" />
          <div className="mini-pack-copy">
            <strong>{name}</strong>
            <span>{index % 3 === 1 ? "Continue" : "Start"} · {index * 2}/12</span>
          </div>
          <div className="mini-progress" aria-hidden="true"><i style={{ width: `${index * 15}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function MiniMovies() {
  return (
    <div className="mini-movies">
      {movieNames.map((name, index) => (
        <div className="mini-movie" key={name}>
          <div className={`movie-thumb tone-${index + 2}`} aria-hidden="true" />
          <span><strong>{name}</strong><small>{index === 0 ? "All-time essential" : index === 1 ? "Inspired by your ranking" : "Popular now"}</small></span>
          <b>＋</b>
        </div>
      ))}
    </div>
  );
}

function MiniHeader() {
  return (
    <div className="mini-header">
      <b>STACKRANK</b>
      <div className="mini-nav"><strong>Rank</strong><span>Ranking</span><span>Lists</span></div>
      <i>⚙</i>
    </div>
  );
}

function SearchControl({ small = false }: { small?: boolean }) {
  return <div className={`mini-search ${small ? "is-small" : ""}`}><span>⌕</span><b>Search for a movie</b><kbd>⌘ K</kbd></div>;
}

function DiscoveryHeading() {
  return (
    <div className="mini-section-head">
      <span><b>Fresh movie packs</b><small>Fresh mix each visit</small></span>
      <button type="button">↻</button>
      <button type="button">View all</button>
    </div>
  );
}

function Prototype({ option, device }: { option: OptionId; device: Device }) {
  return (
    <div className={`prototype prototype--${option} prototype--${device}`} aria-label={`${option} layout on ${device}`}>
      <div className="prototype-screen">
        <MiniHeader />
        {option === "calibrated" && (
          <>
            <div className="compact-add"><strong>Rank another movie</strong><SearchControl small /></div>
            <main className="mini-main">
              <DiscoveryHeading />
              <MiniPacks compact />
              <MiniMovies />
            </main>
          </>
        )}
        {option === "rankbar" && (
          <>
            <div className="rank-bar"><span>Rank another</span><SearchControl small /></div>
            <main className="mini-main mini-main--open">
              <DiscoveryHeading />
              <MiniPacks />
              <MiniMovies />
            </main>
          </>
        )}
        {option === "workbench" && (
          <div className="workbench">
            <aside className="workbench-rail">
              <span>RANK ANOTHER</span>
              <SearchControl small />
              <div className="continue-pack"><small>CONTINUE A PACK</small><strong>John Williams Scores</strong><i>10 of 12 ranked</i><button type="button">Continue →</button></div>
            </aside>
            <main className="mini-main mini-main--open">
              <DiscoveryHeading />
              <MiniPacks />
              <MiniMovies />
            </main>
          </div>
        )}
        <div className="fold-line"><span>first viewport</span></div>
      </div>
    </div>
  );
}

function Metric({ label, value, fill }: { label: string; value: string; fill: number }) {
  return (
    <div className="metric">
      <div><span>{label}</span><strong>{value}</strong></div>
      <div className="metric-track"><i style={{ width: `${fill}%` }} /></div>
    </div>
  );
}

export default function Home() {
  const [device, setDevice] = useState<Device>("desktop");

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="StackRank density brief home"><span>SR</span> FIELD NOTES / 02</a>
        <nav aria-label="Brief sections">
          <a href="#diagnosis">Diagnosis</a>
          <a href="#options">Options</a>
          <a href="#recommendation">Recommendation</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">STACKRANK · DENSITY &amp; SPACE · DESIGN BRIEF</p>
          <h1>Space should<br />earn its keep.</h1>
          <p className="lede">
            The new Rank page has the right product priority—but it still speaks the visual language of a landing page. This brief explores three ways to make it feel like an active movie-ranking workspace without turning it into a dashboard thicket.
          </p>
          <div className="hero-tags"><span>Desktop-first diagnosis</span><span>Touch-safe adaptations</span><span>3 structural options</span></div>
        </div>
        <div className="hero-meter" aria-label="Current versus target first viewport use">
          <div className="meter-label"><span>CURRENT FIRST VIEWPORT</span><b>Action-poor</b></div>
          <div className="viewport-map">
            <div className="map-header">64 · navigation</div>
            <div className="map-air"><b>228</b><span>search container</span></div>
            <div className="map-air map-air--second"><b>130+</b><span>nested panel air before cards</span></div>
            <div className="map-content">Actual choices finally arrive</div>
            <i className="map-fold">FOLD</i>
          </div>
          <p>In the supplied desktop capture, the problem is not the 48px field. It is the <strong>stack of containers around it</strong>.</p>
        </div>
      </section>

      <section className="diagnosis section" id="diagnosis">
        <div className="section-kicker">01 / WHAT IS ACTUALLY WRONG</div>
        <div className="diagnosis-grid">
          <div>
            <h2>Not “too much whitespace.”<br />Too much ceremonial whitespace.</h2>
            <p className="section-intro">Whitespace is useful when it clarifies hierarchy. Here it delays the next useful choice while repeating boundaries the user already understands.</p>
          </div>
          <div className="layer-stack">
            <div><span>1</span><b>Page margin</b><small>32px before any panel</small></div>
            <div><span>2</span><b>Search panel</b><small>Large card + centered title + internal gaps</small></div>
            <div><span>3</span><b>Discovery panel</b><small>Another large card around all content</small></div>
            <div><span>4</span><b>Pack section</b><small>A third inset surface before choices</small></div>
          </div>
        </div>

        <div className="principles">
          <article><b>01</b><h3>Density follows frequency</h3><p>Search and discovery are repeated working actions. They should receive utility spacing, not hero spacing.</p></article>
          <article><b>02</b><h3>One boundary per idea</h3><p>A panel, inset card, and card row should not all restate the same grouping.</p></article>
          <article><b>03</b><h3>Compress air, not targets</h3><p>Touch targets remain 48–56px. We reclaim surrounding padding, labels, and redundant wrappers.</p></article>
          <article><b>04</b><h3>The fold is a product budget</h3><p>On desktop, search, six packs, and at least one individual-movie lane should coexist in view.</p></article>
        </div>
      </section>

      <section className="options section" id="options">
        <div className="options-head">
          <div><div className="section-kicker">02 / THREE WAYS FORWARD</div><h2>Choose the structural move,<br />then tune the pixels.</h2></div>
          <div className="device-picker" role="group" aria-label="Preview device">
            {devices.map((item) => (
              <button key={item.id} type="button" onClick={() => setDevice(item.id)} className={device === item.id ? "is-active" : ""} aria-pressed={device === item.id}>
                <span>{item.label}</span><small>{item.note}</small>
              </button>
            ))}
          </div>
        </div>

        {options.map((option) => (
          <article className={`option option--${option.id}`} key={option.id}>
            <div className="option-copy">
              <div className="option-number">OPTION {option.number}</div>
              <h3>{option.title}</h3>
              <p className="option-tagline">{option.tagline}</p>
              <p>{option.summary}</p>
              <div className="option-chips"><span>{option.gain}</span><span>{option.risk}</span></div>
              <div className="device-note">
                <b>{devices.find((item) => item.id === device)?.label}</b>
                <p>{option[device]}</p>
              </div>
              <strong className="verdict">{option.verdict}</strong>
            </div>
            <Prototype option={option.id} device={device} />
          </article>
        ))}
      </section>

      <section className="scorecard section">
        <div className="section-kicker">03 / TRADE-OFFS AT A GLANCE</div>
        <div className="scorecard-grid">
          <div className="score-labels"><span>Option</span><span>Space gain</span><span>Familiarity</span><span>Desktop leverage</span><span>Cross-device unity</span><span>Build risk</span></div>
          <div><b>01 · Calibrated</b><Metric label="Space" value="Good" fill={58}/><Metric label="Familiar" value="Highest" fill={94}/><Metric label="Desktop" value="Medium" fill={58}/><Metric label="Unity" value="Highest" fill={92}/><Metric label="Risk" value="Low" fill={24}/></div>
          <div className="is-recommended"><b>02 · Rank Bar</b><Metric label="Space" value="Excellent" fill={84}/><Metric label="Familiar" value="High" fill={80}/><Metric label="Desktop" value="High" fill={82}/><Metric label="Unity" value="High" fill={86}/><Metric label="Risk" value="Medium" fill={42}/></div>
          <div><b>03 · Workbench</b><Metric label="Space" value="Excellent" fill={92}/><Metric label="Familiar" value="Medium" fill={54}/><Metric label="Desktop" value="Highest" fill={98}/><Metric label="Unity" value="Low" fill={38}/><Metric label="Risk" value="High" fill={76}/></div>
        </div>
      </section>

      <section className="recommendation section" id="recommendation">
        <div className="recommendation-mark">02</div>
        <div className="recommendation-copy">
          <div className="section-kicker">RECOMMENDATION</div>
          <h2>Adopt the Rank Bar.<br />Borrow Option 1’s spacing system.</h2>
          <p className="section-intro">Option 2 is the clearest expression of the product strategy already chosen: Rank is an action, not a destination artifact. It removes the search “hero” entirely while remaining one coherent design across mouse and touch devices.</p>
          <div className="recommendation-points">
            <div><b>What changes</b><p>Search becomes a dedicated 52px action bar below navigation. The discovery panel loses its outer white shell. Section headings sit directly on the page canvas.</p></div>
            <div><b>What stays</b><p>Six fresh packs, three suggestion sources, the monochrome visual identity, generous interactive targets, and the existing Rank / Ranking / Lists model.</p></div>
            <div><b>What to measure</b><p>Rank starts per visit, pack starts per visit, individual-movie starts per visit, and the share of sessions that reach a comparison without scrolling.</p></div>
          </div>
        </div>
      </section>

      <section className="tokens section">
        <div><div className="section-kicker">04 / A NEW RESPONSIVE RHYTHM</div><h2>Compact is not the same as small.</h2><p>Use different space budgets by canvas size, while input modality continues to determine hit targets and hover—not page composition.</p></div>
        <div className="token-table">
          <div className="token-row token-head"><span>Token</span><b>Desktop</b><b>iPad</b><b>iPhone</b></div>
          <div className="token-row"><span>Page edge</span><b>24px</b><b>20px</b><b>12px</b></div>
          <div className="token-row"><span>Section gap</span><b>16px</b><b>16px</b><b>12px</b></div>
          <div className="token-row"><span>Panel padding</span><b>20px</b><b>20px</b><b>16px</b></div>
          <div className="token-row"><span>Search target</span><b>44–48px</b><b>52px</b><b>56px</b></div>
          <div className="token-row"><span>Section radius</span><b>16px</b><b>16px</b><b>0–14px</b></div>
        </div>
      </section>

      <footer>
        <div><b>STACKRANK</b><span>DENSITY &amp; SPACE BRIEF · JULY 2026</span></div>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
