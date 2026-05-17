const GENRE_COLORS = {
  "Drama":"#7b9fd4","Comedy":"#d9825b","Action":"#d4a84b","Adventure":"#6daa8f",
  "Crime":"#c17fa0","Thriller":"#9b7fc4","Romance":"#d47b7b","Horror":"#888888",
  "Sci-Fi":"#5bb8d4","Animation":"#e8c44a","History":"#a08050","War":"#708060",
  "Biography":"#c4a46b","Music":"#8fb0d8","Mystery":"#9d7ec4","Fantasy":"#7bc4a0",
  "Family":"#d4c04b","Sport":"#6db87b","Western":"#c49060","Documentary":"#78a8b8",
  "Short":"#a0a0a0","Musical":"#d48fb0","Other":"#606060",
};
function getGenreColor(g) { return GENRE_COLORS[g] || "#888888"; }

const comparisonParams      = new URLSearchParams(window.location.search);
const comparisonDecadeLabel = comparisonParams.get("decade");
const comparisonRank        = Number.parseInt(comparisonParams.get("rank") || "1", 10);

let comparisonDecade = null;
let comparisonFilm   = null;

const comparisonNodes = {
  backLinks:        document.querySelectorAll("[data-back-link]"),
  pageTitle:        document.getElementById("comparisonTitle"),
  pageSubtitle:     document.getElementById("comparisonSubtitle"),
  heroFilmTitle:    document.getElementById("heroFilmTitle"),
  heroFilmMeta:     document.getElementById("heroFilmMeta"),
  heroDecadeTitle:  document.getElementById("heroDecadeTitle"),
  heroDecadeMeta:   document.getElementById("heroDecadeMeta"),
  metricGrid:       document.getElementById("metricGrid"),
  profileRows:      document.getElementById("profileRows"),
  genreRows:        document.getElementById("genreRows"),
  placementTrack:   document.getElementById("placementTrack"),
  placementSummary: document.getElementById("placementSummary"),
  takeawayLead:     document.getElementById("takeawayLead"),
  takeawaySupport:  document.getElementById("takeawaySupport"),
};

// ── Header ────────────────────────────────────────────────────────────────────
function renderComparisonHeader() {
  document.documentElement.style.setProperty("--page-accent", comparisonDecade.meta.accent);
  document.title = `${comparisonFilm.title} vs ${comparisonDecade.label}`;
  comparisonNodes.pageTitle.textContent     = `${comparisonFilm.title} vs ${comparisonDecade.label}`;
  comparisonNodes.pageSubtitle.textContent  = comparisonDecade.meta.blurb;
  comparisonNodes.heroFilmTitle.textContent = comparisonFilm.title;
  comparisonNodes.heroFilmMeta.textContent  = `${comparisonFilm.year} · rank #${comparisonFilm.rank} · ${formatNumber(comparisonFilm.rating)}/10`;
  comparisonNodes.heroDecadeTitle.textContent = `${comparisonDecade.label} average`;
  comparisonNodes.heroDecadeMeta.textContent  = `${comparisonDecade.filmCount} films · ${formatNumber(comparisonDecade.avgRating)}/10 · ${Math.round(comparisonDecade.avgRuntime)} min`;
  comparisonNodes.backLinks.forEach((link) => { link.href = `${comparisonDecade.label}.html`; });
}

// ── Key metrics ───────────────────────────────────────────────────────────────
function buildMetricGrid() {
  const filmRuntime   = comparisonFilm.runtime || 0;
  const decadeRuntime = Math.round(comparisonDecade.avgRuntime || 0);
  const filmGenres    = comparisonFilm.genres || [];
  const sharedGenres  = filmGenres.filter((g) => comparisonDecade.genreStats.some((e) => e.genre === g)).length;

  const items = [
    { label: "Rating delta",  filmVal: `${comparisonFilm.rating >= comparisonDecade.avgRating ? "+" : ""}${formatNumber(comparisonFilm.rating - comparisonDecade.avgRating)}`, decadeVal: `${formatNumber(comparisonDecade.avgRating)}/10`, note: `Film: ${formatNumber(comparisonFilm.rating)}/10 · Decade avg: ${formatNumber(comparisonDecade.avgRating)}/10` },
    { label: "Popularity",    filmVal: formatVotes(comparisonFilm.votes), decadeVal: formatVotes(comparisonDecade.avgVotes), note: `Film: ${formatVotes(comparisonFilm.votes)} · Decade avg: ${formatVotes(comparisonDecade.avgVotes)}` },
    { label: "Runtime delta", filmVal: `${filmRuntime - decadeRuntime >= 0 ? "+" : ""}${filmRuntime - decadeRuntime} min`, decadeVal: `${decadeRuntime} min`, note: `Film: ${filmRuntime} min · Decade avg: ${decadeRuntime} min` },
    { label: "Genre overlap", filmVal: `${sharedGenres}/${filmGenres.length}`, decadeVal: `${sharedGenres} shared`, note: "Genres of this film present in the decade ranking" },
  ];

  comparisonNodes.metricGrid.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "metric-card";
    card.innerHTML = `
      <strong class="metric-card__film">${item.filmVal}</strong>
      <span class="metric-card__label">${item.label}</span>
      <strong class="metric-card__decade">${item.decadeVal}</strong>
      <small style="grid-column:1/-1;font-size:11px;color:rgba(232,213,163,0.4);padding:0 18px 12px">${item.note}</small>
    `;
    comparisonNodes.metricGrid.appendChild(card);
  });
}

// ── Bullet chart ──────────────────────────────────────────────────────────────
function buildBulletChart() {
  const el = document.getElementById("bulletChart");
  if (!el) return;

  const filmColor   = "#d4a84b";
  const decadeColor = "#7b9fd4";
  const filmRuntime   = comparisonFilm.runtime || 0;
  const decadeRuntime = comparisonDecade.avgRuntime || 0;

  const allVotes    = comparisonDecade.films.map(f => f.votes).filter(Number.isFinite);
  const allRuntimes = comparisonDecade.films.map(f => f.runtime).filter(Number.isFinite);

  // Scale fisse con 0 come origine
  const allRatings  = comparisonDecade.films.map(f => f.rating).filter(Number.isFinite);

  const metrics = [
    {
      label: "IMDb Rating", unit: "/10",
      scaleMin: 0, scaleMax: 10,
      avg: comparisonDecade.avgRating,
      film: comparisonFilm.rating,
      dMin: allRatings.length ? Math.min(...allRatings) : 0,
      dMax: allRatings.length ? Math.max(...allRatings) : 10,
      fmt: v => v.toFixed(1),
      ticks: [0, 2.5, 5, 7.5, 10],
    },
    {
      label: "Votes", unit: "",
      scaleMin: 0, scaleMax: Math.max(1000000, comparisonFilm.votes, ...allVotes),
      avg: comparisonDecade.avgVotes,
      film: comparisonFilm.votes,
      dMin: Math.min(...allVotes, 0),
      dMax: Math.max(...allVotes, 1),
      fmt: v => formatVotes(v),
      ticks: [0, 250000, 500000, 750000, 1000000],
    },
    {
      label: "Runtime", unit: " min",
      scaleMin: 0, scaleMax: Math.max(200, filmRuntime + 20, ...allRuntimes),
      avg: decadeRuntime,
      film: filmRuntime,
      dMin: 0,
      dMax: Math.max(...allRuntimes, 1),
      fmt: v => Math.round(v),
      ticks: [0, 60, 120, 180, 240].filter(t => t <= Math.max(200, filmRuntime + 20)),
    },
  ];

  const lw = 130, bw = 460, barH = 22, rowH = 92;
  const svgW = lw + bw + 80;
  const svgH = metrics.length * rowH + 60;

  const rows = metrics.map((m, i) => {
    const range = m.scaleMax - m.scaleMin || 1;
    const xAt   = v => lw + ((Math.min(Math.max(v, m.scaleMin), m.scaleMax) - m.scaleMin) / range) * bw;
    const y0    = i * rowH;

    // Sfondo barra (tutto il range scala)
    const barBg = `<rect x="${lw}" y="${y0+20}" width="${bw}" height="${barH}" style="fill:rgba(232,213,163,0.04);stroke:rgba(232,213,163,0.15);stroke-width:1"></rect>`;

    // Zona blu: range effettivo dei top-20
    const zxMin = xAt(m.dMin);
    const zxMax = xAt(m.dMax);
    const zoneW = Math.max(0, zxMax - zxMin);
    const zone  = `<rect x="${zxMin.toFixed(1)}" y="${y0+20}" width="${zoneW.toFixed(1)}" height="${barH}" style="fill:rgba(123,159,212,0.18);stroke:rgba(123,159,212,0.3);stroke-width:1"></rect>`;

    // Label min/max della zona blu — sopra la barra, fuori dalla zona
    const zMinLabel = `<text x="${zxMin.toFixed(1)}" y="${y0+17}" text-anchor="middle" style="fill:rgba(123,159,212,0.7);font-size:10px;font-family:Cormorant Garamond,serif">${m.fmt(m.dMin)}${m.unit}</text>`;
    const zMaxLabel = `<text x="${zxMax.toFixed(1)}" y="${y0+17}" text-anchor="middle" style="fill:rgba(123,159,212,0.7);font-size:10px;font-family:Cormorant Garamond,serif">${m.fmt(m.dMax)}${m.unit}</text>`;

    // Linea media decade — sopra la barra
    const ax = xAt(m.avg);
    const avgLine  = `<line x1="${ax.toFixed(1)}" y1="${y0+14}" x2="${ax.toFixed(1)}" y2="${y0+46}" style="stroke:${decadeColor};stroke-width:2;stroke-dasharray:4 3"></line>`;
    const avgLabel = `<text x="${ax.toFixed(1)}" y="${y0+12}" text-anchor="middle" style="fill:${decadeColor};font-size:10px;font-family:Cormorant Garamond,serif">avg ${m.fmt(m.avg)}${m.unit}</text>`;

    // Diamante film
    const fx = xAt(m.film);
    const fy = y0 + 20 + barH / 2;
    const diamond   = `<polygon points="${fx},${fy-10} ${fx+9},${fy} ${fx},${fy+10} ${fx-9},${fy}" style="fill:${filmColor}"></polygon>`;
    const filmLabel = `<text x="${fx.toFixed(1)}" y="${y0+74}" text-anchor="middle" style="fill:${filmColor};font-size:13px;font-weight:bold;font-family:Cormorant Garamond,serif">${m.fmt(m.film)}${m.unit}</text>`;

    // Tick sotto la barra
    const ticks = m.ticks.map(t => {
      const tx = xAt(t);
      const tickVal = (m.label === "Votes" && t === 0) ? "0" : `${m.fmt(t)}${m.unit}`;
      return `<line x1="${tx.toFixed(1)}" y1="${y0+42}" x2="${tx.toFixed(1)}" y2="${y0+48}" style="stroke:rgba(232,213,163,0.2);stroke-width:1"></line>
              <text x="${tx.toFixed(1)}" y="${y0+58}" text-anchor="middle" style="fill:rgba(232,213,163,0.25);font-size:10px;font-family:Cormorant Garamond,serif">${tickVal}</text>`;
    }).join("");

    const label = `<text x="${lw-10}" y="${y0+35}" text-anchor="end" style="fill:rgba(232,213,163,0.85);font-size:15px;font-family:Cormorant Garamond,serif">${m.label}</text>`;

    return [label, barBg, zone, zMinLabel, zMaxLabel, ticks, avgLine, diamond, avgLabel, filmLabel].join("");
  });

  const legend = `
    <polygon points="14,10 22,4 30,10 22,16" style="fill:${filmColor}"></polygon>
    <text x="36" y="14" style="fill:#e8d5a3;font-size:12px;font-family:Cormorant Garamond,serif">This film</text>
    <line x1="118" y1="4" x2="118" y2="18" style="stroke:${decadeColor};stroke-width:2;stroke-dasharray:4 3"></line>
    <text x="126" y="14" style="fill:#e8d5a3;font-size:12px;font-family:Cormorant Garamond,serif">Decade average</text>
    <rect x="250" y="5" width="28" height="10" style="fill:rgba(123,159,212,0.15);stroke:rgba(123,159,212,0.25);stroke-width:1"></rect>
    <text x="284" y="14" style="fill:rgba(232,213,163,0.5);font-size:12px;font-family:Cormorant Garamond,serif">Top-20 range</text>
  `;

  el.innerHTML = `<svg viewBox="0 0 ${svgW} ${svgH + 30}" style="width:100%;height:auto;display:block;overflow:visible">
    <g transform="translate(0,10)">${legend}</g>
    <g transform="translate(0,44)">${rows.join("")}</g>
  </svg>`;
}

// ── Profile rows ──────────────────────────────────────────────────────────────
function buildProfileRows() {
  const filmRuntime   = comparisonFilm.runtime || 0;
  const decadeRuntime = comparisonDecade.avgRuntime || 0;
  const maxVotes      = Math.max(comparisonFilm.votes, comparisonDecade.avgVotes) || 1;
  const maxRuntime    = Math.max(filmRuntime, comparisonDecade.maxRuntime || decadeRuntime) || 1;

  const legend = document.createElement("div");
  legend.className = "comparison-legend";
  legend.innerHTML = `<span><i class="legend-film"></i> This film</span><span><i class="legend-decade"></i> Decade average</span>`;
  comparisonNodes.profileRows.innerHTML = "";
  comparisonNodes.profileRows.appendChild(legend);

  [
    { label: "IMDb rating", film: comparisonFilm.rating, decade: comparisonDecade.avgRating, max: 10, fmt: v => `${formatNumber(v)}/10` },
    { label: "Votes",       film: comparisonFilm.votes,  decade: comparisonDecade.avgVotes,  max: maxVotes, fmt: v => formatVotes(v) },
    { label: "Runtime",     film: filmRuntime,           decade: decadeRuntime,              max: maxRuntime, fmt: v => `${Math.round(v)} min` },
  ].forEach((m) => {
    const row = document.createElement("div");
    row.className = "profile-row";
    row.innerHTML = `
      <div class="profile-row__header"><span>${m.label}</span><small>${m.fmt(m.film)} vs ${m.fmt(m.decade)}</small></div>
      <div class="profile-row__track">
        <div class="profile-row__fill film"   style="width:${clampPercent(m.film,   m.max)}%"></div>
        <div class="profile-row__fill decade" style="width:${clampPercent(m.decade, m.max)}%"></div>
      </div>
      <div class="profile-row__footer"><span>This film</span><span>Decade average</span></div>
    `;
    comparisonNodes.profileRows.appendChild(row);
  });
}

// ── Genre rows ────────────────────────────────────────────────────────────────
function buildGenreRows() {
  const filmGenres = comparisonFilm.genres || [];
  const combined   = Array.from(new Set([...filmGenres, ...comparisonDecade.genreStats.slice(0, 6).map(e => e.genre)])).slice(0, 8);

  const legend = document.createElement("div");
  legend.className = "comparison-legend";
  legend.innerHTML = `<span><i class="legend-film"></i> This film (present/absent)</span><span><i class="legend-decade"></i> Decade presence %</span>`;
  comparisonNodes.genreRows.innerHTML = "";
  comparisonNodes.genreRows.appendChild(legend);

  combined.forEach((genre) => {
    const entry     = comparisonDecade.genreStats.find(e => e.genre === genre);
    const decadeVal = entry ? entry.percentage : 0;
    const filmHas   = filmGenres.includes(genre);
    const row       = document.createElement("div");
    row.className   = "genre-row";
    row.innerHTML   = `
      <span>${genre}</span>
      <div class="genre-row__bars">
        <div class="genre-row__bar film"   style="width:${filmHas ? 100 : 0}%"></div>
        <div class="genre-row__bar decade" style="width:${decadeVal}%"></div>
      </div>
      <small>${decadeVal}% · ${filmHas ? "✓ in film" : "✗ not in film"}</small>
    `;
    comparisonNodes.genreRows.appendChild(row);
  });
}

// ── Placement track ───────────────────────────────────────────────────────────
function buildPlacementTrack() {
  comparisonNodes.placementTrack.innerHTML = "";
  comparisonDecade.films.forEach((film) => {
    const item = document.createElement("div");
    item.className = `placement-item${film.rank === comparisonFilm.rank ? " active" : ""}`;
    item.innerHTML = `<span>#${film.rank}</span><small>${formatNumber(film.rating)}</small>`;
    comparisonNodes.placementTrack.appendChild(item);
  });
  const pr = getFilmPercentile(comparisonFilm, comparisonDecade.films, "votes");
  comparisonNodes.placementSummary.textContent =
    `${comparisonFilm.title} ranks #${comparisonFilm.rank} by rating in the ${comparisonDecade.label} sample` +
    ` and ${pr ? `#${pr.rank}` : "outside the top list"} by vote count.`;
}

// ── Takeaway ──────────────────────────────────────────────────────────────────
function buildTakeaway() {
  const filmGenres     = comparisonFilm.genres || [];
  const ratingDelta    = comparisonFilm.rating - comparisonDecade.avgRating;
  const voteDelta      = comparisonFilm.votes  - comparisonDecade.avgVotes;
  const strongestGenre = filmGenres
    .map(g => comparisonDecade.genreStats.find(e => e.genre === g))
    .filter(Boolean)
    .sort((a, b) => b.percentage - a.percentage)[0];

  comparisonNodes.takeawayLead.textContent =
    `${comparisonFilm.title} is ${ratingDelta >= 0 ? "above" : "below"} the decade's average rating by ${Math.abs(ratingDelta).toFixed(1)} points` +
    ` and ${voteDelta >= 0 ? "over-indexes" : "under-indexes"} on audience attention by ${formatVotes(Math.abs(voteDelta))}.`;

  comparisonNodes.takeawaySupport.textContent = strongestGenre
    ? `${strongestGenre.genre} is the film's strongest historical fit: it appears in ${strongestGenre.percentage}% of the decade's ranked titles.`
    : "Its genre profile is relatively uncommon within the decade ranking.";
}

// ── Entry point ───────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (!comparisonDecadeLabel) {
    document.body.innerHTML = "<main class='error-state'>Nessuna decade specificata.</main>";
    return;
  }

  try {
    await getDecadeData(comparisonDecadeLabel);
    comparisonDecade = getDecadeRecord(comparisonDecadeLabel);
  } catch (err) {
    document.body.innerHTML = `
      <main style="padding:60px 32px;font-family:serif;color:#e8d5a3;background:#05050f;min-height:100vh">
        <h1 style="font-size:36px;margin-top:12px">Impossibile caricare ${comparisonDecadeLabel}</h1>
        <p style="opacity:.6;margin-top:16px">Assicurati che il server Flask sia avviato su localhost:5000.</p>
        <p style="opacity:.4;font-size:12px">${err.message}</p>
        <a href="index.html" style="display:inline-block;margin-top:32px;color:inherit">← Torna all'indice</a>
      </main>`;
    return;
  }

  if (!comparisonDecade) {
    document.body.innerHTML = "<main class='error-state'>Dati non disponibili.</main>";
    return;
  }

  comparisonFilm = comparisonDecade.films.find(f => f.rank === comparisonRank) || comparisonDecade.films[0];
  if (!comparisonFilm) {
    document.body.innerHTML = "<main class='error-state'>Film non trovato.</main>";
    return;
  }

  renderComparisonHeader();
  buildMetricGrid();
  buildBulletChart();
  buildProfileRows();
  buildGenreRows();
  buildPlacementTrack();
  buildTakeaway();
});