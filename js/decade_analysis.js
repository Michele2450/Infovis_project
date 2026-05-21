const GENRES = [
  "Drama", "Crime", "Comedy", "Action", "Romance", "Sci-Fi", "Horror", "Documentary", "Adventure", "Animation",
];

const DECADE_COLORS = {
  "1900s": "#6F8FA8",
  "1910s": "#7894A6",
  "1920s": "#8297A0",
  "1930s": "#8E9B98",
  "1940s": "#9AA091",
  "1950s": "#ACA37F",
  "1960s": "#B8A67A",
  "1970s": "#C1A76D",
  "1980s": "#C8A85F",
  "1990s": "#D2AF5D",
  "2000s": "#D9B65D",
  "2010s": "#E5C46B",
  "2020s": "#F2D27A",
};

const GENRE_COLORS = {
  Drama: "#E4B85C",
  Comedy: "#D98C3F",
  Crime: "#8E79B8",
  "Sci-Fi": "#6F8FA8",
  Horror: "#B84A5A",
  Romance: "#D86A73",
  Adventure: "#7DBA8C",
  Action: "#C76E3D",
  Animation: "#F2D27A",
  Fantasy: "#6FAE9F",
  Short: "#9A9A9A",
  Documentary: "#A8B07A",
  Thriller: "#7A6AAE",
  Mystery: "#5F7E9E",
  Family: "#CDBF9A",
  Music: "#D6A1C7",
  War: "#A67C52",
  Western: "#B8945E",
  History: "#B8AA8A",
  Biography: "#A6A86F",
};

const state = {
  records: [],
  selectedGenres: new Set(["All Genres"]),
  lineScaleMode: "zoomed",
  lineStatMode: "average",
  selectedDecade: null,
  hoveredGenre: null,
  pinnedGenre: null,
  bubble: {
    genre: "All",
    minRating: 0,
    minVotes: 0,
    search: "",
    highlightMode: "reset",
    sizeMode: "votes",
    colorMode: "release-decade",
    brushRange: null,
    pinned: [],
  },
  slope: {
    start: "1960s",
    end: "2010s",
    sort: "inc",
    selectedGenres: new Set(),
    lockedGenre: null,
    hoveredGenre: null,
  },
  dist: {
    mode: "boxplot",
    scale: "zoomed",
    genre: "All genres",
    labels: "none",
  },
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

function compactVotes(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return `${v}`;
}

function syncUrlFromState() {
  const p = new URLSearchParams();
  if (state.selectedDecade) p.set("selectedDecade", state.selectedDecade);
  const selected = Array.from(state.selectedGenres).filter((g) => g !== "All Genres");
  if (selected.length) p.set("genres", selected.join(","));
  p.set("lineScale", state.lineScaleMode);
  p.set("lineStat", state.lineStatMode);
  p.set("bubbleGenre", state.bubble.genre);
  p.set("minRating", String(state.bubble.minRating));
  p.set("minVotes", String(state.bubble.minVotes));
  if (state.bubble.search) p.set("search", state.bubble.search);
  p.set("hl", state.bubble.highlightMode);
  p.set("size", state.bubble.sizeMode);
  p.set("color", state.bubble.colorMode);
  if (state.bubble.brushRange) p.set("brush", `${state.bubble.brushRange[0]}-${state.bubble.brushRange[1]}`);
  history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
}

function loadStateFromUrl() {
  const p = new URLSearchParams(window.location.search);
  state.selectedDecade = p.get("selectedDecade") || null;
  const g = p.get("genres");
  if (g) state.selectedGenres = new Set(g.split(",").filter(Boolean));
  state.lineScaleMode = p.get("lineScale") === "full" ? "full" : "zoomed";
  state.lineStatMode = p.get("lineStat") === "median" ? "median" : "average";
  state.bubble.genre = p.get("bubbleGenre") || "All";
  state.bubble.minRating = Number(p.get("minRating") || 0);
  state.bubble.minVotes = Number(p.get("minVotes") || 0);
  state.bubble.search = p.get("search") || "";
  state.bubble.highlightMode = p.get("hl") || "reset";
  state.bubble.sizeMode = p.get("size") || "votes";
  state.bubble.colorMode = p.get("color") || "release-decade";
}

async function loadData() {
  const ids = ["heatmapChart", "distChart", "lineChart", "bubbleChart", "slopeChart"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="viz-loading">Loading visualization…</div>`;
  });
  await Promise.all(DECADE_ORDER.map((label) => getDecadeData(label)));
  state.records = DECADE_ORDER
    .map((label) => getDecadeRecord(label))
    .filter(Boolean);
}

function buildHeatmap() {
  const host = document.getElementById("heatmapChart");
  const legendBar = document.getElementById("heatmapLegendBar");
  const legendTicks = document.getElementById("heatmapLegendTicks");
  const tooltip = document.getElementById("heatmapTooltip");
  if (!host) return;
  if (!state.records.length) {
    host.innerHTML = `<div class="viz-empty">No heatmap data available.</div>`;
    return;
  }

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
      avg: row.vals.reduce((acc, v) => acc + v, 0) / Math.max(1, row.vals.length),
    }))
    .sort((a, b) => b.avg - a.avg || a.genre.localeCompare(b.genre));

  const maxVal = Math.max(...rows.flatMap((r) => r.vals), 1);
  const HEAT_COLORS = ["#2B2926", "#564B3A", "#8A7A60", "#C0AF8E", "#F2E6C8"];

  const hostWidth = Math.max(760, host.clientWidth || 1200);
  const w = hostWidth;
  const h = clamp(Math.round(hostWidth * 0.43), 420, 620);
  const left = clamp(Math.round(hostWidth * 0.14), 130, 210);
  const top = 24;
  const right = 16;
  const bottom = 84;

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
    .map((row, i) => `<text class="tick-label" style="font-size:${clamp(Math.round(cw * 0.22), 12, 16)}px" x="${left - 14}" y="${top + i * ch + ch * 0.62}" text-anchor="end">${esc(row.genre)}</text>`)
    .join("");

  const xLabels = decades
    .map((d, i) => `<text class="tick-label" style="font-size:${clamp(Math.round(cw * 0.18), 11, 14)}px" x="${left + i * cw + cw * 0.5}" y="${h - 44}" text-anchor="middle">${esc(d)}</text>`)
    .join("");

  const cells = rows
    .map((row, y) => row.vals
      .map((v, x) => {
        const x0 = left + x * cw;
        const y0 = top + y * ch;
        return `<rect class="hm-cell" data-genre="${esc(row.genre)}" data-decade="${esc(decades[x])}" data-value="${v}" x="${x0 + 0.45}" y="${y0 + 0.45}" width="${cw - 0.9}" height="${ch - 0.9}" fill="${colorFor(v)}" stroke="#2A2A2A" stroke-width="0.7" opacity="0.98"></rect>`;
      })
      .join(""))
    .join("");

  host.innerHTML = `
    <svg class="heatmap-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Genres Across Decades heatmap">
      ${cells}
      ${yLabels}
      ${xLabels}
      <text class="axis-label" style="font-size:${clamp(Math.round(cw * 0.28), 14, 18)}px" x="${left + innerW * 0.5}" y="${h - 14}" text-anchor="middle">Decade</text>
    </svg>`;

  if (legendBar) {
    const c0 = colorFor(0);
    const c1 = colorFor(maxVal * 0.5);
    const c2 = colorFor(maxVal);
    legendBar.style.background = `linear-gradient(90deg, ${c0} 0%, ${c1} 50%, ${c2} 100%)`;
  }
  if (legendTicks) {
    const ticks = [0, 25, 50, 75, 100];
    legendTicks.innerHTML = ticks.map((v) => `<span>${v}%</span>`).join("");
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
        state.hoveredGenre = null;
        buildLineChart();
        buildBubbleChart();
        tooltip.hidden = true;
      });
      cell.addEventListener("mouseenter", (e) => {
        state.hoveredGenre = e.currentTarget.dataset.genre || null;
        buildLineChart();
        buildBubbleChart();
      });
      cell.addEventListener("click", (e) => {
        const genre = e.currentTarget.dataset.genre;
        state.pinnedGenre = state.pinnedGenre === genre ? null : genre;
        if (state.pinnedGenre) {
          state.selectedGenres = new Set([state.pinnedGenre]);
          state.bubble.genre = state.pinnedGenre;
          const bubbleGenre = document.getElementById("bubbleGenreFilter");
          if (bubbleGenre) bubbleGenre.value = state.pinnedGenre;
        } else {
          state.selectedGenres = new Set(["All Genres"]);
          state.bubble.genre = "All";
          const bubbleGenre = document.getElementById("bubbleGenreFilter");
          if (bubbleGenre) bubbleGenre.value = "All";
        }
        buildGenreFilters();
        buildLineChart();
        buildBubbleChart();
      });
    });
  }
}

function buildSlopeChart() {
  const host = document.getElementById("slopeChart");
  const tooltip = document.getElementById("slopeTooltip");
  if (!host) return;
  if (!state.records.length) {
    host.innerHTML = `<div class="viz-empty">No slope chart data available.</div>`;
    return;
  }

  const startRec = state.records.find((r) => r.label === state.slope.start) || state.records[0];
  const endRec = state.records.find((r) => r.label === state.slope.end) || state.records[state.records.length - 1];
  const startMap = new Map((startRec.genreStats || []).map((g) => [g.genre, safeNum(g.percentage)]));
  const endMap = new Map((endRec.genreStats || []).map((g) => [g.genre, safeNum(g.percentage)]));
  const allGenres = Array.from(new Set([...startMap.keys(), ...endMap.keys()]));
  let rows = allGenres.map((genre) => {
    const s = startMap.get(genre) || 0;
    const e = endMap.get(genre) || 0;
    return { genre, start: s, end: e, delta: e - s };
  });

  if (state.slope.selectedGenres.size) rows = rows.filter((r) => state.slope.selectedGenres.has(r.genre));

  if (state.slope.sort === "inc") rows.sort((a, b) => b.delta - a.delta);
  else if (state.slope.sort === "dec") rows.sort((a, b) => a.delta - b.delta);
  else if (state.slope.sort === "end") rows.sort((a, b) => b.end - a.end);
  else rows.sort((a, b) => a.genre.localeCompare(b.genre));

  if (!state.slope.selectedGenres.size) rows = rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 10);

  const w = Math.max(900, host.clientWidth || 1100);
  const h = Math.max(360, 70 + rows.length * 32);
  const left = 230;
  const right = 170;
  const top = 44;
  const bottom = 36;
  const innerW = w - left - right;
  const innerH = h - top - bottom;
  const rowH = innerH / Math.max(1, rows.length);
  const maxPct = Math.max(1, ...rows.map((r) => Math.max(r.start, r.end)));
  const xL = left;
  const xR = left + innerW;
  const yAt = (i) => top + i * rowH + rowH * 0.5;
  const colorFor = (genre, d) => GENRE_COLORS[genre] || (d > 0.4 ? "#7DBA8C" : d < -0.4 ? "#D86A73" : "#B8AA8A");
  const highlight = state.slope.lockedGenre;

  const lines = rows.map((r, i) => {
    const y = yAt(i);
    const c = colorFor(r.genre, r.delta);
    const muted = highlight && highlight !== r.genre ? " slope-muted" : "";
    return `
      <line class="slope-line${muted}" data-genre="${esc(r.genre)}" data-start="${r.start.toFixed(1)}" data-end="${r.end.toFixed(1)}" data-delta="${r.delta.toFixed(1)}" x1="${xL}" y1="${y}" x2="${xR}" y2="${y - (r.delta / Math.max(5, maxPct)) * 70}" stroke="${c}"/>
      <circle class="slope-point${muted}" data-genre="${esc(r.genre)}" data-start="${r.start.toFixed(1)}" data-end="${r.end.toFixed(1)}" data-delta="${r.delta.toFixed(1)}" cx="${xL}" cy="${y}" r="7" fill="${c}"/>
      <circle class="slope-point${muted}" data-genre="${esc(r.genre)}" data-start="${r.start.toFixed(1)}" data-end="${r.end.toFixed(1)}" data-delta="${r.delta.toFixed(1)}" cx="${xR}" cy="${y - (r.delta / Math.max(5, maxPct)) * 70}" r="7" fill="${c}"/>
      <text class="tick-label${muted}" x="${left - 56}" y="${y + 4}" text-anchor="end">${esc(r.genre)}</text>
      <text class="tick-label${muted}" x="${left - 14}" y="${y + 4}" text-anchor="end" opacity="0.9">${Math.round(r.start)}%</text>
      <text class="tick-label${muted}" x="${xR + 18}" y="${y - (r.delta / Math.max(5, maxPct)) * 70 + 4}">${Math.round(r.end)}%</text>
    `;
  }).join("");

  host.innerHTML = `
    <svg class="line-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Genre prevalence change slope chart">
      <text class="axis-label" x="${xL}" y="24">${esc(startRec.label)}</text>
      <text class="axis-label" x="${xR}" y="24" text-anchor="end">${esc(endRec.label)}</text>
      ${lines}
    </svg>`;

  const bind = (node) => {
    node.addEventListener("mouseenter", () => {
      if (tooltip) {
        tooltip.hidden = false;
        tooltip.innerHTML = `${node.dataset.genre}<br>${startRec.label}: ${node.dataset.start}% (${startRec.totalFilms || "-"} films)<br>${endRec.label}: ${node.dataset.end}% (${endRec.totalFilms || "-"} films)<br>Change: ${Number(node.dataset.delta) >= 0 ? "+" : ""}${node.dataset.delta} pp`;
      }
    });
    node.addEventListener("mousemove", (event) => {
      if (!tooltip) return;
      const bounds = host.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - bounds.left + 12}px`;
      tooltip.style.top = `${event.clientY - bounds.top - 12}px`;
    });
    node.addEventListener("mouseleave", () => {
      if (tooltip) tooltip.hidden = true;
    });
    node.addEventListener("click", () => {
      state.slope.lockedGenre = state.slope.lockedGenre === node.dataset.genre ? null : node.dataset.genre;
      buildSlopeChart();
    });
  };
  host.querySelectorAll(".slope-line, .slope-point").forEach(bind);
}

function q(sorted, p) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const t = idx - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}

function buildDistributionChart() {
  const host = document.getElementById("distChart");
  const tt = document.getElementById("distTooltip");
  const table = document.getElementById("distTable");
  if (!host) return;
  if (!state.records.length) {
    host.innerHTML = `<div class="viz-empty">No distribution data available.</div>`;
    return;
  }
  const rows = state.records.map((r) => {
    const ratings = (r.films || [])
      .filter((f) => Number.isFinite(f.rating) && (state.dist.genre === "All genres" || (f.genres || []).includes(state.dist.genre)))
      .map((f) => f.rating)
      .sort((a, b) => a - b);
    if (!ratings.length) return { decade: r.label, n: 0 };
    return {
      decade: r.label,
      n: ratings.length,
      min: ratings[0],
      q1: q(ratings, 0.25),
      med: q(ratings, 0.5),
      q3: q(ratings, 0.75),
      max: ratings[ratings.length - 1],
      values: ratings,
    };
  }).filter((r) => r.n > 0);

  const w = Math.max(980, host.clientWidth || 1100);
  const h = 460;
  const left = 70, right = 30, top = 28, bottom = 64;
  const innerW = w - left - right, innerH = h - top - bottom;
  const yMin = state.dist.scale === "full" ? 0 : 6;
  const yMax = 10;
  const yAt = (v) => top + ((yMax - v) / (yMax - yMin)) * innerH;
  const xAt = (i) => left + ((i + 0.5) / rows.length) * innerW;
  const bw = Math.max(16, innerW / Math.max(1, rows.length) * 0.36);

  const gridVals = state.dist.scale === "full" ? [0,2,4,6,8,10] : [6,7,8,9,10];
  const grid = gridVals.map((g) => `<line class="grid-line" x1="${left}" y1="${yAt(g)}" x2="${w-right}" y2="${yAt(g)}"/><text class="tick-label" x="${left-10}" y="${yAt(g)+4}" text-anchor="end">${g}</text>`).join("");
  const marks = rows.map((r, i) => {
    const x = xAt(i);
    const oy = r.values.filter((v) => v < r.q1 - 1.5*(r.q3-r.q1) || v > r.q3 + 1.5*(r.q3-r.q1)).slice(0,10)
      .map((v,j)=>`<circle cx="${x + (j%3-1)*4}" cy="${yAt(v)}" r="2.2" fill="#CDBF9A" opacity="0.85"/>`).join("");
    if (state.dist.mode === "band") {
      return `<rect class="dist-mark" data-i="${i}" x="${x-bw}" y="${yAt(r.q3)}" width="${bw*2}" height="${Math.max(1,yAt(r.q1)-yAt(r.q3))}" fill="rgba(138,111,61,0.55)" stroke="#E4B85C"/><line x1="${x-bw}" y1="${yAt(r.med)}" x2="${x+bw}" y2="${yAt(r.med)}" stroke="#F2D27A" stroke-width="2"/>`;
    }
    if (state.dist.mode === "violin") {
      const path = `M ${x} ${yAt(r.min)} C ${x-bw} ${yAt(r.q1)}, ${x-bw} ${yAt(r.q3)}, ${x} ${yAt(r.max)} C ${x+bw} ${yAt(r.q3)}, ${x+bw} ${yAt(r.q1)}, ${x} ${yAt(r.min)} Z`;
      return `<path class="dist-mark" data-i="${i}" d="${path}" fill="rgba(138,111,61,0.35)" stroke="#E4B85C"/><line x1="${x-bw*0.6}" y1="${yAt(r.med)}" x2="${x+bw*0.6}" y2="${yAt(r.med)}" stroke="#F2D27A" stroke-width="2"/>`;
    }
    return `
      <line x1="${x}" y1="${yAt(r.max)}" x2="${x}" y2="${yAt(r.q3)}" stroke="#E4B85C"/>
      <line x1="${x}" y1="${yAt(r.q1)}" x2="${x}" y2="${yAt(r.min)}" stroke="#E4B85C"/>
      <line x1="${x-bw*0.4}" y1="${yAt(r.max)}" x2="${x+bw*0.4}" y2="${yAt(r.max)}" stroke="#E4B85C"/>
      <line x1="${x-bw*0.4}" y1="${yAt(r.min)}" x2="${x+bw*0.4}" y2="${yAt(r.min)}" stroke="#E4B85C"/>
      <rect class="dist-mark" data-i="${i}" x="${x-bw/2}" y="${yAt(r.q3)}" width="${bw}" height="${Math.max(1,yAt(r.q1)-yAt(r.q3))}" fill="rgba(138,111,61,0.55)" stroke="#E4B85C"/>
      <line x1="${x-bw/2}" y1="${yAt(r.med)}" x2="${x+bw/2}" y2="${yAt(r.med)}" stroke="#F2D27A" stroke-width="2"/>
      ${oy}
    `;
  }).join("");
  const xTicks = rows.map((r,i)=>`<text class="tick-label" x="${xAt(i)}" y="${h-30}" text-anchor="middle">${r.decade}</text>`).join("");
  const labels = rows.map((r,i)=>{
    if(state.dist.labels==="none") return "";
    const med = `<text class="tick-label" x="${xAt(i)}" y="${yAt(r.med)-8}" text-anchor="middle">${r.med.toFixed(1)}</text>`;
    const n = `<text class="tick-label" x="${xAt(i)}" y="${h-14}" text-anchor="middle">${compactVotes(r.n)}</text>`;
    return state.dist.labels==="median"?med:med+n;
  }).join("");

  host.innerHTML = `<svg class="line-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Rating distribution by decade">
    ${grid}
    <line x1="${left}" y1="${top}" x2="${left}" y2="${h-bottom}" stroke="#4A4A4A"/>
    <line x1="${left}" y1="${h-bottom}" x2="${w-right}" y2="${h-bottom}" stroke="#4A4A4A"/>
    ${marks}
    ${xTicks}
    ${labels}
    <text class="axis-label" x="${left+innerW*0.5}" y="${h-4}" text-anchor="middle">Decade</text>
    <text class="axis-label" x="${left-6}" y="${top-8}">IMDb rating</text>
  </svg>`;

  host.querySelectorAll(".dist-mark").forEach((el) => {
    el.addEventListener("mouseenter", () => {
      const r = rows[Number(el.dataset.i)];
      if (!tt || !r) return;
      tt.hidden = false;
      tt.innerHTML = `${r.decade}<br>Median: ${r.med.toFixed(2)}<br>25th: ${r.q1.toFixed(2)}<br>75th: ${r.q3.toFixed(2)}<br>Min: ${r.min.toFixed(2)}<br>Max: ${r.max.toFixed(2)}<br>Films: ${r.n}`;
    });
    el.addEventListener("mousemove", (event) => {
      if (!tt) return;
      const b = host.getBoundingClientRect();
      tt.style.left = `${event.clientX - b.left + 12}px`;
      tt.style.top = `${event.clientY - b.top - 12}px`;
    });
    el.addEventListener("mouseleave", () => { if (tt) tt.hidden = true; });
  });

  if (table) {
    table.innerHTML = rows.map((r) => `${r.decade}: median ${r.med.toFixed(1)} · #films ${compactVotes(r.n)}`).join(" | ");
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
  const hint = document.getElementById("lineChartHint");
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
      if (hint) hint.textContent = "";
      if (genre === "All Genres") {
        state.selectedGenres = new Set(["All Genres"]);
      } else {
        if (state.selectedGenres.has("All Genres")) state.selectedGenres.delete("All Genres");
        if (state.selectedGenres.has(genre)) state.selectedGenres.delete(genre);
        else if (state.selectedGenres.size < 4) state.selectedGenres.add(genre);
        else if (hint) hint.textContent = "Select up to 4 genres for readability.";
        if (state.selectedGenres.size === 0) state.selectedGenres = new Set(["All Genres"]);
      }
      buildGenreFilters();
      buildLineChart();
      syncUrlFromState();
    });
  });
}

function filmRatingsForGenre(record, genre) {
  const ratings = [];
  (record.films || []).forEach((film) => {
    if (!Number.isFinite(film.rating)) return;
    if (genre && !(film.genres || []).includes(genre)) return;
    ratings.push(film.rating);
  });
  return ratings;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
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
  if (!state.records.length) {
    host.innerHTML = `<div class="viz-empty">No line chart data available.</div>`;
    return;
  }

  const decades = state.records.map((r) => r.label);
  const selected = Array.from(state.selectedGenres).filter((g) => g !== "All Genres");
  const comparedGenres = selected.length ? selected : ["All Genres"];
  const activeGenre = state.pinnedGenre || state.hoveredGenre;
  const colors = ["#E4B85C", "#D68E5A", "#BFA06A", "#8EA8C9"];
  const statFn = state.lineStatMode === "median" ? median : average;

  const series = comparedGenres.map((genre, idx) => {
    const points = state.records.map((record) => {
      const ratings = filmRatingsForGenre(record, genre === "All Genres" ? null : genre);
      return {
        decade: record.label,
        value: statFn(ratings),
        count: ratings.length,
      };
    });
    return {
      name: genre,
      color: colors[idx % colors.length],
      points,
    };
  });

  const allValues = series.flatMap((s) => s.points.map((p) => p.value).filter(Number.isFinite));
  let yMin = 0;
  let yMax = 10;
  if (state.lineScaleMode === "zoomed" && allValues.length) {
    const minV = Math.min(...allValues);
    const maxV = Math.max(...allValues);
    const pad = Math.max(0.22, (maxV - minV) * 0.25);
    yMin = clamp(minV - pad, 0, 10);
    yMax = clamp(maxV + pad, 0, 10);
    if (yMax - yMin < 0.8) {
      yMin = clamp(yMin - 0.4, 0, 10);
      yMax = clamp(yMax + 0.4, 0, 10);
    }
  }

  const w = Math.max(860, host.clientWidth || 1180);
  const h = 470;
  const left = 90;
  const top = 54;
  const right = 26;
  const bottom = 86;
  const innerW = w - left - right;
  const innerH = h - top - bottom;

  const xAt = (i) => left + (i / (decades.length - 1)) * innerW;
  const yAt = (v) => top + ((yMax - v) / (yMax - yMin || 1)) * innerH;

  const gridVals = state.lineScaleMode === "zoomed"
    ? Array.from({ length: 6 }, (_, i) => yMin + (i * (yMax - yMin) / 5))
    : [0, 2, 4, 6, 8, 10];
  const grids = gridVals.map((gv) => {
    const y = yAt(gv);
    return `<line class="grid-line" x1="${left}" y1="${y}" x2="${w - right}" y2="${y}"/><text class="tick-label" x="${left - 16}" y="${y + 6}" text-anchor="end">${gv.toFixed(1)}</text>`;
  }).join("");

  const overallAvg = allValues.length ? average(allValues) : null;
  const overallLine = Number.isFinite(overallAvg)
    ? `<line x1="${left}" y1="${yAt(overallAvg)}" x2="${w - right}" y2="${yAt(overallAvg)}" stroke="rgba(184,170,138,0.65)" stroke-width="1.2" stroke-dasharray="6 6"/><text class="tick-label" x="${w - right - 4}" y="${yAt(overallAvg) - 8}" text-anchor="end">Overall average</text>`
    : "";

  const allPaths = series.map((s, si) => {
    let d = "";
    s.points.forEach((p, i) => {
      if (!Number.isFinite(p.value)) return;
      d += `${d ? "L" : "M"} ${xAt(i)} ${yAt(p.value)} `;
    });
    const faded = activeGenre && s.name !== activeGenre ? 0.25 : (si === 0 ? 1 : 0.85);
    return `<path class="line-series" data-series="${si}" d="${d.trim()}" fill="none" stroke="${s.color}" stroke-width="${si === 0 ? 3.2 : 2.6}" stroke-linecap="round" stroke-linejoin="round" opacity="${faded}"/>`;
  }).join("");

  const points = series.map((s, si) => s.points.map((p, i) => {
    if (!Number.isFinite(p.value)) return "";
    return `<circle class="line-point" data-series="${si}" data-decade="${esc(decades[i])}" data-genre="${esc(s.name)}" data-rating="${p.value.toFixed(2)}" data-count="${p.count}" cx="${xAt(i)}" cy="${yAt(p.value)}" r="${si === 0 ? 5.4 : 4.2}" fill="${s.color}" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>`;
  }).join("")).join("");

  const xTicks = decades
    .map((dLabel, i) => `<text class="tick-label" x="${xAt(i)}" y="${h - 44}" text-anchor="middle">${esc(dLabel)}</text>`)
    .join("");

  host.innerHTML = `
    <svg class="line-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Average rating through the decades">
      <rect x="${left}" y="${top}" width="${innerW}" height="${innerH}" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.08)"/>
      ${grids}
      ${overallLine}
      <line x1="${left}" y1="${top}" x2="${left}" y2="${h - bottom}" style="stroke:#4A4A4A;stroke-width:1"/>
      <line x1="${left}" y1="${h - bottom}" x2="${w - right}" y2="${h - bottom}" style="stroke:#4A4A4A;stroke-width:1"/>
      ${allPaths}
      ${points}
      ${xTicks}
      <text class="axis-label" x="${left + innerW * 0.5}" y="${h - 12}" text-anchor="middle">Decade</text>
      <text class="axis-label" x="${left - 48}" y="${top - 12}">Average rating</text>
    </svg>`;

  if (tooltip) {
    const resetFocus = () => {
      host.querySelectorAll(".line-series").forEach((p) => {
        p.style.opacity = p.dataset.series === "0" ? "1" : "0.85";
        p.style.strokeWidth = p.dataset.series === "0" ? "3.2" : "2.6";
      });
      host.querySelectorAll(".line-point").forEach((p) => {
        p.style.opacity = "1";
      });
    };
    const focusSeries = (seriesId) => {
      host.querySelectorAll(".line-series").forEach((p) => {
        const active = p.dataset.series === seriesId;
        p.style.opacity = active ? "1" : "0.2";
        p.style.strokeWidth = active ? "4.2" : "2.1";
      });
      host.querySelectorAll(".line-point").forEach((p) => {
        p.style.opacity = p.dataset.series === seriesId ? "1" : "0.22";
      });
    };
    host.querySelectorAll(".line-series").forEach((path) => {
      path.addEventListener("mouseenter", () => focusSeries(path.dataset.series));
      path.addEventListener("mouseleave", () => resetFocus());
    });
    host.querySelectorAll(".line-point").forEach((node) => {
      node.addEventListener("mouseenter", () => {
        focusSeries(node.dataset.series);
        tooltip.hidden = false;
        tooltip.innerHTML = `${node.dataset.genre}<br>${node.dataset.decade}<br>${state.lineStatMode === "median" ? "Median" : "Average"} rating: ${node.dataset.rating}<br>Films: ${Number(node.dataset.count).toLocaleString()}`;
      });
      node.addEventListener("mousemove", (event) => {
        const bounds = host.getBoundingClientRect();
        tooltip.style.left = `${event.clientX - bounds.left + 12}px`;
        tooltip.style.top = `${event.clientY - bounds.top - 12}px`;
      });
      node.addEventListener("mouseleave", () => {
        resetFocus();
        tooltip.hidden = true;
      });
    });
  }
}

function buildBubbleChart() {
  const host = document.getElementById("bubbleChart");
  const tooltip = document.getElementById("bubbleChartTooltip");
  const detail = document.getElementById("bubbleDetailPanel");
  if (!host) return;
  if (!state.records.length) {
    host.innerHTML = `<div class="viz-empty">No bubble chart data available.</div>`;
    return;
  }

  const rowsAll = [];
  state.records.forEach((record, dIndex) => {
    (record.films || []).forEach((film) => {
      if (!Number.isFinite(film.rating) || !Number.isFinite(film.votes) || !Number.isFinite(film.year)) return;
      rowsAll.push({
        decade: record.label,
        year: film.year,
        rating: film.rating,
        votes: film.votes,
        runtime: Number.isFinite(film.runtime) ? film.runtime : null,
        title: film.title,
        genres: film.genres || [],
        rank: Number.isFinite(film.rank) ? film.rank : null,
        summary: film.summary || null,
        poster: film.poster || null,
        color: DECADE_COLORS[record.label] || "#9aa8bb",
        dIndex,
      });
    });
  });

  const focusGenre = state.pinnedGenre || state.hoveredGenre;
  const rows = rowsAll.filter((r) => {
    if (r.rating < state.bubble.minRating) return false;
    if (r.votes < state.bubble.minVotes) return false;
    if (state.bubble.genre !== "All" && !r.genres.includes(state.bubble.genre)) return false;
    return true;
  });
  const minYear = Math.min(...rowsAll.map((r) => r.year), 1900);
  const maxYear = Math.max(...rowsAll.map((r) => r.year), 2025);
  const maxVotes = Math.max(...rowsAll.map((r) => r.votes), 1);

  const w = Math.max(900, host.clientWidth || 1200);
  const h = 520;
  const left = 72;
  const top = 28;
  const right = 24;
  const bottom = 72;
  const innerW = w - left - right;
  const innerH = h - top - bottom;

  const xAt = (year) => left + ((year - minYear) / (maxYear - minYear || 1)) * innerW;
  const yAt = (rating) => top + ((10 - rating) / 10) * innerH;
  const rAt = (votes) => state.bubble.sizeMode === "equal" ? 5.5 : 2 + Math.sqrt(votes / maxVotes) * 14;

  const selectedDecade = state.selectedDecade;
  const topRatedThreshold = rowsAll.length ? [...rowsAll].sort((a, b) => b.rating - a.rating)[Math.max(0, Math.floor(rowsAll.length * 0.08) - 1)]?.rating ?? 8.8 : 8.8;
  const topVotesThreshold = rowsAll.length ? [...rowsAll].sort((a, b) => b.votes - a.votes)[Math.max(0, Math.floor(rowsAll.length * 0.08) - 1)]?.votes ?? 1000000 : 1000000;

  const colorByRating = (rating) => {
    const t = clamp(rating / 10, 0, 1);
    const lo = [87, 108, 133];
    const hi = [228, 184, 92];
    const v = lo.map((n, i) => Math.round(n + (hi[i] - n) * t));
    return `rgb(${v[0]},${v[1]},${v[2]})`;
  };
  const bubbleColor = (row) => {
    if (state.bubble.colorMode === "release-decade") return DECADE_COLORS[row.decade] || "#8192a8";
    if (state.bubble.colorMode === "genre") return GENRE_COLORS[row.genres[0]] || "#8b8f97";
    if (state.bubble.colorMode === "rating") return colorByRating(row.rating);
    return row.decade === selectedDecade ? "#F0C866" : "#6F7478";
  };
  const isHighlighted = (row) => {
    if (state.bubble.highlightMode === "reset") return true;
    if (state.bubble.highlightMode === "top-rated") return row.rating >= topRatedThreshold;
    if (state.bubble.highlightMode === "most-voted") return row.votes >= topVotesThreshold;
    if (!selectedDecade) return true;
    return row.decade === selectedDecade;
  };

  const grid = [0, 2, 4, 6, 8, 10].map((gv) => {
    const y = yAt(gv);
    return `<line class="grid-line bubble-grid" x1="${left}" y1="${y}" x2="${left + innerW}" y2="${y}"/><text class="tick-label bubble-tick" x="${left - 10}" y="${y + 4}" text-anchor="end">${gv}</text>`;
  }).join("");

  const circles = rows.map((row) => {
    const x = xAt(row.year);
    const y = yAt(row.rating);
    const r = rAt(row.votes);
    const highlighted = isHighlighted(row);
    const genreFocused = !focusGenre || row.genres.includes(focusGenre);
    const searchHit = !state.bubble.search || row.title.toLowerCase().includes(state.bubble.search);
    const runtimeLine = row.runtime ? `\nRuntime: ${row.runtime} min` : "";
    const opacityBase = highlighted ? Math.max(0.65, 0.8 - r / 30) : 0.38;
    const opacity = searchHit ? opacityBase : Math.min(0.16, opacityBase * 0.4);
    const finalOpacity = genreFocused ? opacity : Math.min(0.18, opacity * 0.5);
    return `<circle class="bubble-point" data-title="${esc(row.title)}" data-year="${row.year}" data-decade="${esc(row.decade)}" data-rating="${row.rating.toFixed(1)}" data-votes="${row.votes}" data-runtime="${row.runtime || ""}" data-genres="${esc((row.genres || []).join(", "))}" data-rank="${row.rank || ""}" data-summary="${esc(row.summary || "")}" data-poster="${esc(row.poster || "")}" data-highlight="${highlighted ? "1" : "0"}" cx="${x}" cy="${y}" r="${r}" fill="${bubbleColor(row)}" opacity="${finalOpacity.toFixed(2)}" stroke="rgba(242,230,200,0.30)" stroke-width="0.8"><title>${esc(row.title)}\n${row.year} · ${esc(row.decade)}\nRating: ${row.rating.toFixed(1)}\nVotes: ${row.votes.toLocaleString()}${runtimeLine}</title></circle>`;
  }).join("");

  const xTicks = DECADE_ORDER.map((d) => {
    const y = parseInt(d, 10);
    const x = xAt(y);
    return `<text class="tick-label bubble-tick" x="${x}" y="${h - 20}" text-anchor="middle">${esc(d)}</text>`;
  }).join("");

  const bubbleLegendVotes = [300000, 1500000, 3000000];
  const bubbleLegend = bubbleLegendVotes.map((v) => {
    const r = rAt(v);
    return `<div class="bubble-size-item"><span class="bubble-size-dot" style="width:${r * 2}px;height:${r * 2}px"></span><span>${v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : v}</span></div>`;
  }).join("");
  const decadeGradient = DECADE_ORDER.map((d, i) => `${DECADE_COLORS[d]} ${(i / (DECADE_ORDER.length - 1)) * 100}%`).join(", ");
  const decadePoints = DECADE_ORDER.map((d) => {
    const items = rows.filter((r) => r.decade === d).map((r) => r.rating).sort((a, b) => a - b);
    if (!items.length) return null;
    const med = items.length % 2 ? items[Math.floor(items.length / 2)] : (items[items.length / 2 - 1] + items[items.length / 2]) / 2;
    const x = xAt(parseInt(d, 10));
    return { d, x, y: yAt(med), med };
  }).filter(Boolean);
  const trendPath = decadePoints.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const trend = trendPath ? `<path d="${trendPath}" fill="none" stroke="#D6B15C" stroke-opacity="0.75" stroke-width="1.6" stroke-dasharray="3 3"/>${decadePoints.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.4" fill="#D6B15C"/>`).join("")}<text class="tick-label bubble-tick" fill="#E8D9B5" x="${left + 6}" y="${top + 14}">Decade median rating</text>` : "";

  host.innerHTML = `
    <svg class="bubble-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Film rating and popularity over time bubble chart">
      ${grid}
      <line class="grid-line bubble-axis" x1="${left}" y1="${top}" x2="${left}" y2="${h - bottom}"/>
      <line class="grid-line bubble-axis" x1="${left}" y1="${h - bottom}" x2="${left + innerW}" y2="${h - bottom}"/>
      ${trend}
      ${circles}
      ${xTicks}
      <text class="axis-label bubble-axis-label bubble-axis-label-x" x="${left + innerW * 0.5}" y="${h - 4}" text-anchor="middle">Release year</text>
      <text class="axis-label bubble-axis-label" x="${left - 60}" y="${top - 10}">IMDb rating</text>
    </svg>
    <div class="bubble-legends">
      <div class="bubble-legend-decade">
        <span>Color: release decade</span>
        <span>1900s</span>
        <span class="bubble-gradient" style="background: linear-gradient(90deg, ${decadeGradient})"></span>
        <span>2020s</span>
      </div>
      <div class="bubble-legend-size">
        <span>Bubble size: number of IMDb votes</span>
        <div class="bubble-size-scale">${bubbleLegend}</div>
        <span>Fewer votes</span>
        <span>More votes</span>
      </div>
      <div class="bubble-notes">
        <span>Highly voted films concentrate after the 1990s.</span>
        <span>Early films generally have fewer votes.</span>
        <span>Recent decades include many high-rated films.</span>
      </div>
    </div>`;

  const summaryNode = document.getElementById("bubbleBrushSummary");
  if (summaryNode) {
    if (!state.bubble.brushRange) {
      summaryNode.textContent = "Brush a year range on the chart to see a summary.";
    } else {
      const [y0, y1] = state.bubble.brushRange;
      const brushed = rows.filter((r) => r.year >= y0 && r.year <= y1);
      if (!brushed.length) {
        summaryNode.textContent = `Range ${y0}-${y1}: no films`;
      } else {
        const ratings = brushed.map((r) => r.rating).sort((a, b) => a - b);
        const med = ratings.length % 2 ? ratings[Math.floor(ratings.length / 2)] : (ratings[ratings.length / 2 - 1] + ratings[ratings.length / 2]) / 2;
        const avgR = average(brushed.map((r) => r.rating));
        const avgV = average(brushed.map((r) => r.votes));
        const topRated = [...brushed].sort((a, b) => b.rating - a.rating)[0];
        const mostVoted = [...brushed].sort((a, b) => b.votes - a.votes)[0];
        summaryNode.textContent = `${y0}-${y1} · ${brushed.length} films · avg ${avgR.toFixed(2)} · median ${med.toFixed(2)} · avg votes ${compactVotes(Math.round(avgV))} · top rated: ${topRated.title} · most voted: ${mostVoted.title}`;
      }
    }
  }

  if (tooltip) {
    host.querySelectorAll(".bubble-point").forEach((node) => {
      node.addEventListener("mouseenter", () => {
        const runtime = node.dataset.runtime ? `<br>Runtime: ${node.dataset.runtime} min` : "";
        const rank = node.dataset.rank ? `<br>Rank: ${node.dataset.rank}` : "";
        tooltip.hidden = false;
        tooltip.innerHTML = `${node.dataset.title}<br>Year: ${node.dataset.year}<br>Decade: ${node.dataset.decade}<br>IMDb rating: ${node.dataset.rating}<br>Votes: ${compactVotes(Number(node.dataset.votes))}<br>Genres: ${node.dataset.genres || "-"}${rank}${runtime}`;
      });
      node.addEventListener("mousemove", (event) => {
        const bounds = host.getBoundingClientRect();
        tooltip.style.left = `${event.clientX - bounds.left + 12}px`;
        tooltip.style.top = `${event.clientY - bounds.top - 12}px`;
      });
      node.addEventListener("mouseleave", () => {
        tooltip.hidden = true;
      });
      node.addEventListener("click", () => {
        if (!detail) return;
        const id = `${node.dataset.title}__${node.dataset.year}`;
        const exists = state.bubble.pinned.includes(id);
        if (exists) state.bubble.pinned = state.bubble.pinned.filter((v) => v !== id);
        else if (state.bubble.pinned.length < 3) state.bubble.pinned.push(id);
        const poster = node.dataset.poster ? `<img src="${node.dataset.poster}" alt="${node.dataset.title}">` : "";
        const summary = node.dataset.summary ? `<p>${node.dataset.summary}</p>` : "";
        detail.innerHTML = `
          <h4>${node.dataset.title}</h4>
          ${poster}
          <div class="bubble-detail-grid">
            <span>Year</span><strong>${node.dataset.year}</strong>
            <span>Rating</span><strong>${node.dataset.rating}</strong>
            <span>Votes</span><strong>${compactVotes(Number(node.dataset.votes))}</strong>
            <span>Genres</span><strong>${node.dataset.genres || "-"}</strong>
            <span>Rank</span><strong>${node.dataset.rank || "-"}</strong>
            <span>Decade</span><strong>${node.dataset.decade}</strong>
          </div>
          ${summary}
        `;
        detail.dataset.filmId = id;
        const pinnedData = rows.filter((r) => state.bubble.pinned.includes(`${r.title}__${r.year}`));
        if (pinnedData.length) {
          detail.innerHTML += `<div class="pin-compare">${pinnedData.map((r) => `<div class="pin-card"><strong>${esc(r.title)}</strong><br>${r.year} · ${r.rating.toFixed(1)}<br>${compactVotes(r.votes)} votes<br>${esc((r.genres || []).join(", "))}</div>`).join("")}</div>`;
        }
        syncUrlFromState();
      });
    });
  }

  if (detail && !detail.dataset.boundClick) {
    detail.addEventListener("click", (e) => {
      const actionable = e.target.closest("h4, .bubble-detail-grid, .bubble-detail-grid *, img, p, strong");
      if (!actionable) return;
      const id = detail.dataset.filmId;
      if (!id) return;
      state.bubble.pinned = state.bubble.pinned.filter((v) => v !== id);
      detail.dataset.filmId = "";
      detail.innerHTML = "";
      buildBubbleChart();
      syncUrlFromState();
    });
    detail.dataset.boundClick = "1";
  }

  const svg = host.querySelector(".bubble-svg");
  if (svg) {
    let brushing = false;
    let startX = null;
    let brushRect = null;
    const xToYear = (x) => Math.round(minYear + ((x - left) / innerW) * (maxYear - minYear));
    svg.addEventListener("mousedown", (e) => {
      if (e.target.closest(".bubble-point")) return;
      brushing = true;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
      startX = clamp(loc.x, left, left + innerW);
      brushRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      brushRect.setAttribute("x", String(startX));
      brushRect.setAttribute("y", String(top));
      brushRect.setAttribute("width", "1");
      brushRect.setAttribute("height", String(innerH));
      brushRect.setAttribute("fill", "rgba(228,184,92,0.12)");
      brushRect.setAttribute("stroke", "rgba(228,184,92,0.55)");
      brushRect.setAttribute("stroke-dasharray", "4 4");
      svg.appendChild(brushRect);
    });
    svg.addEventListener("mousemove", (e) => {
      if (!brushing || !brushRect) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
      const cur = clamp(loc.x, left, left + innerW);
      const x = Math.min(startX, cur);
      const wB = Math.abs(cur - startX);
      brushRect.setAttribute("x", String(x));
      brushRect.setAttribute("width", String(wB));
    });
    window.addEventListener("mouseup", () => {
      if (!brushing) return;
      brushing = false;
      if (!brushRect) return;
      const x = Number(brushRect.getAttribute("x"));
      const wB = Number(brushRect.getAttribute("width"));
      brushRect.remove();
      brushRect = null;
      if (wB < 8) return;
      const y0 = clamp(xToYear(x), minYear, maxYear);
      const y1 = clamp(xToYear(x + wB), minYear, maxYear);
      state.bubble.brushRange = [Math.min(y0, y1), Math.max(y0, y1)];
      buildBubbleChart();
      syncUrlFromState();
    });
  }
}

function renderAll() {
  buildSlopeChart();
  buildDistributionChart();
  buildHeatmap();
  buildGenreFilters();
  buildLineChart();
  buildBubbleChart();
}

document.addEventListener("DOMContentLoaded", async () => {
  state.selectedDecade = null;
  loadStateFromUrl();

  try {
    await loadData();
    const scaleToggle = document.getElementById("scaleToggle");
    const statSelect = document.getElementById("statSelect");
    const globalDecadeSelect = document.getElementById("globalDecadeSelect");
    const bubbleGenre = document.getElementById("bubbleGenreFilter");
    const bubbleMinRating = document.getElementById("bubbleMinRating");
    const bubbleMinVotes = document.getElementById("bubbleMinVotes");
    const bubbleMinRatingValue = document.getElementById("bubbleMinRatingValue");
    const bubbleMinVotesValue = document.getElementById("bubbleMinVotesValue");
    const bubbleSearch = document.getElementById("bubbleSearch");
    const bubbleHighlightMode = document.getElementById("bubbleHighlightMode");
    const bubbleSizeMode = document.getElementById("bubbleSizeMode");
    const bubbleColorMode = document.getElementById("bubbleColorMode");
    const slopeStartDecade = document.getElementById("slopeStartDecade");
    const slopeEndDecade = document.getElementById("slopeEndDecade");
    const slopeSort = document.getElementById("slopeSort");
    const slopeGenreFilter = document.getElementById("slopeGenreFilter");
    const slopeResetHighlight = document.getElementById("slopeResetHighlight");
    const distMode = document.getElementById("distMode");
    const distScale = document.getElementById("distScale");
    const distGenre = document.getElementById("distGenre");
    const distLabels = document.getElementById("distLabels");
    const lineResetFiltersBtn = document.getElementById("lineResetFiltersBtn");
    const lineResetViewBtn = document.getElementById("lineResetViewBtn");
    const bubbleResetFiltersBtn = document.getElementById("bubbleResetFiltersBtn");
    const bubbleResetHighlightsBtn = document.getElementById("bubbleResetHighlightsBtn");
    const bubbleResetViewBtn = document.getElementById("bubbleResetViewBtn");
    if (scaleToggle) {
      scaleToggle.textContent = state.lineScaleMode === "zoomed" ? "Zoomed scale" : "Full scale";
      scaleToggle.classList.toggle("active", state.lineScaleMode === "zoomed");
    }
    if (statSelect) statSelect.value = state.lineStatMode;
    if (bubbleGenre) bubbleGenre.value = state.bubble.genre;
    if (bubbleMinRating && bubbleMinRatingValue) {
      bubbleMinRating.value = String(state.bubble.minRating);
      bubbleMinRatingValue.textContent = state.bubble.minRating.toFixed(1);
    }
    if (bubbleMinVotes && bubbleMinVotesValue) {
      bubbleMinVotes.value = String(state.bubble.minVotes);
      bubbleMinVotesValue.textContent = compactVotes(state.bubble.minVotes);
    }
    if (bubbleSearch) bubbleSearch.value = state.bubble.search;
    if (bubbleHighlightMode) bubbleHighlightMode.value = state.bubble.highlightMode;
    if (bubbleSizeMode) bubbleSizeMode.value = state.bubble.sizeMode;
    if (bubbleColorMode) bubbleColorMode.value = state.bubble.colorMode;
    if (scaleToggle) {
      scaleToggle.addEventListener("click", () => {
        state.lineScaleMode = state.lineScaleMode === "zoomed" ? "full" : "zoomed";
        scaleToggle.textContent = state.lineScaleMode === "zoomed" ? "Zoomed scale" : "Full scale";
        scaleToggle.classList.toggle("active", state.lineScaleMode === "zoomed");
        buildLineChart();
        syncUrlFromState();
      });
    }
    if (statSelect) {
      statSelect.addEventListener("change", () => {
        state.lineStatMode = statSelect.value === "median" ? "median" : "average";
        buildLineChart();
        syncUrlFromState();
      });
    }
    if (globalDecadeSelect) {
      if (state.selectedDecade && DECADE_ORDER.includes(state.selectedDecade)) {
        globalDecadeSelect.value = state.selectedDecade;
      }
      globalDecadeSelect.addEventListener("change", () => {
        state.selectedDecade = globalDecadeSelect.value || null;
        buildBubbleChart();
        syncUrlFromState();
      });
    }
    if (bubbleGenre) {
      bubbleGenre.addEventListener("change", () => {
        state.bubble.genre = bubbleGenre.value;
        buildBubbleChart();
        syncUrlFromState();
      });
    }
    if (bubbleMinRating && bubbleMinRatingValue) {
      bubbleMinRating.addEventListener("input", () => {
        state.bubble.minRating = Number(bubbleMinRating.value);
        bubbleMinRatingValue.textContent = state.bubble.minRating.toFixed(1);
        buildBubbleChart();
        syncUrlFromState();
      });
    }
    if (bubbleMinVotes && bubbleMinVotesValue) {
      bubbleMinVotes.addEventListener("input", () => {
        state.bubble.minVotes = Number(bubbleMinVotes.value);
        bubbleMinVotesValue.textContent = compactVotes(state.bubble.minVotes);
        buildBubbleChart();
        syncUrlFromState();
      });
    }
    if (bubbleSearch) {
      bubbleSearch.addEventListener("input", () => {
        state.bubble.search = bubbleSearch.value.trim().toLowerCase();
        buildBubbleChart();
      });
    }
    if (bubbleHighlightMode) {
      bubbleHighlightMode.addEventListener("change", () => {
        state.bubble.highlightMode = bubbleHighlightMode.value;
        buildBubbleChart();
        syncUrlFromState();
      });
    }
    if (bubbleSizeMode) {
      bubbleSizeMode.addEventListener("change", () => {
        state.bubble.sizeMode = bubbleSizeMode.value;
        buildBubbleChart();
        syncUrlFromState();
      });
    }
    if (bubbleColorMode) {
      bubbleColorMode.addEventListener("change", () => {
        state.bubble.colorMode = bubbleColorMode.value;
        buildBubbleChart();
        syncUrlFromState();
      });
    }
    if (lineResetFiltersBtn) {
      lineResetFiltersBtn.addEventListener("click", () => {
        state.selectedGenres = new Set(["All Genres"]);
        buildGenreFilters(); buildLineChart();
        syncUrlFromState();
      });
    }
    if (lineResetViewBtn) {
      lineResetViewBtn.addEventListener("click", () => {
        state.lineScaleMode = "zoomed";
        state.lineStatMode = "average";
        if (scaleToggle) { scaleToggle.textContent = "Zoomed scale"; scaleToggle.classList.add("active"); }
        if (statSelect) statSelect.value = "average";
        buildLineChart();
        syncUrlFromState();
      });
    }
    if (bubbleResetFiltersBtn) {
      bubbleResetFiltersBtn.addEventListener("click", () => {
        state.bubble.genre = "All";
        state.bubble.minRating = 0;
        state.bubble.minVotes = 0;
        state.bubble.search = "";
        if (bubbleGenre) bubbleGenre.value = "All";
        if (bubbleMinRating) bubbleMinRating.value = "0";
        if (bubbleMinRatingValue) bubbleMinRatingValue.textContent = "0.0";
        if (bubbleMinVotes) bubbleMinVotes.value = "0";
        if (bubbleMinVotesValue) bubbleMinVotesValue.textContent = "0";
        if (bubbleSearch) bubbleSearch.value = "";
        buildBubbleChart();
        syncUrlFromState();
      });
    }
    if (bubbleResetHighlightsBtn) {
      bubbleResetHighlightsBtn.addEventListener("click", () => {
        state.bubble.highlightMode = "reset";
        state.bubble.colorMode = "release-decade";
        state.selectedDecade = null;
        state.bubble.brushRange = null;
        state.bubble.pinned = [];
        if (bubbleHighlightMode) bubbleHighlightMode.value = "reset";
        if (bubbleColorMode) bubbleColorMode.value = "release-decade";
        if (globalDecadeSelect) globalDecadeSelect.value = "";
        buildBubbleChart();
        syncUrlFromState();
      });
    }
    if (bubbleResetViewBtn) {
      bubbleResetViewBtn.addEventListener("click", () => {
        state.bubble = { genre: "All", minRating: 0, minVotes: 0, search: "", highlightMode: "reset", sizeMode: "votes", colorMode: "release-decade", brushRange: null, pinned: [] };
        if (bubbleGenre) bubbleGenre.value = "All";
        if (bubbleMinRating) bubbleMinRating.value = "0";
        if (bubbleMinRatingValue) bubbleMinRatingValue.textContent = "0.0";
        if (bubbleMinVotes) bubbleMinVotes.value = "0";
        if (bubbleMinVotesValue) bubbleMinVotesValue.textContent = "0";
        if (bubbleSearch) bubbleSearch.value = "";
        if (bubbleHighlightMode) bubbleHighlightMode.value = "reset";
        if (bubbleSizeMode) bubbleSizeMode.value = "votes";
        if (bubbleColorMode) bubbleColorMode.value = "release-decade";
        buildBubbleChart();
        syncUrlFromState();
      });
    }
    renderAll();
    window.addEventListener("resize", () => {
      renderAll();
    });
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
    if (slopeStartDecade && slopeEndDecade) {
      slopeStartDecade.innerHTML = DECADE_ORDER.map((d) => `<option value="${d}">${d}</option>`).join("");
      slopeEndDecade.innerHTML = DECADE_ORDER.map((d) => `<option value="${d}">${d}</option>`).join("");
      slopeStartDecade.value = state.slope.start;
      slopeEndDecade.value = state.slope.end;
      slopeStartDecade.addEventListener("change", () => { state.slope.start = slopeStartDecade.value; buildSlopeChart(); });
      slopeEndDecade.addEventListener("change", () => { state.slope.end = slopeEndDecade.value; buildSlopeChart(); });
    }
    if (slopeSort) slopeSort.addEventListener("change", () => { state.slope.sort = slopeSort.value; buildSlopeChart(); });
    if (slopeGenreFilter) {
      slopeGenreFilter.innerHTML = GENRES.map((g) => `<option value="${g}">${g}</option>`).join("");
      slopeGenreFilter.addEventListener("change", () => {
        state.slope.selectedGenres = new Set(Array.from(slopeGenreFilter.selectedOptions).map((o) => o.value));
        buildSlopeChart();
      });
    }
    if (slopeResetHighlight) slopeResetHighlight.addEventListener("click", () => { state.slope.lockedGenre = null; buildSlopeChart(); });
    if (distMode) distMode.addEventListener("change", () => { state.dist.mode = distMode.value; buildDistributionChart(); });
    if (distScale) distScale.addEventListener("change", () => { state.dist.scale = distScale.value === "full" ? "full" : "zoomed"; buildDistributionChart(); });
    if (distGenre) distGenre.addEventListener("change", () => { state.dist.genre = distGenre.value; buildDistributionChart(); });
    if (distLabels) distLabels.addEventListener("change", () => { state.dist.labels = distLabels.value; buildDistributionChart(); });
