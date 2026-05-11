// comparison.js — versione async
// Unica differenza rispetto all'originale: DOMContentLoaded è async
// e attende getDecadeData() prima di leggere DECADE_DB.

const comparisonParams = new URLSearchParams(window.location.search);
const comparisonDecadeLabel = comparisonParams.get("decade");
const comparisonRank = Number.parseInt(comparisonParams.get("rank") || "1", 10);

// Dichiarati con let perché vengono assegnati dopo il fetch
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
  slopeChart:       document.getElementById("slopeChart"),
  takeawayLead:     document.getElementById("takeawayLead"),
  takeawaySupport:  document.getElementById("takeawaySupport"),
};

function renderComparisonHeader() {
  document.documentElement.style.setProperty("--page-accent", comparisonDecade.meta.accent);
  document.title = `${comparisonFilm.title} vs ${comparisonDecade.label}`;

  comparisonNodes.pageTitle.textContent = `${comparisonFilm.title} vs ${comparisonDecade.label}`;
  comparisonNodes.pageSubtitle.textContent = comparisonDecade.meta.blurb;

  comparisonNodes.heroFilmTitle.textContent = comparisonFilm.title;
  comparisonNodes.heroFilmMeta.textContent =
    `${comparisonFilm.year} · rank #${comparisonFilm.rank} · ${formatNumber(comparisonFilm.rating)}/10`;

  comparisonNodes.heroDecadeTitle.textContent = `${comparisonDecade.label} average`;
  comparisonNodes.heroDecadeMeta.textContent =
    `${comparisonDecade.filmCount} films · ${formatNumber(comparisonDecade.avgRating)}/10 · ${Math.round(comparisonDecade.avgRuntime)} min`;

  comparisonNodes.backLinks.forEach((link) => {
    link.href = `${comparisonDecade.label}.html`;
  });
}

function buildMetricGrid() {
  const items = [
    {
      label: "Rating delta",
      value: `${comparisonFilm.rating >= comparisonDecade.avgRating ? "+" : ""}${formatNumber(comparisonFilm.rating - comparisonDecade.avgRating)}`,
      note: `Compared with ${formatNumber(comparisonDecade.avgRating)}/10 average`,
    },
    {
      label: "Popularity",
      value: formatVotes(comparisonFilm.votes),
      note: `${formatVotes(comparisonDecade.avgVotes)} typical votes`,
    },
    {
      label: "Runtime delta",
      value: `${(comparisonFilm.runtime || 0) - Math.round(comparisonDecade.avgRuntime) >= 0 ? "+" : ""}${(comparisonFilm.runtime || 0) - Math.round(comparisonDecade.avgRuntime)} min`,
      note: `Compared with ${Math.round(comparisonDecade.avgRuntime)} min average`,
    },
    {
      label: "Genre overlap",
      value: `${(comparisonFilm.genres || []).filter((g) => comparisonDecade.genreStats.some((e) => e.genre === g)).length}/${(comparisonFilm.genres || []).length}`,
      note: "Film genres appearing in the decade ranking",
    },
  ];

  comparisonNodes.metricGrid.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "metric-card";
    const decadeValue =
      item.label === "Rating delta"   ? `${formatNumber(comparisonDecade.avgRating)}/10`
      : item.label === "Popularity"   ? formatVotes(comparisonDecade.avgVotes)
      : item.label === "Runtime delta" ? `${Math.round(comparisonDecade.avgRuntime)} min`
      : `${(comparisonFilm.genres || []).filter((g) => comparisonDecade.genreStats.some((e) => e.genre === g)).length} shared`;
    card.innerHTML = `
      <strong class="metric-card__film">${item.value}</strong>
      <span class="metric-card__label">${item.label}</span>
      <strong class="metric-card__decade">${decadeValue}</strong>
      <small>${item.note}</small>
    `;
    comparisonNodes.metricGrid.appendChild(card);
  });
}

function buildProfileRows() {
  const filmRuntime   = comparisonFilm.runtime || 0;
  const decadeRuntime = comparisonDecade.avgRuntime || 0;
  const maxVotes   = Math.max(comparisonFilm.votes, comparisonDecade.avgVotes) || 1;
  const maxRuntime = Math.max(filmRuntime, comparisonDecade.maxRuntime || decadeRuntime) || 1;

  const metrics = [
    { label: "IMDb rating", film: comparisonFilm.rating,   decade: comparisonDecade.avgRating,  max: 10,        formatter: (v) => `${formatNumber(v)}/10` },
    { label: "Votes",       film: comparisonFilm.votes,    decade: comparisonDecade.avgVotes,   max: maxVotes,  formatter: (v) => formatVotes(v) },
    { label: "Runtime",     film: filmRuntime,             decade: decadeRuntime,               max: maxRuntime, formatter: (v) => `${Math.round(v)} min` },
  ];

  comparisonNodes.profileRows.innerHTML = "";
  metrics.forEach((metric) => {
    const row = document.createElement("div");
    row.className = "profile-row";
    row.innerHTML = `
      <div class="profile-row__header">
        <span>${metric.label}</span>
        <small>${metric.formatter(metric.film)} vs ${metric.formatter(metric.decade)}</small>
      </div>
      <div class="profile-row__track">
        <div class="profile-row__fill film"   style="width:${clampPercent(metric.film,   metric.max)}%"></div>
        <div class="profile-row__fill decade" style="width:${clampPercent(metric.decade, metric.max)}%"></div>
      </div>
      <div class="profile-row__footer">
        <span>This film</span>
        <span>Decade average</span>
      </div>
    `;
    comparisonNodes.profileRows.appendChild(row);
  });
}

function buildGenreRows() {
  const filmGenres = comparisonFilm.genres || [];
  const combinedGenres = Array.from(
    new Set([
      ...filmGenres,
      ...comparisonDecade.genreStats.slice(0, 5).map((e) => e.genre),
    ])
  ).slice(0, 7);

  comparisonNodes.genreRows.innerHTML = "";
  combinedGenres.forEach((genre) => {
    const entry      = comparisonDecade.genreStats.find((e) => e.genre === genre);
    const decadeVal  = entry ? entry.percentage : 0;
    const filmVal    = filmGenres.includes(genre) ? 100 : 0;
    const row        = document.createElement("div");
    row.className    = "genre-row";
    row.innerHTML    = `
      <span>${genre}</span>
      <div class="genre-row__bars">
        <div class="genre-row__bar film"   style="width:${filmVal}%"></div>
        <div class="genre-row__bar decade" style="width:${decadeVal}%"></div>
      </div>
      <small>${decadeVal}% decade presence</small>
    `;
    comparisonNodes.genreRows.appendChild(row);
  });
}

function buildPlacementTrack() {
  comparisonNodes.placementTrack.innerHTML = "";
  comparisonDecade.films.forEach((film) => {
    const item = document.createElement("div");
    item.className = `placement-item${film.rank === comparisonFilm.rank ? " active" : ""}`;
    item.innerHTML = `<span>#${film.rank}</span><small>${formatNumber(film.rating)}</small>`;
    comparisonNodes.placementTrack.appendChild(item);
  });

  const popularityRank = getFilmPercentile(comparisonFilm, comparisonDecade.films, "votes");
  comparisonNodes.placementSummary.textContent =
    `${comparisonFilm.title} ranks #${comparisonFilm.rank} by IMDb score in the ${comparisonDecade.label} sample` +
    ` and ${popularityRank ? `#${popularityRank.rank}` : "outside the ranked list"} by vote count within the same decade.`;
}

function buildSlopeChart() {
  const width  = 560;
  const height = 260;
  const leftX  = 170;
  const rightX = 390;
  const top    = 36;
  const bottom = 220;
  const scaleY = (v) => top + (1 - v) * (bottom - top);

  const filmRuntime   = comparisonFilm.runtime || 0;
  const decadeRuntime = comparisonDecade.avgRuntime || 0;

  const normalized = [
    { label: "Rating",  film: comparisonFilm.rating / 10, decade: comparisonDecade.avgRating / 10 },
    { label: "Votes",   film: comparisonFilm.votes / Math.max(comparisonFilm.votes, comparisonDecade.avgVotes, 1), decade: comparisonDecade.avgVotes / Math.max(comparisonFilm.votes, comparisonDecade.avgVotes, 1) },
    { label: "Runtime", film: filmRuntime / Math.max(filmRuntime, decadeRuntime, 1), decade: decadeRuntime / Math.max(filmRuntime, decadeRuntime, 1) },
  ];

  const guides = [0.25, 0.5, 0.75, 1]
    .map((t) => `<line x1="110" y1="${scaleY(t)}" x2="450" y2="${scaleY(t)}" class="slope-grid"></line>`)
    .join("");

  const labels = normalized.map((m) => {
    const fy = scaleY(m.film);
    const dy = scaleY(m.decade);
    return `
      <line x1="${leftX}" y1="${fy}" x2="${rightX}" y2="${dy}" class="slope-link"></line>
      <circle cx="${leftX}" cy="${fy}" r="6" class="slope-point slope-point--film"></circle>
      <circle cx="${rightX}" cy="${dy}" r="6" class="slope-point slope-point--decade"></circle>
      <text x="${leftX - 18}" y="${fy + 4}" text-anchor="end" class="slope-label">${m.label}</text>
      <text x="${rightX + 18}" y="${dy + 4}" class="slope-label">${m.label}</text>
    `;
  }).join("");

  comparisonNodes.slopeChart.innerHTML = `
    ${guides}
    <line x1="${leftX}" y1="${top}" x2="${leftX}" y2="${bottom}" class="slope-axis"></line>
    <line x1="${rightX}" y1="${top}" x2="${rightX}" y2="${bottom}" class="slope-axis"></line>
    <text x="${leftX}" y="18" text-anchor="middle" class="slope-title">This film</text>
    <text x="${rightX}" y="18" text-anchor="middle" class="slope-title">Decade avg</text>
    ${labels}
  `;
}

function buildTakeaway() {
  const filmGenres    = comparisonFilm.genres || [];
  const ratingDelta   = comparisonFilm.rating - comparisonDecade.avgRating;
  const voteDelta     = comparisonFilm.votes  - comparisonDecade.avgVotes;
  const strongestGenre = filmGenres
    .map((g) => comparisonDecade.genreStats.find((e) => e.genre === g))
    .filter(Boolean)
    .sort((a, b) => b.percentage - a.percentage)[0];

  comparisonNodes.takeawayLead.textContent =
    `${comparisonFilm.title} is ${ratingDelta >= 0 ? "above" : "below"} the decade's average rating by ${Math.abs(ratingDelta).toFixed(1)} points` +
    ` and ${voteDelta >= 0 ? "over-indexes" : "under-indexes"} on audience attention by ${formatVotes(Math.abs(voteDelta))}.`;

  comparisonNodes.takeawaySupport.textContent = strongestGenre
    ? `${strongestGenre.genre} is the film's strongest historical fit: it appears in ${strongestGenre.percentage}% of the decade's ranked titles.`
    : "Its genre profile is relatively uncommon within the decade ranking, suggesting that the film stands out from the mainstream mix of the period.";
}

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (!comparisonDecadeLabel) {
    document.body.innerHTML = "<main class='error-state'>Nessuna decade specificata nell'URL.</main>";
    return;
  }

  try {
    await getDecadeData(comparisonDecadeLabel);
    comparisonDecade = getDecadeRecord(comparisonDecadeLabel);
  } catch (err) {
    document.body.innerHTML = `
      <main style="padding:60px 32px;font-family:serif;color:#e8d5a3;background:#05050f;min-height:100vh">
        <p style="opacity:.5;letter-spacing:3px;font-size:11px;text-transform:uppercase">Errore</p>
        <h1 style="font-size:36px;margin-top:12px">Impossibile caricare ${comparisonDecadeLabel}</h1>
        <p style="opacity:.6;margin-top:16px">Assicurati che il server Flask sia avviato su localhost:5000.</p>
        <p style="opacity:.4;margin-top:8px;font-size:12px">${err.message}</p>
        <a href="index.html" style="display:inline-block;margin-top:32px;color:inherit">← Torna all'indice</a>
      </main>
    `;
    return;
  }

  if (!comparisonDecade) {
    document.body.innerHTML = "<main class='error-state'>The requested film comparison could not be loaded.</main>";
    return;
  }

  comparisonFilm = comparisonDecade.films.find((f) => f.rank === comparisonRank) || comparisonDecade.films[0];

  if (!comparisonFilm) {
    document.body.innerHTML = "<main class='error-state'>Film not found.</main>";
    return;
  }

  renderComparisonHeader();
  buildMetricGrid();
  buildProfileRows();
  buildGenreRows();
  buildPlacementTrack();
  buildSlopeChart();
  buildTakeaway();
});