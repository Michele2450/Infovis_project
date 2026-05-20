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

const state = {
  records: [],
  selectedGenres: new Set(["All Genres"]),
  lineScaleMode: "zoomed",
  lineStatMode: "average",
  selectedDecade: null,
  bubble: {
    genre: "All",
    minRating: 0,
    minVotes: 0,
    search: "",
    highlightMode: "reset",
    sizeMode: "votes",
    colorMode: "release-decade",
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

async function loadData() {
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

  const decades = state.records.map((r) => r.label);
  const selected = Array.from(state.selectedGenres).filter((g) => g !== "All Genres");
  const comparedGenres = selected.length ? selected : ["All Genres"];
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
    return `<path class="line-series" data-series="${si}" d="${d.trim()}" fill="none" stroke="${s.color}" stroke-width="${si === 0 ? 3.2 : 2.6}" stroke-linecap="round" stroke-linejoin="round" opacity="${si === 0 ? 1 : 0.85}"/>`;
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

  const genrePalette = {
    Drama: "#c7b28a",
    Crime: "#8ea3bf",
    "Sci-Fi": "#9ab7d8",
    Comedy: "#d3a675",
    Adventure: "#b8ae7a",
    Action: "#c08d6c",
    Animation: "#d2bc86",
    Horror: "#8f7d74",
    Romance: "#b58ea3",
  };

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
    if (state.bubble.colorMode === "genre") return genrePalette[row.genres[0]] || "#8b8f97";
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
    const searchHit = !state.bubble.search || row.title.toLowerCase().includes(state.bubble.search);
    const runtimeLine = row.runtime ? `\nRuntime: ${row.runtime} min` : "";
    const opacityBase = highlighted ? Math.max(0.65, 0.8 - r / 30) : 0.38;
    const opacity = searchHit ? opacityBase : Math.min(0.16, opacityBase * 0.4);
    return `<circle class="bubble-point" data-title="${esc(row.title)}" data-year="${row.year}" data-decade="${esc(row.decade)}" data-rating="${row.rating.toFixed(1)}" data-votes="${row.votes}" data-runtime="${row.runtime || ""}" data-genres="${esc((row.genres || []).join(", "))}" data-rank="${row.rank || ""}" data-summary="${esc(row.summary || "")}" data-poster="${esc(row.poster || "")}" data-highlight="${highlighted ? "1" : "0"}" cx="${x}" cy="${y}" r="${r}" fill="${bubbleColor(row)}" opacity="${opacity.toFixed(2)}" stroke="rgba(242,230,200,0.30)" stroke-width="0.8"><title>${esc(row.title)}\n${row.year} · ${esc(row.decade)}\nRating: ${row.rating.toFixed(1)}\nVotes: ${row.votes.toLocaleString()}${runtimeLine}</title></circle>`;
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
  state.selectedDecade = null;

  const firstHeader = document.querySelector(".viz-card .viz-header h2");
  const firstSubtitle = document.querySelector(".viz-card .viz-header p");
  if (firstHeader) firstHeader.textContent = "How Film Genres Changed Across Decades";
  if (firstSubtitle) firstSubtitle.textContent = "Percentage of top films in each decade tagged with each genre, 1900s–2020s.";

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
    if (scaleToggle) {
      scaleToggle.addEventListener("click", () => {
        state.lineScaleMode = state.lineScaleMode === "zoomed" ? "full" : "zoomed";
        scaleToggle.textContent = state.lineScaleMode === "zoomed" ? "Zoomed scale" : "Full scale";
        scaleToggle.classList.toggle("active", state.lineScaleMode === "zoomed");
        buildLineChart();
      });
    }
    if (statSelect) {
      statSelect.addEventListener("change", () => {
        state.lineStatMode = statSelect.value === "median" ? "median" : "average";
        buildLineChart();
      });
    }
    if (globalDecadeSelect) {
      if (state.selectedDecade && DECADE_ORDER.includes(state.selectedDecade)) {
        globalDecadeSelect.value = state.selectedDecade;
      }
      globalDecadeSelect.addEventListener("change", () => {
        state.selectedDecade = globalDecadeSelect.value || null;
        buildBubbleChart();
      });
    }
    if (bubbleGenre) {
      bubbleGenre.addEventListener("change", () => {
        state.bubble.genre = bubbleGenre.value;
        buildBubbleChart();
      });
    }
    if (bubbleMinRating && bubbleMinRatingValue) {
      bubbleMinRating.addEventListener("input", () => {
        state.bubble.minRating = Number(bubbleMinRating.value);
        bubbleMinRatingValue.textContent = state.bubble.minRating.toFixed(1);
        buildBubbleChart();
      });
    }
    if (bubbleMinVotes && bubbleMinVotesValue) {
      bubbleMinVotes.addEventListener("input", () => {
        state.bubble.minVotes = Number(bubbleMinVotes.value);
        bubbleMinVotesValue.textContent = compactVotes(state.bubble.minVotes);
        buildBubbleChart();
      });
    }
    if (bubbleSearch) {
      bubbleSearch.addEventListener("input", () => {
        state.bubble.search = bubbleSearch.value.trim().toLowerCase();
        buildBubbleChart();
      });
    }
    if (bubbleHighlightMode) {
      bubbleHighlightMode.value = "reset";
      bubbleHighlightMode.addEventListener("change", () => {
        state.bubble.highlightMode = bubbleHighlightMode.value;
        buildBubbleChart();
      });
    }
    if (bubbleSizeMode) {
      bubbleSizeMode.addEventListener("change", () => {
        state.bubble.sizeMode = bubbleSizeMode.value;
        buildBubbleChart();
      });
    }
    if (bubbleColorMode) {
      bubbleColorMode.value = "release-decade";
      bubbleColorMode.addEventListener("change", () => {
        state.bubble.colorMode = bubbleColorMode.value;
        buildBubbleChart();
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
