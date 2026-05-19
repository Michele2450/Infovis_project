// Colori fissi per genere — consistenti in tutte le pagine e visualizzazioni
const GENRE_COLORS = {
  "Drama":       "#7b9fd4",
  "Comedy":      "#d9825b",
  "Action":      "#d4a84b",
  "Adventure":   "#6daa8f",
  "Crime":       "#c17fa0",
  "Thriller":    "#9b7fc4",
  "Romance":     "#d47b7b",
  "Horror":      "#888888",
  "Sci-Fi":      "#5bb8d4",
  "Animation":   "#e8c44a",
  "History":     "#a08050",
  "War":         "#708060",
  "Biography":   "#c4a46b",
  "Music":       "#8fb0d8",
  "Mystery":     "#9d7ec4",
  "Fantasy":     "#7bc4a0",
  "Family":      "#d4c04b",
  "Sport":       "#6db87b",
  "Western":     "#c49060",
  "Documentary": "#78a8b8",
  "Short":       "#a0a0a0",
  "Musical":     "#d48fb0",
  "Other":       "#606060",
};

function getGenreColor(genre) {
  return GENRE_COLORS[genre] || "#888888";
}

const decadeLabel = document.body.dataset.decade;
let selectedFilm = null;
let decade = null;

const nodes = {
  decadeTitle:       document.getElementById("decadeTitle"),
  decadeTheme:       document.getElementById("decadeTheme"),
  decadeBlurb:       document.getElementById("decadeBlurb"),
  statRating:        document.getElementById("statRating"),
  statRuntime:       document.getElementById("statRuntime"),
  statVotes:         document.getElementById("statVotes"),
  statGenres:        document.getElementById("statGenres"),
  decadeTopFilm:     document.getElementById("decadeTopFilm"),
  decadeTopFilmMeta: document.getElementById("decadeTopFilmMeta"),
  genreOverview:     document.getElementById("genreOverview"),
  filmList:          document.getElementById("filmList"),
  detailTitle:       document.getElementById("detailTitle"),
  detailMeta:        document.getElementById("detailMeta"),
  detailSummary:     document.getElementById("detailSummary"),
  detailGenres:      document.getElementById("detailGenres"),
  detailStats:       document.getElementById("detailStats"),
  compareLink:       document.getElementById("compareLink"),
  insightLead:       document.getElementById("insightLead"),
  insightSupport:    document.getElementById("insightSupport"),
  prevLink:          document.getElementById("prevLink"),
  nextLink:          document.getElementById("nextLink"),
  leftColumn:        document.querySelector(".left-column"),
  rightColumn:       document.querySelector(".right-column"),
  detailCard:        document.querySelector(".detail-card"),
  insightCard:       document.querySelector(".insight-card"),
  navTitle:          document.querySelector(".topbar__center strong"),
};

let chartNodes = null;
let compareButtonNode = null;
let activeBrowserGenres = new Set(["All Genres"]);

if (nodes.detailSummary) nodes.detailSummary.style.display = "none";

function renderHeader() {
  document.documentElement.style.setProperty("--page-accent", decade.meta.accent);
  document.title = `${decade.label} · Cinema by Decade`;
  if (nodes.navTitle) nodes.navTitle.textContent = `${decade.label} · ${decade.meta.theme}`;
  nodes.decadeTitle.textContent  = decade.label;
  nodes.decadeTheme.textContent  = decade.meta.theme;
  nodes.decadeBlurb.textContent  = decade.meta.blurb;
  nodes.statRating.textContent   = `${formatNumber(decade.avgRating)}/10`;
  nodes.statRuntime.textContent  = decade.avgRuntime ? `${Math.round(decade.avgRuntime)} min` : "N/A";
  nodes.statVotes.textContent    = formatVotes(decade.avgVotes);
  nodes.statGenres.textContent   = String(decade.genreStats.length);

  if (decade.topRatedFilm) {
    nodes.decadeTopFilm.textContent     = decade.topRatedFilm.title;
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
  const top      = decade.genreStats.slice(0, 6);
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
  const sorted = [...decade.films].sort((a, b) => b.rating - a.rating || a.rank - b.rank);
  sorted.forEach((film, idx) => {
    const item = document.createElement("button");
    item.type      = "button";
    item.className = `film-list__item${selectedFilm && selectedFilm.rank === film.rank ? " active" : ""}`;
    const maxLen       = 26;
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
    { label: "IMDb rating",        value: `${formatNumber(film.rating)}/10`,            note: `${formatNumber(film.rating - decade.avgRating, 1)} vs avg` },
    { label: "Votes",              value: formatVotes(film.votes),                       note: votePercentile    ? `popularity rank ${votePercentile.rank}/${votePercentile.total}`   : "—" },
    { label: "Runtime",            value: film.runtime ? `${film.runtime} min` : "N/A", note: runtimePercentile ? `length rank ${runtimePercentile.rank}/${runtimePercentile.total}` : "—" },
    { label: "Position in decade", value: `#${film.rank}`,                               note: ratingPercentile  ? `top ${ratingPercentile.percentile}% by rating`                   : "—" },
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
  const ratingDelta    = film.rating - decade.avgRating;
  const runtimeDelta   = (film.runtime || decade.avgRuntime) - (decade.avgRuntime || 0);
  const genresInTopMix = (film.genres || [])
    .map((g) => decade.genreStats.find((e) => e.genre === g))
    .filter(Boolean)
    .sort((a, b) => b.count - a.count);

  const dominantGenre = genresInTopMix[0];
  const tone          = ratingDelta >= 0 ? "outperforms" : "sits below";
  const durationTone  = runtimeDelta >= 0 ? "longer" : "shorter";

  nodes.insightLead.textContent =
    `${film.title} ${tone} the typical ${decade.label} top film by ${Math.abs(ratingDelta).toFixed(1)} rating points` +
    (film.runtime ? ` and runs ${Math.abs(Math.round(runtimeDelta))} minutes ${durationTone} than average.` : ".");

  nodes.insightSupport.textContent = dominantGenre
    ? `${dominantGenre.genre} is this film's closest link to the decade profile: it appears in ${dominantGenre.count} of the ${decade.films.length} ranked films.`
    : "Its genre mix is relatively unusual within the decade ranking.";
}

function ensureCompareButton() {
  if (compareButtonNode) return;
  const sec = document.createElement("section");
  sec.className = "compare-button-card";
  sec.innerHTML = `
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
  nodes.detailCard.insertAdjacentElement("afterend", sec);
  compareButtonNode = { link: sec.querySelector("#compareLink"), sub: sec.querySelector("#compareButtonSub") };
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
      <div class="scatter-tooltip" id="scatterTooltip" hidden></div>
      <svg class="scatter-svg" id="scatterPlot" viewBox="0 0 560 300" role="img"></svg>
    </div>
  `;

  const distCard = document.createElement("section");
  distCard.className = "viz-card";
  distCard.innerHTML = `
    <p class="eyebrow">Distribution</p>
    <h3>Rating spread in the decade</h3>
    <div class="distribution-bars" id="distributionBars"></div>
    <p class="ranking-caption" id="distributionCaption"></p>
  `;

  const browserCard = document.createElement("section");
  browserCard.className = "viz-card";
  browserCard.innerHTML = `
    <p class="eyebrow">Genre browser</p>
    <h3>Browse top films by genre</h3>
    <div class="genre-browser">
      <div class="genre-browser__filters" id="genreBrowserFilters"></div>
      <div class="genre-browser__grid" id="genreBrowserGrid"></div>
    </div>
  `;

  const similarCard = document.createElement("section");
  similarCard.className = "viz-card";
  similarCard.innerHTML = `
    <p class="eyebrow">Similarity</p>
    <h3>Most similar films in the decade</h3>
    <div class="similar-showcase" id="similarShowcase"></div>
  `;

  if (nodes.insightCard) nodes.leftColumn.appendChild(nodes.insightCard);
  nodes.leftColumn.appendChild(donutCard);
  nodes.leftColumn.appendChild(scatterCard);
  nodes.leftColumn.appendChild(distCard);
  nodes.leftColumn.appendChild(browserCard);
  nodes.leftColumn.appendChild(similarCard);

  chartNodes = {
    donutChart:          document.getElementById("genreDonutChart"),
    donutLegend:         document.getElementById("genreDonutLegend"),
    scatterPlot:         document.getElementById("scatterPlot"),
    scatterTooltip:      document.getElementById("scatterTooltip"),
    distributionBars:    document.getElementById("distributionBars"),
    distributionCaption: document.getElementById("distributionCaption"),
    genreBrowserFilters: document.getElementById("genreBrowserFilters"),
    genreBrowserGrid:    document.getElementById("genreBrowserGrid"),
    similarShowcase:     document.getElementById("similarShowcase"),
  };
}

function getSharedGenreCount(a, b) {
  return (a.genres || []).filter((genre) => (b.genres || []).includes(genre)).length;
}

function getMostSimilarFilms(film) {
  const candidates = decade.films.filter((candidate) => candidate.rank !== film.rank);

  const byRating = [...candidates]
    .sort((a, b) =>
      Math.abs(a.rating - film.rating) - Math.abs(b.rating - film.rating) ||
      a.rank - b.rank
    )[0] || null;

  const byRuntime = [...candidates]
    .sort((a, b) =>
      Math.abs((a.runtime || 0) - (film.runtime || 0)) - Math.abs((b.runtime || 0) - (film.runtime || 0)) ||
      a.rank - b.rank
    )[0] || null;

  const byGenre = [...candidates]
    .sort((a, b) =>
      getSharedGenreCount(b, film) - getSharedGenreCount(a, film) ||
      Math.abs(a.rating - film.rating) - Math.abs(b.rating - film.rating) ||
      a.rank - b.rank
    )[0] || null;

  return { byRating, byRuntime, byGenre };
}

function polarToCartesian(cx, cy, r, angle) {
  const rad = (angle - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, s, e) {
  const p1 = polarToCartesian(cx, cy, r, e);
  const p2 = polarToCartesian(cx, cy, r, s);
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${e - s <= 180 ? "0" : "1"} 0 ${p2.x} ${p2.y}`;
}

function renderGenreDonut(film) {
  const topStats   = decade.genreStats.slice(0, 5);
  const total      = topStats.reduce((s, e) => s + e.count, 0) || 1;
  const filmGenres = film.genres || [];

  let angle = 0;
  const segments = topStats.map((entry) => {
    const sweep = (entry.count / total) * 360;
    const seg   = { genre: entry.genre, count: entry.count, color: getGenreColor(entry.genre), path: describeArc(90, 90, 62, angle, angle + sweep) };
    angle += sweep;
    return seg;
  });

  chartNodes.donutChart.innerHTML = `
    <div class="donut-tooltip" id="genreDonutTooltip" hidden></div>
    <svg viewBox="0 0 180 180" role="img">
      <circle cx="90" cy="90" r="62" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="24"></circle>
      ${segments.map((s) => `
        <path
          class="donut-segment"
          d="${s.path}"
          fill="none"
          stroke="${s.color}"
          stroke-width="24"
          stroke-linecap="butt"
          data-genre="${s.genre}"
          data-count="${s.count}">
        </path>
      `).join("")}
      <circle cx="90" cy="90" r="40" fill="rgba(7,12,18,0.96)"></circle>
      <text x="90" y="82"  text-anchor="middle" class="donut-value">${filmGenres.length}</text>
      <text x="90" y="102" text-anchor="middle" class="donut-label">film genres</text>
    </svg>
  `;

  chartNodes.donutLegend.innerHTML = segments.map((s) => `
    <div class="legend-row${filmGenres.includes(s.genre) ? " active" : ""}">
      <span class="legend-swatch" style="background:${s.color}"></span>
      <span>${s.genre}</span>
      <strong>${s.count}/${decade.films.length} films</strong>
    </div>
  `).join("");

  const tooltip = chartNodes.donutChart.querySelector("#genreDonutTooltip");
  chartNodes.donutChart.querySelectorAll(".donut-segment").forEach((segmentNode) => {
    segmentNode.addEventListener("mouseenter", () => {
      tooltip.hidden = false;
      tooltip.textContent =
        `${segmentNode.dataset.genre}: ${segmentNode.dataset.count}/${decade.films.length} films`;
      segmentNode.classList.add("is-hovered");
    });

    segmentNode.addEventListener("mousemove", (event) => {
      const bounds = chartNodes.donutChart.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - bounds.left + 12}px`;
      tooltip.style.top = `${event.clientY - bounds.top - 12}px`;
    });

    segmentNode.addEventListener("mouseleave", () => {
      tooltip.hidden = true;
      segmentNode.classList.remove("is-hovered");
    });
  });
}

function renderScatterPlot(film) {
  const w = 560, h = 300;
  const m = { top: 30, right: 24, bottom: 44, left: 52 };
  const withRuntime = decade.films.filter((f) => f.runtime);

  if (!withRuntime.length) {
    chartNodes.scatterPlot.innerHTML = `<text x="280" y="150" text-anchor="middle" style="fill:rgba(232,213,163,0.4);font-size:13px">No runtime data available</text>`;
    return;
  }

  // Assi fissi: rating 0-10, runtime 0-max arrotondato a 30min
  const ratingMax  = 10;
  const runtimeMax = Math.ceil(Math.max(...withRuntime.map(f => f.runtime)) / 30) * 30;

  const pw = w - m.left - m.right;
  const ph = h - m.top  - m.bottom;
  const x  = rt   => m.left + (rt   / runtimeMax) * pw;
  const y  = rate => m.top  + (1 - rate / ratingMax) * ph;

  // Grid orizzontale
  const hGrid = [2, 4, 6, 8, 10].map(t => `
    <line x1="${m.left}" y1="${y(t).toFixed(1)}" x2="${w-m.right}" y2="${y(t).toFixed(1)}" stroke="rgba(232,213,163,0.1)" stroke-dasharray="3 5"></line>
    <text x="${m.left-8}" y="${y(t)+4}" text-anchor="end" style="fill:rgba(232,213,163,0.55);font-size:11px">${t}</text>
  `).join("");

  // Grid verticale
  const rtStep = runtimeMax <= 120 ? 30 : runtimeMax <= 210 ? 60 : 90;
  const vTicks = [];
  for (let t = 0; t <= runtimeMax; t += rtStep) vTicks.push(t);
  const vGrid = vTicks.map(t => `
    <line x1="${x(t).toFixed(1)}" y1="${m.top}" x2="${x(t).toFixed(1)}" y2="${h-m.bottom}" stroke="rgba(232,213,163,0.07)" stroke-dasharray="3 5"></line>
    <text x="${x(t).toFixed(1)}" y="${h-m.bottom+14}" text-anchor="middle" style="fill:rgba(232,213,163,0.45);font-size:11px">${t}</text>
  `).join("");

  // Punti colorati per genere
  const points = withRuntime.map(f => {
    const isActive = f.rank === film.rank;
    const genre    = (f.genres && f.genres[0]) ? f.genres[0] : "Other";
    const color    = isActive ? "#d4a84b" : getGenreColor(genre);
    const r        = isActive ? 9 : 6;
    const opacity  = isActive ? 1 : 0.75;
    const stroke   = isActive ? "rgba(232,213,163,0.7)" : "rgba(0,0,0,0.3)";
    return `<circle cx="${x(f.runtime).toFixed(1)}" cy="${y(f.rating).toFixed(1)}"
      r="${r}" data-rank="${f.rank}" data-title="${f.title}" data-rating="${formatNumber(f.rating)}" data-year="${f.year}" data-runtime="${f.runtime}" style="fill:${color};opacity:${opacity};cursor:pointer;stroke:${stroke};stroke-width:1.5"
      title="${f.title} (${f.year}) — ${formatNumber(f.rating)}/10">
    </circle>`;
  }).join("");

  chartNodes.scatterPlot.setAttribute("viewBox", `0 0 ${w} ${h}`);
  chartNodes.scatterPlot.innerHTML = `
    <rect x="${m.left}" y="${m.top}" width="${pw}" height="${ph}" style="fill:rgba(232,213,163,0.02);stroke:rgba(232,213,163,0.15);stroke-width:1"></rect>
    ${hGrid}${vGrid}
    <line x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${h-m.bottom}" style="stroke:rgba(232,213,163,0.35);stroke-width:1"></line>
    <line x1="${m.left}" y1="${h-m.bottom}" x2="${w-m.right}" y2="${h-m.bottom}" style="stroke:rgba(232,213,163,0.35);stroke-width:1"></line>
    ${points}
    <text x="${m.left + pw/2}" y="${h-4}" text-anchor="middle" style="fill:rgba(232,213,163,0.5);font-size:12px">Runtime (minutes)</text>
    <text x="14" y="${m.top + ph/2}" text-anchor="middle" style="fill:rgba(232,213,163,0.5);font-size:12px" transform="rotate(-90 14 ${m.top + ph/2})">IMDb rating</text>
  `;

  // Click e hover
  chartNodes.scatterPlot.querySelectorAll("circle[data-rank]").forEach((circle) => {
    circle.addEventListener("click", () => {
      const clicked = decade.films.find(f => f.rank === parseInt(circle.dataset.rank, 10));
      if (clicked) {
        selectedFilm = clicked;
        renderFilmList();
        renderFilmDetail();
        const leftCol = document.querySelector(".left-column");
        if (leftCol) leftCol.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
    circle.addEventListener("mouseenter", () => {
      circle.setAttribute("r", String(parseInt(circle.getAttribute("r")) + 2));
      if (chartNodes.scatterTooltip) {
        chartNodes.scatterTooltip.hidden = false;
        chartNodes.scatterTooltip.innerHTML = `
          <strong>${circle.dataset.title}</strong><br>
          Rating: ${circle.dataset.rating}/10<br>
          Runtime: ${circle.dataset.runtime} min<br>
          Year: ${circle.dataset.year}
        `;
      }
    });
    circle.addEventListener("mousemove", (event) => {
      if (!chartNodes.scatterTooltip) return;
      const bounds = chartNodes.scatterPlot.getBoundingClientRect();
      chartNodes.scatterTooltip.style.left = `${event.clientX - bounds.left + 12}px`;
      chartNodes.scatterTooltip.style.top = `${event.clientY - bounds.top - 12}px`;
    });
    circle.addEventListener("mouseleave", () => {
      const isActive = parseInt(circle.dataset.rank) === film.rank;
      circle.setAttribute("r", isActive ? "9" : "6");
      if (chartNodes.scatterTooltip) chartNodes.scatterTooltip.hidden = true;
    });
  });
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

function renderGenreBrowser() {
  if (!chartNodes || !chartNodes.genreBrowserFilters || !chartNodes.genreBrowserGrid) return;

  const visibleGenres = decade.genreStats.slice(0, 6).map((entry) => entry.genre);
  const hiddenGenres = decade.genreStats.slice(6).map((entry) => entry.genre);

  const filterButtons = ["All Genres", ...visibleGenres];
  const moreOptions = hiddenGenres.length
    ? `
      <select class="genre-browser__more" id="genreBrowserMore">
        <option value="">More</option>
        ${hiddenGenres.map((genre) => `<option value="${genre}">${genre}</option>`).join("")}
      </select>
    `
    : "";

  chartNodes.genreBrowserFilters.innerHTML = `
    ${filterButtons.map((genre) => `
      <button
        type="button"
        class="genre-browser__chip${activeBrowserGenres.has(genre) ? " active" : ""}"
        data-genre="${genre}">
        ${genre}
      </button>
    `).join("")}
    ${moreOptions}
  `;

  chartNodes.genreBrowserFilters.querySelectorAll(".genre-browser__chip").forEach((button) => {
    button.addEventListener("click", () => {
      const genre = button.dataset.genre;
      if (genre === "All Genres") {
        activeBrowserGenres = new Set(["All Genres"]);
      } else {
        if (activeBrowserGenres.has("All Genres")) activeBrowserGenres.delete("All Genres");
        if (activeBrowserGenres.has(genre)) activeBrowserGenres.delete(genre);
        else activeBrowserGenres.add(genre);
        if (activeBrowserGenres.size === 0) activeBrowserGenres = new Set(["All Genres"]);
      }
      renderGenreBrowser();
    });
  });

  const moreSelect = chartNodes.genreBrowserFilters.querySelector("#genreBrowserMore");
  if (moreSelect) {
    moreSelect.addEventListener("change", (event) => {
      if (event.target.value) {
        if (activeBrowserGenres.has("All Genres")) activeBrowserGenres.delete("All Genres");
        activeBrowserGenres.add(event.target.value);
        renderGenreBrowser();
      }
    });
  }

  const selectedGenres = Array.from(activeBrowserGenres).filter((g) => g !== "All Genres");
  const visibleFilms = selectedGenres.length === 0
    ? decade.films
    : decade.films.filter((film) =>
      selectedGenres.every((genre) => (film.genres || []).includes(genre))
    );

  chartNodes.genreBrowserGrid.innerHTML = visibleFilms
    .map((film) => `
      <button
        type="button"
        class="genre-browser__card${selectedFilm && selectedFilm.rank === film.rank ? " active" : ""}"
        data-rank="${film.rank}">
        <div class="genre-browser__title">${film.title}</div>
        <div class="genre-browser__year">${film.year}</div>
        <div class="genre-browser__rating">★ ${formatNumber(film.rating)}</div>
        <div class="genre-browser__runtime">${film.runtime || "N/A"}${film.runtime ? " min" : ""}</div>
        <div class="genre-browser__genres">${(film.genres || []).slice(0, 3).join(", ")}</div>
      </button>
    `)
    .join("");

  chartNodes.genreBrowserGrid.querySelectorAll(".genre-browser__card").forEach((card) => {
    card.addEventListener("click", () => {
      const rank = Number.parseInt(card.dataset.rank, 10);
      selectedFilm = decade.films.find((film) => film.rank === rank) || selectedFilm;
      renderFilmList();
      renderFilmDetail();
      renderGenreBrowser();
    });
  });
}

function renderSimilarShowcase() {
  if (!chartNodes || !chartNodes.similarShowcase || !selectedFilm) return;

  const film = selectedFilm;
  const { byRating, byRuntime, byGenre } = getMostSimilarFilms(film);

  function renderPosterBlock(movie, label) {
    if (!movie) {
      return `
        <article class="similar-card">
          <div class="similar-card__label">${label}</div>
          <div class="similar-card__empty">No match</div>
        </article>
      `;
    }

    const posterMarkup = movie.poster
      ? `<img class="similar-card__poster" src="${movie.poster}" alt="${movie.title} poster">`
      : `<div class="similar-card__poster similar-card__poster--placeholder">${movie.title}</div>`;

    return `
      <article class="similar-card" data-rank="${movie.rank}">
        <div class="similar-card__label">${label}</div>
        ${posterMarkup}
        <div class="similar-card__body">
          <strong class="similar-card__title">${movie.title}</strong>
          <div class="similar-card__meta">${movie.year} · ${movie.runtime || "N/A"}${movie.runtime ? " min" : ""}</div>
          <div class="similar-card__rating">★ ${formatNumber(movie.rating)}</div>
          <button type="button" class="similar-card__button" data-rank="${movie.rank}">
            View details
          </button>
        </div>
      </article>
    `;
  }

  const selectedPoster = film.poster
    ? `<img class="similar-selected__poster" src="${film.poster}" alt="${film.title} poster">`
    : `<div class="similar-selected__poster similar-selected__poster--placeholder">${film.title}</div>`;

  chartNodes.similarShowcase.innerHTML = `
    <div class="similar-layout">
      <article class="similar-selected">
        <div class="similar-selected__label">Selected film</div>
        ${selectedPoster}
        <div class="similar-selected__body">
          <strong class="similar-selected__title">${film.title}</strong>
          <div class="similar-selected__meta">${film.year} · ${film.runtime || "N/A"}${film.runtime ? " min" : ""}</div>
          <div class="similar-selected__stats">★ ${formatNumber(film.rating)} · ${formatVotes(film.votes)} votes</div>
          <div class="similar-selected__genres">${(film.genres || []).join(", ")}</div>
        </div>
      </article>

      <div class="similar-results">
        <div class="similar-results__heading">Most similar in the decade</div>
        <div class="similar-results__grid">
          ${renderPosterBlock(byRating, "By rating")}
          ${renderPosterBlock(byRuntime, "By runtime")}
          ${renderPosterBlock(byGenre, "By genre")}
        </div>
      </div>
    </div>
  `;

  chartNodes.similarShowcase.querySelectorAll(".similar-card__button").forEach((button) => {
    button.addEventListener("click", () => {
      const rank = Number.parseInt(button.dataset.rank, 10);
      selectedFilm = decade.films.find((candidate) => candidate.rank === rank) || selectedFilm;
      renderFilmList();
      renderFilmDetail();
      renderGenreBrowser();
      renderSimilarShowcase();
    });
  });
}

function renderFilmDetail() {
  const film = selectedFilm || decade.films[0];
  if (!film) return;

  nodes.detailTitle.textContent = film.title;
  nodes.detailMeta.innerHTML =
    `<span class="detail-year-badge">${film.year}</span>` +
    `<span class="detail-rating-stack"><strong>${formatNumber(film.rating)}</strong><small>/10 · ${formatVotes(film.votes)} IMDb votes</small></span>` +
    `<span class="detail-meta-line">${film.director || "Unknown director"} · ${film.runtime ? film.runtime + " min" : "runtime N/A"}</span>`;

  const oldPoster = nodes.detailCard.querySelector(".detail-card__poster");
  if (oldPoster) oldPoster.remove();

  if (film.poster) {
    const img = document.createElement("img");
    img.src = film.poster; img.alt = film.title; img.className = "detail-card__poster";
    nodes.detailCard.prepend(img);
    nodes.detailCard.classList.add("has-poster");
  } else {
    nodes.detailCard.classList.remove("has-poster");
  }

  if (nodes.detailSummary) nodes.detailSummary.style.display = "none";

  if (nodes.detailGenres) {
    const genres = film.genres || [];
    if (genres.length > 0) {
      nodes.detailGenres.style.display = "";
      nodes.detailGenres.innerHTML = genres.map((g) => `<li>${g}</li>`).join("");
    } else {
      nodes.detailGenres.style.display = "none";
    }
  }

  renderFilmStats(film);
  renderInsight(film);
  renderGenreDonut(film);
  renderScatterPlot(film);
  renderDistribution(film);
  renderGenreBrowser();
  renderSimilarShowcase();

  if (compareButtonNode) compareButtonNode.sub.textContent = `"${film.title}" vs. avg of the ${decade.label}`;
  if (nodes.compareLink) nodes.compareLink.href = `comparison.html?decade=${decade.label}&rank=${film.rank}`;
}

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (nodes.navTitle) nodes.navTitle.textContent = decadeLabel;

  try {
    await getDecadeData(decadeLabel);
    decade = getDecadeRecord(decadeLabel);
  } catch (err) {
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
