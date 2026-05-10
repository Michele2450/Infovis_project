// ─── decade.js ────────────────────────────────────────────────────────────────
// Unica differenza rispetto alla versione originale:
//   1. Il blocco DOMContentLoaded è async e attende getDecadeData()
//   2. DECADE_DB[decadeLabel] viene popolato prima di chiamare getDecadeRecord()
//   3. Tutto il resto del file è identico all'originale
// ──────────────────────────────────────────────────────────────────────────────

const decadeLabel = document.body.dataset.decade;
let selectedFilm = null;

// decade verrà assegnato dopo il fetch, quindi lo dichiariamo con let
let decade = null;

const nodes = {
  pageAccent: document.documentElement,
  decadeTitle: document.getElementById("decadeTitle"),
  decadeTheme: document.getElementById("decadeTheme"),
  decadeBlurb: document.getElementById("decadeBlurb"),
  statRating: document.getElementById("statRating"),
  statRuntime: document.getElementById("statRuntime"),
  statVotes: document.getElementById("statVotes"),
  statGenres: document.getElementById("statGenres"),
  decadeTopFilm: document.getElementById("decadeTopFilm"),
  decadeTopFilmMeta: document.getElementById("decadeTopFilmMeta"),
  genreOverview: document.getElementById("genreOverview"),
  filmList: document.getElementById("filmList"),
  detailTitle: document.getElementById("detailTitle"),
  detailMeta: document.getElementById("detailMeta"),
  detailSummary: document.getElementById("detailSummary"),
  detailGenres: document.getElementById("detailGenres"),
  detailStats: document.getElementById("detailStats"),
  compareLink: document.getElementById("compareLink"),
  insightLead: document.getElementById("insightLead"),
  insightSupport: document.getElementById("insightSupport"),
  prevLink: document.getElementById("prevLink"),
  nextLink: document.getElementById("nextLink"),
  leftColumn: document.querySelector(".left-column"),
  rightColumn: document.querySelector(".right-column"),
  detailCard: document.querySelector(".detail-card"),
  insightCard: document.querySelector(".insight-card"),
  listCard: document.querySelector(".list-card"),
  navTitle: document.querySelector(".topbar__center strong"),
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
  nodes.statRating.textContent = `${formatNumber(decade.avgRating)}/10`;
  nodes.statRuntime.textContent = `${Math.round(decade.avgRuntime)} min`;
  nodes.statVotes.textContent = formatVotes(decade.avgVotes);
  nodes.statGenres.textContent = String(decade.genreStats.length);

  if (decade.topRatedFilm) {
    nodes.decadeTopFilm.textContent = decade.topRatedFilm.title;
    nodes.decadeTopFilmMeta.textContent =
      `${decade.topRatedFilm.year} · rank #${decade.topRatedFilm.rank} · ${formatNumber(decade.topRatedFilm.rating)}/10`;
  }

  const prev = getPreviousDecade(decade.label);
  const next = getNextDecade(decade.label);

  if (prev) {
    nodes.prevLink.href = `${prev}.html`;
    nodes.prevLink.textContent = `← ${prev}`;
  } else {
    nodes.prevLink.removeAttribute("href");
    nodes.prevLink.textContent = "← First decade";
    nodes.prevLink.classList.add("is-disabled");
  }

  if (next) {
    nodes.nextLink.href = `${next}.html`;
    nodes.nextLink.textContent = `${next} →`;
  } else {
    nodes.nextLink.removeAttribute("href");
    nodes.nextLink.textContent = "Latest decade →";
    nodes.nextLink.classList.add("is-disabled");
  }
}

function renderGenreOverview() {
  nodes.genreOverview.innerHTML = "";

  decade.genreStats.slice(0, 6).forEach((genre) => {
    const row = document.createElement("div");
    row.className = "overview-bar";
    row.innerHTML = `
      <span>${genre.genre}</span>
      <div class="overview-bar__track">
        <div class="overview-bar__fill" style="width:${genre.percentage}%"></div>
      </div>
      <strong>${genre.percentage}%</strong>
    `;
    nodes.genreOverview.appendChild(row);
  });
}

function renderFilmList() {
  nodes.filmList.innerHTML = "";

  decade.films.forEach((film) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `film-list__item${selectedFilm && selectedFilm.rank === film.rank ? " active" : ""}`;
    item.innerHTML = `
      <span class="film-list__rank">#${film.rank}</span>
      <span class="film-list__body">
        <strong>${film.title}</strong>
        <small>${film.year} · ${film.director || "—"}</small>
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
  const ratingPercentile = getFilmPercentile(film, decade.films, "rating");
  const votePercentile = getFilmPercentile(film, decade.films, "votes");
  const runtimePercentile = getFilmPercentile(film, decade.films, "runtime");

  const stats = [
    {
      label: "IMDb rating",
      value: `${formatNumber(film.rating)}/10`,
      note: `${formatNumber(film.rating - decade.avgRating, 1)} vs avg`,
    },
    {
      label: "Votes",
      value: formatVotes(film.votes),
      note: votePercentile ? `popularity rank ${votePercentile.rank}/${votePercentile.total}` : "No ranking data",
    },
    {
      label: "Runtime",
      value: film.runtime ? `${film.runtime} min` : "N/A",
      note: runtimePercentile ? `length rank ${runtimePercentile.rank}/${runtimePercentile.total}` : "No ranking data",
    },
    {
      label: "Position in decade",
      value: `#${film.rank}`,
      note: ratingPercentile ? `top ${ratingPercentile.percentile}% by rating` : "No ranking data",
    },
  ];

  nodes.detailStats.innerHTML = "";

  stats.forEach((stat) => {
    const card = document.createElement("div");
    card.className = "detail-stat";
    card.innerHTML = `
      <span>${stat.label}</span>
      <strong>${stat.value}</strong>
      <small>${stat.note}</small>
    `;
    nodes.detailStats.appendChild(card);
  });
}

function renderInsight(film) {
  const ratingDelta = film.rating - decade.avgRating;
  const runtimeDelta = (film.runtime || decade.avgRuntime) - decade.avgRuntime;
  const genresInTopMix = (film.genres || [])
    .map((genre) => decade.genreStats.find((entry) => entry.genre === genre))
    .filter(Boolean)
    .sort((a, b) => b.percentage - a.percentage);

  const dominantGenre = genresInTopMix[0];
  const tone = ratingDelta >= 0 ? "outperforms" : "sits below";
  const durationTone = runtimeDelta >= 0 ? "longer" : "shorter";

  nodes.insightLead.textContent =
    `${film.title} ${tone} the typical ${decade.label} top film by ${Math.abs(ratingDelta).toFixed(1)} rating points and runs ${Math.abs(Math.round(runtimeDelta))} minutes ${durationTone} than average.`;

  if (dominantGenre) {
    nodes.insightSupport.textContent =
      `${dominantGenre.genre} is this film's closest link to the decade profile: it appears in ${dominantGenre.percentage}% of the ranked films for the period.`;
  } else {
    nodes.insightSupport.textContent =
      `Its genre mix is relatively unusual within the decade ranking, which makes it stand out from the dominant profile of the period.`;
  }
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
    sub: compareCard.querySelector("#compareButtonSub"),
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
      <svg class="scatter-svg" id="scatterPlot" viewBox="0 0 560 280" role="img" aria-label="Scatter plot of runtime versus rating"></svg>
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

  if (nodes.insightCard) {
    nodes.leftColumn.appendChild(nodes.insightCard);
  }

  nodes.leftColumn.appendChild(donutCard);
  nodes.leftColumn.appendChild(scatterCard);
  nodes.leftColumn.appendChild(distributionCard);

  chartNodes = {
    donutChart: document.getElementById("genreDonutChart"),
    donutLegend: document.getElementById("genreDonutLegend"),
    scatterPlot: document.getElementById("scatterPlot"),
    distributionBars: document.getElementById("distributionBars"),
    distributionCaption: document.getElementById("distributionCaption"),
  };
}

function polarToCartesian(cx, cy, radius, angle) {
  const radians = (angle - 90) * (Math.PI / 180);
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function renderGenreDonut(film) {
  const palette = [
    "var(--page-accent)",
    "#d9825b",
    "#c3a655",
    "#7ca09b",
    "#7f6db0",
    "#4f6272",
  ];

  const slices = decade.genreStats.slice(0, 5).map((entry) => ({ ...entry }));
  const totalShown = slices.reduce((sum, entry) => sum + entry.percentage, 0);
  if (totalShown < 100) {
    slices.push({ genre: "Other", percentage: 100 - totalShown });
  }

  let angle = 0;
  const segments = slices.map((slice, index) => {
    const sweep = (slice.percentage / 100) * 360;
    const startAngle = angle;
    const endAngle = angle + sweep;
    angle = endAngle;
    return {
      ...slice,
      color: palette[index % palette.length],
      path: describeArc(90, 90, 62, startAngle, endAngle),
    };
  });

  chartNodes.donutChart.innerHTML = `
    <svg viewBox="0 0 180 180" role="img" aria-label="Donut chart of decade genre composition">
      <circle cx="90" cy="90" r="62" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="24"></circle>
      ${segments.map((segment) => `<path d="${segment.path}" fill="none" stroke="${segment.color}" stroke-width="24" stroke-linecap="butt"></path>`).join("")}
      <circle cx="90" cy="90" r="40" fill="rgba(7,12,18,0.96)"></circle>
      <text x="90" y="82" text-anchor="middle" class="donut-value">${film.genres ? film.genres.length : 0}</text>
      <text x="90" y="102" text-anchor="middle" class="donut-label">film genres</text>
    </svg>
  `;

  chartNodes.donutLegend.innerHTML = segments
    .map((segment) => `
      <div class="legend-row${film.genres && film.genres.includes(segment.genre) ? " active" : ""}">
        <span class="legend-swatch" style="background:${segment.color}"></span>
        <span>${segment.genre}</span>
        <strong>${segment.percentage}%</strong>
      </div>
    `)
    .join("");
}

function renderScatterPlot(film) {
  const width = 560;
  const height = 280;
  const margin = { top: 24, right: 18, bottom: 38, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const minRuntime = decade.minRuntime || 0;
  const maxRuntime = decade.maxRuntime || 1;

  const x = (runtime) =>
    margin.left + ((runtime - minRuntime) / Math.max(1, maxRuntime - minRuntime)) * plotWidth;
  const y = (rating) => margin.top + (1 - rating / 10) * plotHeight;

  const gridLines = [6, 7, 8, 9, 10]
    .map((tick) => `<line x1="${margin.left}" y1="${y(tick)}" x2="${width - margin.right}" y2="${y(tick)}" class="chart-grid"></line>`)
    .join("");

  const tickLabels = [6, 7, 8, 9, 10]
    .map((tick) => `<text x="${margin.left - 12}" y="${y(tick) + 4}" class="chart-tick chart-tick--y">${tick.toFixed(1)}</text>`)
    .join("");

  const runtimeTicks = [minRuntime, Math.round((minRuntime + maxRuntime) / 2), maxRuntime]
    .map((tick) => `<text x="${x(tick)}" y="${height - 10}" text-anchor="middle" class="chart-tick">${tick}</text>`)
    .join("");

  const points = decade.films
    .filter((candidate) => candidate.runtime)
    .map((candidate) => `
      <circle
        cx="${x(candidate.runtime)}"
        cy="${y(candidate.rating)}"
        r="${candidate.rank === film.rank ? 7 : 4.5}"
        class="${candidate.rank === film.rank ? "chart-point chart-point--active" : "chart-point"}">
      </circle>
    `)
    .join("");

  chartNodes.scatterPlot.innerHTML = `
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" class="chart-axis"></line>
    <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" class="chart-axis"></line>
    ${gridLines}
    ${tickLabels}
    ${runtimeTicks}
    ${points}
    <text x="${width / 2}" y="${height - 4}" text-anchor="middle" class="chart-label">Runtime (minutes)</text>
    <text x="16" y="${height / 2}" text-anchor="middle" class="chart-label" transform="rotate(-90 16 ${height / 2})">IMDb rating</text>
  `;
}

function renderDistribution(film) {
  const bins = [
    { min: 6.5, max: 7.0, label: "6.5–6.9" },
    { min: 7.0, max: 7.5, label: "7.0–7.4" },
    { min: 7.5, max: 8.0, label: "7.5–7.9" },
    { min: 8.0, max: 8.5, label: "8.0–8.4" },
    { min: 8.5, max: 9.5, label: "8.5+" },
  ];

  bins.forEach((bin) => {
    bin.count = decade.films.filter((candidate) => candidate.rating >= bin.min && candidate.rating < bin.max).length;
  });

  const activeBin = bins.find((bin) => film.rating >= bin.min && film.rating < bin.max) || bins[bins.length - 1];
  const maxCount = Math.max(...bins.map((bin) => bin.count), 1);

  chartNodes.distributionBars.innerHTML = bins
    .map((bin) => `
      <div class="distribution-bar${bin.label === activeBin.label ? " active" : ""}">
        <div class="distribution-bar__column">
          <div class="distribution-bar__fill" style="height:${(bin.count / maxCount) * 100}%"></div>
        </div>
        <strong>${bin.count}</strong>
        <span>${bin.label}</span>
      </div>
    `)
    .join("");

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
  nodes.detailSummary.textContent = film.summary || "No summary available.";
  nodes.detailGenres.innerHTML = (film.genres || [])
    .map((genre) => `<li>${genre}</li>`)
    .join("");

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

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
// Rispetto all'originale: async + await getDecadeData() prima di tutto il resto
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Mostra uno stato di caricamento mentre arrivano i dati reali
  if (nodes.navTitle) nodes.navTitle.textContent = decadeLabel;

  try {
    // 1. Scarica i dati reali dall'API e li mette in DECADE_DB[decadeLabel]
    await getDecadeData(decadeLabel);

    // 2. catalog.js legge DECADE_DB e costruisce l'oggetto arricchito
    decade = getDecadeRecord(decadeLabel);
  } catch (err) {
    console.error("Impossibile caricare i dati della decade:", err);
    document.body.innerHTML = `
      <main style="padding:60px 32px;font-family:serif;color:#e8d5a3;background:#05050f;min-height:100vh">
        <p style="opacity:.5;letter-spacing:3px;font-size:11px;text-transform:uppercase">Errore</p>
        <h1 style="font-size:36px;margin-top:12px">Impossibile caricare ${decadeLabel}</h1>
        <p style="opacity:.6;margin-top:16px">Assicurati che il server Flask sia avviato su localhost:5000.</p>
        <p style="opacity:.4;margin-top:8px;font-size:12px">${err.message}</p>
        <a href="index.html" style="display:inline-block;margin-top:32px;color:inherit">← Torna all'indice</a>
      </main>
    `;
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
