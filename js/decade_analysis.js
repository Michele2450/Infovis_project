const GENRES = [
  "Drama", "Crime", "Comedy", "Action", "Romance", "Sci-Fi", "Horror", "Documentary", "Adventure", "Animation",
];

const DECADE_COLORS = {
  "1900s": "#4E6A86",
  "1910s": "#587591",
  "1920s": "#63809B",
  "1930s": "#718BA0",
  "1940s": "#82929B",
  "1950s": "#9A927F",
  "1960s": "#B19162",
  "1970s": "#C7964E",
  "1980s": "#D6A247",
  "1990s": "#E1B24F",
  "2000s": "#E8C267",
  "2010s": "#EFD487",
  "2020s": "#F5E3A8",
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
  const rowsUnsorted = GENRES.map((genre) => {
    const vals = state.records.map((record) => {
      const hit = (record.genreStats || []).find((g) => g.genre === genre);
      return hit ? safeNum(hit.percentage) : 0;
    });
    return { genre, vals };
  });
  const rows = rowsUnsorted
    .map((row) => ({
      ...row,
      total: row.vals.reduce((acc, v) => acc + v, 0),
    }))
    .sort((a, b) => b.total - a.total || a.genre.localeCompare(b.genre));

  const maxVal = Math.max(...rows.flatMap((r) => r.vals), 1);
  const HEAT_COLORS = ["#383735", "#5F564C", "#8E7D63", "#B9A98A", "#D8CBB2", "#EDE3CF"];

  const w = 1320;
  const h = 560;
  const left = 190;
  const top = 28;
  const right = 20;
  const bottom = 86;

  const innerW = w - left - right;
  const innerH = h - top - bottom;

  const cw = innerW / decades.length;
  const ch = innerH / GENRES.length;

  const hexToRgb = (hex) => {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  };

  const lerp = (a, b, t) => a + (b - a) * t;
  const colorFor = (pct) => {
    const t = clamp(pct / maxVal, 0, 1);
    const segments = HEAT_COLORS.length - 1;
    const scaled = t * segments;
    const idx = Math.min(segments - 1, Math.floor(scaled));
    const localT = scaled - idx;
    const c1 = hexToRgb(HEAT_COLORS[idx]);
    const c2 = hexToRgb(HEAT_COLORS[idx + 1]);
    const r = Math.round(lerp(c1.r, c2.r, localT));
    const g = Math.round(lerp(c1.g, c2.g, localT));
    const b = Math.round(lerp(c1.b, c2.b, localT));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const yLabels = rows
    .map((row, i) => `<text class="tick-label" style="font-size:16px" x="${left - 16}" y="${top + i * ch + ch * 0.62}" text-anchor="end">${esc(row.genre)}</text>`)
    .join("");

  const xLabels = decades
    .map((d, i) => `<text class="tick-label" style="font-size:14px" x="${left + i * cw + cw * 0.5}" y="${h - 44}" text-anchor="middle">${esc(d)}</text>`)
    .join("");

  const cells = rows
    .map((row, y) => row.vals
      .map((v, x) => {
        const x0 = left + x * cw;
        const y0 = top + y * ch;
        return `<rect class="hm-cell" data-genre="${esc(row.genre)}" data-decade="${esc(decades[x])}" data-value="${v}" x="${x0 + 0.45}" y="${y0 + 0.45}" width="${cw - 0.9}" height="${ch - 0.9}" fill="${colorFor(v)}" stroke="rgba(228,220,204,0.18)" stroke-width="0.45" opacity="0.96"></rect>`;
      })
      .join(""))
    .join("");

  host.innerHTML = `
    <svg class="heatmap-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Genres Across Decades heatmap">
      ${cells}
      ${yLabels}
      ${xLabels}
      <text class="axis-label" style="font-size:18px" x="${left + innerW * 0.5}" y="${h - 14}" text-anchor="middle">Decade</text>
      <text class="axis-label" style="font-size:16px" x="${left - 136}" y="${top - 10}">Genre</text>
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
  if (!selected.length) return "all genres";
  if (selected.length === 1) return selected[0];
  return selected.join(" + ");
}

function buildLineChart() {
  const host = document.getElementById("lineChart");
  const tooltip = document.getElementById("lineChartTooltip");
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
  const h = 620;
  const left = 90;
  const top = 58;
  const right = 26;
  const bottom = 86;
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
      return `<circle class="line-point" data-decade="${esc(decades[i])}" data-genre="${esc(selectedGenresLabel())}" data-rating="${v.toFixed(2)}" cx="${x}" cy="${y}" r="6.5" fill="#D9B15F" stroke="rgba(255,255,255,0.2)" stroke-width="1.1"></circle>`;
    })
    .join("");

  const xTicks = decades
    .map((dLabel, i) => `<text class="tick-label" x="${xAt(i)}" y="${h - 44}" text-anchor="middle">${esc(dLabel)}</text>`)
    .join("");

  host.innerHTML = `
    <svg class="line-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Average rating through the decades">
      <text class="chart-title" x="${left}" y="30">Average rating, ${esc(selectedGenresLabel())}</text>
      <rect x="${left}" y="${top}" width="${innerW}" height="${innerH}" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.08)"/>
      ${grids}
      <line x1="${left}" y1="${top}" x2="${left}" y2="${h - bottom}" style="stroke:rgba(255,255,255,0.18);stroke-width:1"/>
      <line x1="${left}" y1="${h - bottom}" x2="${w - right}" y2="${h - bottom}" style="stroke:rgba(255,255,255,0.18);stroke-width:1"/>
      <path d="${d.trim()}" fill="none" stroke="#caa151" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${points}
      ${xTicks}
      <text class="axis-label" x="${left + innerW * 0.5}" y="${h - 12}" text-anchor="middle">Decade</text>
    </svg>`;

  if (tooltip) {
    host.querySelectorAll(".line-point").forEach((node) => {
      node.addEventListener("mouseenter", () => {
        tooltip.hidden = false;
        tooltip.innerHTML = `${node.dataset.genre}<br>${node.dataset.decade}<br>Average rating: ${node.dataset.rating}`;
      });
      node.addEventListener("mousemove", (event) => {
        const bounds = host.getBoundingClientRect();
        tooltip.style.left = `${event.clientX - bounds.left + 12}px`;
        tooltip.style.top = `${event.clientY - bounds.top - 12}px`;
      });
      node.addEventListener("mouseleave", () => {
        tooltip.hidden = true;
      });
    });
  }
}

function buildBubbleChart() {
  const host = document.getElementById("bubbleChart");
  const tooltip = document.getElementById("bubbleChartTooltip");
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
        runtime: Number.isFinite(film.runtime) ? film.runtime : null,
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
  const h = 480;
  const left = 72;
  const top = 28;
  const right = 26;
  const bottom = 66;
  const innerW = w - left - right;
  const innerH = h - top - bottom;

  const xAt = (year) => left + ((year - minYear) / (maxYear - minYear || 1)) * innerW;
  const yAt = (rating) => top + ((10 - rating) / 10) * innerH;
  const rAt = (votes) => 2 + Math.sqrt(votes / maxVotes) * 18;

  const grid = [0, 2, 4, 6, 8, 10].map((gv) => {
    const y = yAt(gv);
    return `<line class="grid-line bubble-grid" x1="${left}" y1="${y}" x2="${left + innerW}" y2="${y}"/><text class="tick-label bubble-tick" x="${left - 10}" y="${y + 4}" text-anchor="end">${gv}</text>`;
  }).join("");

  const circles = rows.map((row) => {
    const x = xAt(row.year);
    const y = yAt(row.rating);
    const r = rAt(row.votes);
    const runtimeLine = row.runtime ? `\nRuntime: ${row.runtime} min` : "";
    return `<circle class="bubble-point" data-title="${esc(row.title)}" data-year="${row.year}" data-decade="${esc(row.decade)}" data-rating="${row.rating.toFixed(1)}" data-votes="${row.votes}" data-runtime="${row.runtime || ""}" cx="${x}" cy="${y}" r="${r}" fill="${row.color}" opacity="0.62" stroke="rgba(255,255,255,0.25)" stroke-width="0.8"><title>${esc(row.title)}\n${row.year} · ${esc(row.decade)}\nRating: ${row.rating.toFixed(1)}\nVotes: ${row.votes.toLocaleString()}${runtimeLine}</title></circle>`;
  }).join("");

  const xTicks = DECADE_ORDER.map((d) => {
    const y = parseInt(d, 10);
    const x = xAt(y);
    return `<text class="tick-label bubble-tick" x="${x}" y="${h - 20}" text-anchor="middle">${esc(d)}</text>`;
  }).join("");

  const bubbleLegendVotes = [0.1, 0.45, 1].map((f) => Math.max(1, Math.round(maxVotes * f)));
  const bubbleLegend = bubbleLegendVotes.map((v) => {
    const r = rAt(v);
    return `<div class="bubble-size-item"><span class="bubble-size-dot" style="width:${r * 2}px;height:${r * 2}px"></span><span>${v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : v}</span></div>`;
  }).join("");
  const decadeGradient = DECADE_ORDER.map((d, i) => `${DECADE_COLORS[d]} ${(i / (DECADE_ORDER.length - 1)) * 100}%`).join(", ");

  host.innerHTML = `
    <svg class="bubble-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Film rating and popularity over time bubble chart">
      ${grid}
      <line class="grid-line bubble-axis" x1="${left}" y1="${top}" x2="${left}" y2="${h - bottom}"/>
      <line class="grid-line bubble-axis" x1="${left}" y1="${h - bottom}" x2="${left + innerW}" y2="${h - bottom}"/>
      ${circles}
      ${xTicks}
      <text class="axis-label bubble-axis-label" x="${left + innerW * 0.5}" y="${h - 4}" text-anchor="middle">Release year</text>
      <text class="axis-label bubble-axis-label" x="${left - 60}" y="${top - 10}">IMDb rating</text>
    </svg>
    <div class="bubble-legends">
      <div class="bubble-legend-decade">
        <span>Decade</span>
        <span>1900s</span>
        <span class="bubble-gradient" style="background: linear-gradient(90deg, ${decadeGradient})"></span>
        <span>2020s</span>
      </div>
      <div class="bubble-legend-size">
        <span>Bubble size (votes)</span>
        <div class="bubble-size-scale">${bubbleLegend}</div>
        <span>Fewer votes</span>
        <span>More votes</span>
      </div>
    </div>`;

  if (tooltip) {
    host.querySelectorAll(".bubble-point").forEach((node) => {
      node.addEventListener("mouseenter", () => {
        const runtime = node.dataset.runtime ? `<br>Runtime: ${node.dataset.runtime} min` : "";
        tooltip.hidden = false;
        tooltip.innerHTML = `${node.dataset.title}<br>${node.dataset.year} · ${node.dataset.decade}<br>Rating: ${node.dataset.rating}<br>Votes: ${Number(node.dataset.votes).toLocaleString()}${runtime}`;
      });
      node.addEventListener("mousemove", (event) => {
        const bounds = host.getBoundingClientRect();
        tooltip.style.left = `${event.clientX - bounds.left + 12}px`;
        tooltip.style.top = `${event.clientY - bounds.top - 12}px`;
      });
      node.addEventListener("mouseleave", () => {
        tooltip.hidden = true;
      });
    });
  }
}

function renderAll() {
  buildHeatmap();
  buildGenreFilters();
  buildLineChart();
  buildBubbleChart();
}

document.addEventListener("DOMContentLoaded", async () => {
  const firstHeader = document.querySelector(".viz-card .viz-header h2");
  const firstSubtitle = document.querySelector(".viz-card .viz-header p");
  if (firstHeader) firstHeader.textContent = "Genre Prevalence by Decade";
  if (firstSubtitle) firstSubtitle.textContent = "Heatmap of genre prevalence in top films from the 1900s to the 2020s.";

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
