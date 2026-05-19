const GENRES = [
  "Drama", "Crime", "Comedy", "Action", "Romance", "Sci-Fi", "Horror", "Documentary", "Adventure", "Animation",
];

const DECADE_COLORS = {
  "1900s": "#5a6f86",
  "1910s": "#5d7590",
  "1920s": "#6583a3",
  "1930s": "#6e8fb3",
  "1940s": "#7592ab",
  "1950s": "#9a8b64",
  "1960s": "#ab9360",
  "1970s": "#bd9a57",
  "1980s": "#c7a15b",
  "1990s": "#cea652",
  "2000s": "#d4ad4d",
  "2010s": "#dcb55b",
  "2020s": "#e3be68",
};

const state = {
  records: [],
  selectedGenres: new Set(["All Genres"]),
};

function safeNum(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadData() {
  await Promise.all(DECADE_ORDER.map((label) => getDecadeData(label)));
  state.records = DECADE_ORDER
    .map((label) => getDecadeRecord(label))
    .filter(Boolean);
}

function buildHeatmap() {
  const host = document.getElementById("heatmapChart");
  const legendBar = document.getElementById("heatmapLegendBar");
  const tooltip = document.getElementById("heatmapTooltip");
  if (!host) return;

  const decades = state.records.map((r) => r.label);
  const rows = GENRES.map((genre) => {
    const vals = state.records.map((record) => {
      const hit = (record.genreStats || []).find((g) => g.genre === genre);
      return hit ? safeNum(hit.percentage) : 0;
    });
    return { genre, vals };
  });

  const maxVal = Math.max(...rows.flatMap((r) => r.vals), 1);

  const w = 1160;
  const h = 392;
  const left = 118;
  const top = 12;
  const right = 20;
  const bottom = 44;

  const innerW = w - left - right;
  const innerH = h - top - bottom;

  const cw = innerW / decades.length;
  const ch = innerH / GENRES.length;

  const colorFor = (pct) => {
    const t = clamp(pct / maxVal, 0, 1);
    // Cinematic navy -> amber-gold palette
    const r = Math.round(22 + t * 214);
    const g = Math.round(28 + t * 178);
    const b = Math.round(44 + t * 78);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const yLabels = rows
    .map((row, i) => `<text class="tick-label" x="${left - 12}" y="${top + i * ch + ch * 0.63}" text-anchor="end">${esc(row.genre)}</text>`)
    .join("");

  const xLabels = decades
    .map((d, i) => `<text class="tick-label" x="${left + i * cw + cw * 0.5}" y="${h - 14}" text-anchor="middle">${esc(d)}</text>`)
    .join("");

  const cells = rows
    .map((row, y) => row.vals
      .map((v, x) => {
        const x0 = left + x * cw;
        const y0 = top + y * ch;
        return `<rect class="hm-cell" data-genre="${esc(row.genre)}" data-decade="${esc(decades[x])}" data-value="${v}" x="${x0 + 0.8}" y="${y0 + 0.8}" width="${cw - 1.6}" height="${ch - 1.6}" fill="${colorFor(v)}" opacity="0.92"></rect>`;
      })
      .join(""))
    .join("");

  host.innerHTML = `
    <svg class="heatmap-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Genres Across Decades heatmap">
      <rect x="${left}" y="${top}" width="${innerW}" height="${innerH}" fill="rgba(0,0,0,0.22)" stroke="rgba(232,213,163,0.18)"/>
      ${cells}
      ${yLabels}
      ${xLabels}
      <text class="axis-label" x="${left + innerW * 0.5}" y="${h - 1}" text-anchor="middle">Decade</text>
      <text class="axis-label" x="${left - 84}" y="${top - 10}">Genre</text>
    </svg>`;

  if (legendBar) {
    const c0 = colorFor(0);
    const c1 = colorFor(maxVal * 0.5);
    const c2 = colorFor(maxVal);
    legendBar.style.background = `linear-gradient(90deg, ${c0} 0%, ${c1} 50%, ${c2} 100%)`;
  }

  if (tooltip) {
    const wrap = host.closest(".chart-wrap");
    host.querySelectorAll(".hm-cell").forEach((cell) => {
      cell.addEventListener("mouseenter", (e) => {
        const genre = e.currentTarget.dataset.genre;
        const decade = e.currentTarget.dataset.decade;
        const value = e.currentTarget.dataset.value;
        e.currentTarget.setAttribute("stroke", "rgba(232,213,163,0.9)");
        e.currentTarget.setAttribute("stroke-width", "1.4");
        tooltip.innerHTML = `${esc(genre)} · ${esc(decade)}: <strong>${esc(value)}%</strong>`;
        tooltip.hidden = false;
      });
      cell.addEventListener("mousemove", (e) => {
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        const x = e.clientX - rect.left + 12;
        const y = e.clientY - rect.top + 12;
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
      });
      cell.addEventListener("mouseleave", (e) => {
        e.currentTarget.removeAttribute("stroke");
        e.currentTarget.removeAttribute("stroke-width");
        tooltip.hidden = true;
      });
    });
  }
}

function getAllGenres() {
  const set = new Set(["All Genres"]);
  state.records.forEach((record) => {
    (record.genreStats || []).forEach((g) => set.add(g.genre));
  });
  return Array.from(set);
}

function buildGenreFilters() {
  const host = document.getElementById("genreFilters");
  if (!host) return;

  const all = getAllGenres();
  const priority = ["All Genres", "Drama", "Crime", "Sci-Fi", "Comedy", "Horror", "Romance"];
  const chosen = [];
  priority.forEach((g) => { if (all.includes(g)) chosen.push(g); });
  all.forEach((g) => { if (!chosen.includes(g) && chosen.length < 12) chosen.push(g); });

  host.innerHTML = chosen
    .map((genre) => `<button class="genre-btn${state.selectedGenres.has(genre) ? " active" : ""}" data-genre="${esc(genre)}">${esc(genre)}</button>`)
    .join("");

  host.querySelectorAll(".genre-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const genre = btn.dataset.genre;
      if (genre === "All Genres") {
        state.selectedGenres = new Set(["All Genres"]);
      } else {
        if (state.selectedGenres.has("All Genres")) state.selectedGenres.delete("All Genres");
        if (state.selectedGenres.has(genre)) state.selectedGenres.delete(genre);
        else state.selectedGenres.add(genre);
        if (state.selectedGenres.size === 0) state.selectedGenres = new Set(["All Genres"]);
      }
      buildGenreFilters();
      buildLineChart();
    });
  });
}

function avgGenreRating(record, genres) {
  let sum = 0;
  let n = 0;
  (record.films || []).forEach((film) => {
    if (!Number.isFinite(film.rating)) return;
    if (genres.length && !genres.every((g) => (film.genres || []).includes(g))) return;
    sum += film.rating;
    n += 1;
  });
  if (n === 0) return null;
  return sum / n;
}

function selectedGenresLabel() {
  const selected = Array.from(state.selectedGenres).filter((g) => g !== "All Genres");
  if (!selected.length) return "All Genres";
  return selected.join(" + ");
}

function buildLineChart() {
  const host = document.getElementById("lineChart");
  if (!host) return;

  const decades = state.records.map((r) => r.label);
  const selected = Array.from(state.selectedGenres).filter((g) => g !== "All Genres");
  const values = state.records.map((record) => {
    if (!selected.length) return safeNum(record.avgRating, null);
    return avgGenreRating(record, selected);
  });

  const yMin = 0;
  const yMax = 10;

  const w = 1280;
  const h = 560;
  const left = 110;
  const top = 74;
  const right = 42;
  const bottom = 98;
  const innerW = w - left - right;
  const innerH = h - top - bottom;

  const xAt = (i) => left + (i / (decades.length - 1)) * innerW;
  const yAt = (v) => top + ((yMax - v) / (yMax - yMin || 1)) * innerH;

  const gridVals = [0, 2, 4, 6, 8, 10];
  const grids = gridVals.map((gv) => {
    const y = yAt(gv);
    return `<line class="grid-line" x1="${left}" y1="${y}" x2="${w - right}" y2="${y}"/><text class="tick-label" x="${left - 16}" y="${y + 6}" text-anchor="end">${gv}</text>`;
  }).join("");

  let d = "";
  values.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    const cmd = d ? "L" : "M";
    d += `${cmd} ${xAt(i)} ${yAt(v)} `;
  });

  const points = values
    .map((v, i) => {
      if (!Number.isFinite(v)) return "";
      const x = xAt(i);
      const y = yAt(v);
      return `<circle cx="${x}" cy="${y}" r="6.5" fill="#d2a963" stroke="rgba(232,213,163,0.8)" stroke-width="1.2"><title>${esc(decades[i])}: ${v.toFixed(2)}</title></circle>`;
    })
    .join("");

  const xTicks = decades
    .map((dLabel, i) => `<text class="tick-label" x="${xAt(i)}" y="${h - 44}" text-anchor="middle">${esc(dLabel)}</text>`)
    .join("");

  host.innerHTML = `
    <svg class="line-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Average rating through the decades">
      <text class="chart-title" x="${left}" y="34">Average rating through the decades (${esc(selectedGenresLabel())})</text>
      <rect x="${left}" y="${top}" width="${innerW}" height="${innerH}" fill="rgba(255,255,255,0.01)" stroke="rgba(232,213,163,0.12)"/>
      ${grids}
      <line class="grid-line" x1="${left}" y1="${top}" x2="${left}" y2="${h - bottom}"/>
      <line class="grid-line" x1="${left}" y1="${h - bottom}" x2="${w - right}" y2="${h - bottom}"/>
      <path d="${d.trim()}" fill="none" stroke="#caa151" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${points}
      ${xTicks}
      <text class="axis-label" x="${left + innerW * 0.5}" y="${h - 12}" text-anchor="middle">Decade</text>
      <text class="axis-label" x="${left - 62}" y="${top - 14}">Rating</text>
    </svg>`;
}

function buildBubbleChart() {
  const host = document.getElementById("bubbleChart");
  if (!host) return;

  const rows = [];
  state.records.forEach((record, dIndex) => {
    (record.films || []).forEach((film) => {
      if (!Number.isFinite(film.rating) || !Number.isFinite(film.votes) || !Number.isFinite(film.year)) return;
      rows.push({
        decade: record.label,
        year: film.year,
        rating: film.rating,
        votes: film.votes,
        title: film.title,
        color: DECADE_COLORS[record.label] || "#9aa8bb",
        dIndex,
      });
    });
  });

  const minYear = Math.min(...rows.map((r) => r.year), 1900);
  const maxYear = Math.max(...rows.map((r) => r.year), 2025);
  const maxVotes = Math.max(...rows.map((r) => r.votes), 1);

  const w = 1160;
  const h = 460;
  const left = 60;
  const top = 30;
  const right = 170;
  const bottom = 52;
  const innerW = w - left - right;
  const innerH = h - top - bottom;

  const xAt = (year) => left + ((year - minYear) / (maxYear - minYear || 1)) * innerW;
  const yAt = (rating) => top + ((10 - rating) / 8) * innerH;
  const rAt = (votes) => 2 + Math.sqrt(votes / maxVotes) * 25;

  const grid = [2, 4, 6, 8, 10].map((gv) => {
    const y = yAt(gv);
    return `<line class="grid-line" x1="${left}" y1="${y}" x2="${left + innerW}" y2="${y}"/><text class="tick-label" x="${left - 10}" y="${y + 4}" text-anchor="end">${gv}</text>`;
  }).join("");

  const circles = rows.map((row) => {
    const x = xAt(row.year);
    const y = yAt(row.rating);
    const r = rAt(row.votes);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${row.color}" opacity="0.64" stroke="rgba(232,213,163,0.16)" stroke-width="1"><title>${esc(row.title)} (${esc(row.decade)})\nYear: ${row.year}\nRating: ${row.rating.toFixed(1)}\nVotes: ${row.votes.toLocaleString()}</title></circle>`;
  }).join("");

  const xTicks = DECADE_ORDER.map((d) => {
    const y = parseInt(d, 10);
    const x = xAt(y);
    return `<text class="tick-label" x="${x}" y="${h - 20}" text-anchor="middle">${esc(d)}</text>`;
  }).join("");

  const legend = DECADE_ORDER.map((d, i) => {
    const y = top + i * 24;
    const color = DECADE_COLORS[d] || "#9aa8bb";
    return `<circle cx="${left + innerW + 38}" cy="${y + 6}" r="8" fill="${color}" opacity="0.85"/><text class="tick-label" x="${left + innerW + 58}" y="${y + 10}">${esc(d)}</text>`;
  }).join("");

  host.innerHTML = `
    <svg class="bubble-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Popularity, rating and runtime bubble chart">
      ${grid}
      <line class="grid-line" x1="${left}" y1="${top}" x2="${left}" y2="${h - bottom}"/>
      <line class="grid-line" x1="${left}" y1="${h - bottom}" x2="${left + innerW}" y2="${h - bottom}"/>
      ${circles}
      ${xTicks}
      ${legend}
      <text class="axis-label" x="${left + innerW * 0.5}" y="${h - 2}" text-anchor="middle">Year</text>
      <text class="axis-label" x="${left - 40}" y="${top - 10}">Rating</text>
      <text class="axis-label" x="${left + innerW + 28}" y="${top - 10}">Decade</text>
    </svg>
    <div class="legend-list">
      <div class="legend-item"><span class="legend-dot" style="background:#d4ad4d"></span>Size = votes</div>
      <div class="legend-item"><span class="legend-dot" style="background:#6e8fb3"></span>Color = decade</div>
    </div>`;
}

function renderAll() {
  buildHeatmap();
  buildGenreFilters();
  buildLineChart();
  buildBubbleChart();
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadData();
    renderAll();
  } catch (err) {
    const container = document.querySelector(".analysis-page");
    if (!container) return;
    container.innerHTML = `
      <section class="viz-card">
        <div class="viz-header">
          <span class="viz-number">!</span>
          <div>
            <h2>Unable to load visualization data</h2>
            <p>Make sure Flask API is running on localhost:5050.</p>
          </div>
        </div>
        <p style="opacity:.8;font-family:'Cormorant Garamond',serif">${esc(err.message)}</p>
      </section>`;
  }
});
