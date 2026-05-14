const decadeLabel = document.body.dataset.decade;
let selectedFilm = null;
let decade = null;

const nodes = {
  decadeTitle:      document.getElementById("decadeTitle"),
  decadeTheme:      document.getElementById("decadeTheme"),
  decadeBlurb:      document.getElementById("decadeBlurb"),
  statRating:       document.getElementById("statRating"),
  statRuntime:      document.getElementById("statRuntime"),
  statVotes:        document.getElementById("statVotes"),
  statGenres:       document.getElementById("statGenres"),
  decadeTopFilm:    document.getElementById("decadeTopFilm"),
  decadeTopFilmMeta:document.getElementById("decadeTopFilmMeta"),
  genreOverview:    document.getElementById("genreOverview"),
  filmList:         document.getElementById("filmList"),
  detailTitle:      document.getElementById("detailTitle"),
  detailMeta:       document.getElementById("detailMeta"),
  detailSummary:    document.getElementById("detailSummary"),
  detailGenres:     document.getElementById("detailGenres"),
  detailStats:      document.getElementById("detailStats"),
  compareLink:      document.getElementById("compareLink"),
  insightLead:      document.getElementById("insightLead"),
  insightSupport:   document.getElementById("insightSupport"),
  prevLink:         document.getElementById("prevLink"),
  nextLink:         document.getElementById("nextLink"),
  leftColumn:       document.querySelector(".left-column"),
  rightColumn:      document.querySelector(".right-column"),
  detailCard:       document.querySelector(".detail-card"),
  insightCard:      document.querySelector(".insight-card"),
  listCard:         document.querySelector(".list-card"),
  navTitle:         document.querySelector(".topbar__center strong"),
};

let chartNodes = null;
let compareButtonNode = null;

function renderHeader() {
  document.documentElement.style.setProperty("--page-accent", decade.meta.accent);
  document.title = `${decade.label} · Cinema by Decade`;
  if (nodes.navTitle) nodes.navTitle.textContent = decade.label;
  nodes.decadeTitle.textContent = decade.label;
  nodes.decadeTheme.textContent = decade.meta.theme;
  nodes.decadeBlurb.textContent = decade.meta.blurb;
  nodes.statRating.textContent  = `${formatNumber(decade.avgRating)}/10`;
  nodes.statRuntime.textContent = decade.avgRuntime ? `${Math.round(decade.avgRuntime)} min` : "N/A";
  nodes.statVotes.textContent   = formatVotes(decade.avgVotes);
  nodes.statGenres.textContent  = String(decade.genreStats.length);

  if (decade.topRatedFilm) {
    nodes.decadeTopFilm.textContent    = decade.topRatedFilm.title;
    nodes.decadeTopFilmMeta.textContent = `${decade.topRatedFilm.year} · rank #${decade.topRatedFilm.rank} · ${formatNumber(decade.topRatedFilm.rating)}/10`;
  }

  const prev = getPreviousDecade(decade.label);
  const next = getNextDecade(decade.label);

  if (prev) { nodes.prevLink.href = `${prev}.html`; nodes.prevLink.textContent = `← ${prev}`; }
  else { nodes.prevLink.removeAttribute("href"); nodes.prevLink.textContent = "← First decade"; nodes.prevLink.classList.add("is-disabled"); }

  if (next) { nodes.nextLink.href = `${next}.html`; nodes.nextLink.textContent = `${next} →`; }
  else { nodes.nextLink.removeAttribute("href"); nodes.nextLink.textContent = "Latest decade →"; nodes.nextLink.classList.add("is-disabled"); }
}

function renderGenreOverview() {
  nodes.genreOverview.innerHTML = "";
  // Mostra solo i generi principali con percentuale relativa al film più presente
  const top = decade.genreStats.slice(0, 6);
  const maxCount = top[0] ? top[0].count : 1;
  top.forEach((genre) => {
    const pct = Math.round((genre.count / maxCount) * 100);
    const row = document.createElement("div");
    row.className = "overview-bar";
    row.innerHTML = `
      <span>${genre.genre}</span>
      <div class="overview-bar__track">
        <div class="overview-bar__fill" style="width:${pct}%"></div>
      </div>
      <strong>${genre.count} film${genre.count !== 1 ? "s" : ""}</strong>
    `;
    nodes.genreOverview.appendChild(row);
  });
}

function renderFilmList() {
  nodes.filmList.innerHTML = "";
  // Ordina per rating decrescente per la visualizzazione
  const sorted = [...decade.films].sort((a, b) => b.rating - a.rating || a.rank - b.rank);
  sorted.forEach((film, idx) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `film-list__item${selectedFilm && selectedFilm.rank === film.rank ? " active" : ""}`;

    // Tronca il titolo se troppo lungo
    const maxLen = 28;
    const displayTitle = film.title.length > maxLen ? film.title.slice(0, maxLen) + "…" : film.title;

    item.innerHTML = `
      <span class="film-list__rank">#${idx + 1}</span>
      <span class="film-list__body">
        <strong title="${film.title}">${displayTitle}</strong>
        <small>${film.year}${film.director ? " · " + film.director : ""}</small>
      </span>
      <span class="film-list__rating">${formatNumber(film.rating)}</span>
    `;
    item.addEventListener("click", () => {
      selectedFilm = film;
      renderFilmList();
      renderFilmDetail();
    });
    nodes.filmList.appendChild(item);
  });
}

function renderFilmStats(film) {
  const ratingPercentile  = getFilmPercentile(film, decade.films, "rating");
  const votePercentile    = getFilmPercentile(film, decade.films, "votes");
  const runtimePercentile = getFilmPercentile(film, decade.films, "runtime");

  const stats = [
    { label: "IMDb rating",        value: `${formatNumber(film.rating)}/10`,          note: `${formatNumber(film.rating - decade.avgRating, 1)} vs avg` },
    { label: "Votes",              value: formatVotes(film.votes),                     note: votePercentile    ? `popularity rank ${votePercentile.rank}/${votePercentile.total}`       : "—" },
    { label: "Runtime",            value: film.runtime ? `${film.runtime} min` : "N/A", note: runtimePercentile ? `length rank ${runtimePercentile.rank}/${runtimePercentile.total}` : "—" },
    { label: "Position in decade", value: `#${film.rank}`,                             note: ratingPercentile  ? `top ${ratingPercentile.percentile}% by rating`                       : "—" },
  ];

  nodes.detailStats.innerHTML = "";
  stats.forEach((stat) => {
    const card = document.createElement("div");
    card.className = "detail-stat";
    card.innerHTML = `<span>${stat.label}</span><strong>${stat.value}</strong><small>${stat.note}</small>`;
    nodes.detailStats.appendChild(card);
  });
}

function renderInsight(film) {
  const ratingDelta  = film.rating - decade.avgRating;
  const runtimeDelta = (film.runtime || decade.avgRuntime) - (decade.avgRuntime || 0);
  const genresInTopMix = (film.genres || [])
    .map((g) => decade.genreStats.find((e) => e.genre === g))
    .filter(Boolean)
    .sort((a, b) => b.count - a.count);

  const dominantGenre = genresInTopMix[0];
  const tone         = ratingDelta >= 0 ? "outperforms" : "sits below";
  const durationTone = runtimeDelta >= 0 ? "longer" : "shorter";

  nodes.insightLead.textContent =
    `${film.title} ${tone} the typical ${decade.label} top film by ${Math.abs(ratingDelta).toFixed(1)} rating points` +
    (film.runtime ? ` and runs ${Math.abs(Math.round(runtimeDelta))} minutes ${durationTone} than average.` : ".");

  nodes.insightSupport.textContent = dominantGenre
    ? `${dominantGenre.genre} is this film's closest link to the decade profile: it appears in ${dominantGenre.count} of the ${decade.films.length} ranked films for the period.`
    : "Its genre mix is relatively unusual within the decade ranking, which makes it stand out from the dominant profile of the period.";
}

function ensureCompareButton() {
  if (compareButtonNode) return;
  const compareCard = document.createElement("section");
  compareCard.className = "compare-button-card";
  compareCard.innerHTML = `
    <a class="comparison-btn" id="compareLink" href="comparison.html">
      <div class="comparison-btn-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"></path>
        </svg>
      </div>
      <div class="comparison-btn-text">
        <div class="comparison-btn-label">Comparative analysis</div>
        <div class="comparison-btn-title">Compare with the decade</div>
        <div class="comparison-btn-sub" id="compareButtonSub">—</div>
      </div>
      <div class="comparison-btn-arrow">→</div>
    </a>
  `;
  nodes.detailCard.insertAdjacentElement("afterend", compareCard);
  compareButtonNode = {
    link: compareCard.querySelector("#compareLink"),
    sub:  compareCard.querySelector("#compareButtonSub"),
  };
  nodes.compareLink = compareButtonNode.link;
}

function ensureExtraCharts() {
  if (chartNodes) return;
  const donutCard = document.createElement("section");
  donutCard.className = "ranking-card";
  donutCard.innerHTML = `
    <p class="eyebrow">Genre composition</p>
    <h3 class="panel-title">Decade genre mix</h3>
    <div class="donut-layout">
      <div class="donut-chart" id="genreDonutChart"></div>
      <div class="donut-legend" id="genreDonutLegend"></div>
    </div>
  `;
  const scatterCard = document.createElement("section");
  scatterCard.className = "compare-card";
  scatterCard.innerHTML = `
    <p class="eyebrow">Scatter plot</p>
    <h3 class="panel-title">Runtime vs IMDb rating</h3>
    <div class="chart-frame">
      <svg class="scatter-svg" id="scatterPlot" viewBox="0 0 560 280" role="img" aria-label="Scatter plot"></svg>
    </div>
  `;
  const distributionCard = document.createElement("section");
  distributionCard.className = "viz-card";
  distributionCard.innerHTML = `
    <p class="eyebrow">Distribution</p>
    <h3>Rating spread in the decade</h3>
    <div class="distribution-bars" id="distributionBars"></div>
    <p class="ranking-caption" id="distributionCaption"></p>
  `;
  if (nodes.insightCard) nodes.leftColumn.appendChild(nodes.insightCard);
  nodes.leftColumn.appendChild(donutCard);
  nodes.leftColumn.appendChild(scatterCard);
  nodes.leftColumn.appendChild(distributionCard);
  chartNodes = {
    donutChart:          document.getElementById("genreDonutChart"),
    donutLegend:         document.getElementById("genreDonutLegend"),
    scatterPlot:         document.getElementById("scatterPlot"),
    distributionBars:    document.getElementById("distributionBars"),
    distributionCaption: document.getElementById("distributionCaption"),
  };
}

function polarToCartesian(cx, cy, r, angle) {
  const rad = (angle - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const s = polarToCartesian(cx, cy, r, endAngle);
  const e = polarToCartesian(cx, cy, r, startAngle);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${endAngle - startAngle <= 180 ? "0" : "1"} 0 ${e.x} ${e.y}`;
}

function renderGenreDonut(film) {
  const palette = ["var(--page-accent)", "#d9825b", "#c3a655", "#7ca09b", "#7f6db0", "#4f6272"];
  // Usa i genreStats reali — ogni entry ha .count (quanti film nel top-20 hanno quel genere)
  const topStats = decade.genreStats.slice(0, 5);
  const total    = topStats.reduce((s, e) => s + e.count, 0) || 1;

  let angle = 0;
  const segments = topStats.map((entry, i) => {
    const sweep = (entry.count / total) * 360;
    const seg = {
      genre: entry.genre,
      count: entry.count,
      color: palette[i % palette.length],
      path:  describeArc(90, 90, 62, angle, angle + sweep),
    };
    angle += sweep;
    return seg;
  });

  const filmGenres = film.genres || [];

  chartNodes.donutChart.innerHTML = `
    <svg viewBox="0 0 180 180" role="img" aria-label="Genre donut">
      <circle cx="90" cy="90" r="62" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="24"></circle>
      ${segments.map((s) => `<path d="${s.path}" fill="none" stroke="${s.color}" stroke-width="24" stroke-linecap="butt"></path>`).join("")}
      <circle cx="90" cy="90" r="40" fill="rgba(7,12,18,0.96)"></circle>
      <text x="90" y="82"  text-anchor="middle" class="donut-value">${filmGenres.length}</text>
      <text x="90" y="102" text-anchor="middle" class="donut-label">film genres</text>
    </svg>
  `;

  // Legenda: mostra "X / 20 films" invece di percentuale impossibile da sommare a 100
  chartNodes.donutLegend.innerHTML = segments.map((s) => `
    <div class="legend-row${filmGenres.includes(s.genre) ? " active" : ""}">
      <span class="legend-swatch" style="background:${s.color}"></span>
      <span>${s.genre}</span>
      <strong>${s.count}/${decade.films.length} films</strong>
    </div>
  `).join("");
}

function renderScatterPlot(film) {
  const w = 560, h = 280;
  const m = { top: 24, right: 18, bottom: 38, left: 48 };
  const pw = w - m.left - m.right;
  const ph = h - m.top - m.bottom;

  const withRuntime = decade.films.filter((f) => f.runtime);
  if (!withRuntime.length) {
    chartNodes.scatterPlot.innerHTML = `<text x="280" y="140" text-anchor="middle" class="chart-label" fill="var(--gold-dim)">No runtime data available</text>`;
    return;
  }

  const minR = Math.min(...withRuntime.map((f) => f.runtime));
  const maxR = Math.max(...withRuntime.map((f) => f.runtime));

  const x = (rt)   => m.left + ((rt - minR) / Math.max(1, maxR - minR)) * pw;
  const y = (rate) => m.top  + (1 - rate / 10) * ph;

  const gridLines   = [6,7,8,9,10].map((t) => `<line x1="${m.left}" y1="${y(t)}" x2="${w-m.right}" y2="${y(t)}" class="chart-grid"></line>`).join("");
  const tickLabels  = [6,7,8,9,10].map((t) => `<text x="${m.left-12}" y="${y(t)+4}" class="chart-tick">${t.toFixed(1)}</text>`).join("");
  const rtTicks     = [minR, Math.round((minR+maxR)/2), maxR].map((t) => `<text x="${x(t)}" y="${h-10}" text-anchor="middle" class="chart-tick">${t}</text>`).join("");
  const points      = withRuntime.map((f) => `
    <circle cx="${x(f.runtime)}" cy="${y(f.rating)}"
      r="${f.rank === film.rank ? 7 : 4.5}"
      class="${f.rank === film.rank ? "chart-point chart-point--active" : "chart-point"}">
    </circle>
  `).join("");

  chartNodes.scatterPlot.innerHTML = `
    <line x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${h-m.bottom}" class="chart-axis"></line>
    <line x1="${m.left}" y1="${h-m.bottom}" x2="${w-m.right}" y2="${h-m.bottom}" class="chart-axis"></line>
    ${gridLines}${tickLabels}${rtTicks}${points}
    <text x="${w/2}" y="${h-4}" text-anchor="middle" class="chart-label">Runtime (minutes)</text>
    <text x="16" y="${h/2}" text-anchor="middle" class="chart-label" transform="rotate(-90 16 ${h/2})">IMDb rating</text>
  `;
}

function renderDistribution(film) {
  const bins = [
    { min: 6.5, max: 7.0, label: "6.5–6.9" },
    { min: 7.0, max: 7.5, label: "7.0–7.4" },
    { min: 7.5, max: 8.0, label: "7.5–7.9" },
    { min: 8.0, max: 8.5, label: "8.0–8.4" },
    { min: 8.5, max: 9.5, label: "8.5+"    },
  ];
  bins.forEach((b) => { b.count = decade.films.filter((f) => f.rating >= b.min && f.rating < b.max).length; });
  const activeBin = bins.find((b) => film.rating >= b.min && film.rating < b.max) || bins[bins.length - 1];
  const maxCount  = Math.max(...bins.map((b) => b.count), 1);

  chartNodes.distributionBars.innerHTML = bins.map((b) => `
    <div class="distribution-bar${b.label === activeBin.label ? " active" : ""}">
      <div class="distribution-bar__column">
        <div class="distribution-bar__fill" style="height:${(b.count/maxCount)*100}%"></div>
      </div>
      <strong>${b.count}</strong>
      <span>${b.label}</span>
    </div>
  `).join("");

  chartNodes.distributionCaption.textContent =
    `${film.title} falls into the ${activeBin.label} rating band, one of ${activeBin.count} films in the ${decade.label} top selection.`;
}

function renderFilmDetail() {
  const film = selectedFilm || decade.films[0];
  if (!film) return;

  nodes.detailTitle.textContent = film.title;

  nodes.detailMeta.innerHTML =
    `<span class="detail-year-badge">${film.year}</span>` +
    `<span class="detail-rating-stack"><strong>${formatNumber(film.rating)}</strong><small>/10 · ${formatVotes(film.votes)} IMDb votes</small></span>` +
    `<span class="detail-meta-line">${film.director || "Unknown director"} · ${film.runtime ? film.runtime + " min" : "runtime N/A"}</span>`;

  // Rimuovi summary — mostra solo genres
  if (nodes.detailSummary) nodes.detailSummary.style.display = "none";

  nodes.detailGenres.innerHTML = (film.genres || []).map((g) => `<li>${g}</li>`).join("");

  renderFilmStats(film);
  renderInsight(film);
  renderGenreDonut(film);
  renderScatterPlot(film);
  renderDistribution(film);

  if (compareButtonNode) {
    compareButtonNode.sub.textContent = `"${film.title}" vs. avg of the ${decade.label}`;
  }
  if (nodes.compareLink) {
    nodes.compareLink.href = `comparison.html?decade=${decade.label}&rank=${film.rank}`;
  }
}

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (nodes.navTitle) nodes.navTitle.textContent = decadeLabel;

  try {
    await getDecadeData(decadeLabel);
    decade = getDecadeRecord(decadeLabel);
  } catch (err) {
    console.error("Impossibile caricare i dati:", err);
    document.body.innerHTML = `
      <main style="padding:60px 32px;font-family:serif;color:#e8d5a3;background:#05050f;min-height:100vh">
        <p style="opacity:.5;letter-spacing:3px;font-size:11px;text-transform:uppercase">Errore</p>
        <h1 style="font-size:36px;margin-top:12px">Impossibile caricare ${decadeLabel}</h1>
        <p style="opacity:.6;margin-top:16px">Assicurati che il server Flask sia avviato su localhost:5000.</p>
        <p style="opacity:.4;margin-top:8px;font-size:12px">${err.message}</p>
        <a href="index.html" style="display:inline-block;margin-top:32px;color:inherit">← Torna all'indice</a>
      </main>`;
    return;
  }

  if (!decade) {
    document.body.innerHTML = "<main class='error-state'>Decade data could not be loaded.</main>";
    return;
  }

  selectedFilm = decade.films[0] || null;
  ensureCompareButton();
  ensureExtraCharts();
  renderHeader();
  renderGenreOverview();
  renderFilmList();
  renderFilmDetail();
});