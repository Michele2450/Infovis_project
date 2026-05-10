const DECADE_ORDER = [
  "1900s",
  "1910s",
  "1920s",
  "1930s",
  "1940s",
  "1950s",
  "1960s",
  "1970s",
  "1980s",
  "1990s",
  "2000s",
  "2010s",
  "2020s",
];

const DECADE_META = {
  "1900s": {
    accent: "#b69a3b",
    theme: "Origins and illusion",
    blurb: "Cinema is still a spectacle of invention: shorts, trick films, and the first narrative experiments dominate the screen.",
  },
  "1910s": {
    accent: "#c08b3f",
    theme: "Narrative language emerges",
    blurb: "Feature-length storytelling, parallel montage, and early stars start to define what film grammar can become.",
  },
  "1920s": {
    accent: "#c16f43",
    theme: "Silent mastery",
    blurb: "The silent era reaches artistic maturity through expressionism, visual comedy, melodrama, and increasingly ambitious production design.",
  },
  "1930s": {
    accent: "#bf5f4d",
    theme: "Sound and studio power",
    blurb: "The arrival of sound reshapes genre conventions while the studio system turns cinema into a polished industrial language.",
  },
  "1940s": {
    accent: "#a65358",
    theme: "War, noir, and realism",
    blurb: "Global conflict and post-war reflection create darker tones, moral ambiguity, and a stronger taste for realism.",
  },
  "1950s": {
    accent: "#9a5074",
    theme: "Scale and spectacle",
    blurb: "Color, widescreen, and international auteurs expand the cinematic experience across epics, dramas, and genre reinvention.",
  },
  "1960s": {
    accent: "#6b5f9f",
    theme: "New waves and rupture",
    blurb: "Formal experimentation accelerates as new national cinemas and counterculture sensibilities challenge classical storytelling.",
  },
  "1970s": {
    accent: "#4e75a6",
    theme: "Auteur-driven intensity",
    blurb: "New Hollywood blends personal vision with box-office ambition, producing some of the most influential films in popular cinema.",
  },
  "1980s": {
    accent: "#377f94",
    theme: "Blockbuster momentum",
    blurb: "Franchise logic, home video, and high-concept storytelling shape a decade of crowd-pleasing scale and iconic pop imagery.",
  },
  "1990s": {
    accent: "#2d8b76",
    theme: "Indie energy and transition",
    blurb: "Independent voices, genre hybridity, and early digital workflows push cinema toward a more diverse contemporary landscape.",
  },
  "2000s": {
    accent: "#4b8c51",
    theme: "Digital expansion",
    blurb: "Franchises grow, CGI becomes central, and global audiences increasingly experience cinema through transmedia worlds.",
  },
  "2010s": {
    accent: "#7f8f45",
    theme: "Streaming and universes",
    blurb: "Prestige, platforms, and cinematic universes coexist, making the decade a negotiation between scale, serialization, and authorship.",
  },
  "2020s": {
    accent: "#a0893c",
    theme: "Recalibration",
    blurb: "The theatrical experience is renegotiated while streaming, recovery, and global circulation reshape how films are discovered and discussed.",
  },
};

function getDecadeMeta(label) {
  return DECADE_META[label] || {
    accent: "#d4a84b",
    theme: "Cinema history",
    blurb: "A decade of film history seen through the highest-ranked IMDb titles.",
  };
}

function getDecadeIndex(label) {
  return DECADE_ORDER.indexOf(label);
}

function getPreviousDecade(label) {
  const index = getDecadeIndex(label);
  return index > 0 ? DECADE_ORDER[index - 1] : null;
}

function getNextDecade(label) {
  const index = getDecadeIndex(label);
  return index >= 0 && index < DECADE_ORDER.length - 1 ? DECADE_ORDER[index + 1] : null;
}

function formatVotes(value) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1e6) return `${(value / 1e6).toFixed(value >= 10e6 ? 1 : 2)}M`;
  if (value >= 1e3) return `${Math.round(value / 1e3)}K`;
  return String(value);
}

function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function clampPercent(value, base) {
  if (!Number.isFinite(value) || !Number.isFinite(base) || base === 0) return 0;
  return Math.max(0, Math.min(100, (value / base) * 100));
}

function toSlug(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildGenreStats(films) {
  const counts = new Map();

  films.forEach((film) => {
    (film.genres || []).forEach((genre) => {
      counts.set(genre, (counts.get(genre) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .map(([genre, count]) => ({
      genre,
      count,
      percentage: Math.round((count / films.length) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre));
}

function getFilmPercentile(film, films, key) {
  const ordered = [...films]
    .filter((candidate) => Number.isFinite(candidate[key]))
    .sort((a, b) => b[key] - a[key]);

  const index = ordered.findIndex((candidate) => candidate.rank === film.rank);
  if (index === -1 || !ordered.length) return null;

  const percentile = Math.round(((ordered.length - index) / ordered.length) * 100);
  return {
    rank: index + 1,
    total: ordered.length,
    percentile,
  };
}

function getDecadeRecord(label) {
  if (typeof DECADE_DB !== "object" || !DECADE_DB) return null;
  const decade = DECADE_DB[label];
  if (!decade) return null;

  const films = [...(decade.films || [])].sort((a, b) => a.rank - b.rank);
  const meta = getDecadeMeta(label);
  const ratings = films.map((film) => film.rating).filter(Number.isFinite);
  const runtimes = films.map((film) => film.runtime).filter(Number.isFinite);
  const votes = films.map((film) => film.votes).filter(Number.isFinite);
  const genreStats = buildGenreStats(films);
  const topRatedFilm = [...films].sort((a, b) => b.rating - a.rating || a.rank - b.rank)[0] || null;
  const mostVotedFilm = [...films].sort((a, b) => b.votes - a.votes || a.rank - b.rank)[0] || null;

  return {
    ...decade,
    label,
    meta,
    films,
    genreStats,
    filmCount: films.length,
    avgRating: decade.avgRating ?? average(ratings),
    avgRuntime: decade.avgRuntime ?? average(runtimes),
    avgVotes: decade.avgVotes ?? average(votes),
    minRuntime: runtimes.length ? Math.min(...runtimes) : null,
    maxRuntime: runtimes.length ? Math.max(...runtimes) : null,
    minRating: decade.minRating ?? (ratings.length ? Math.min(...ratings) : null),
    maxRating: ratings.length ? Math.max(...ratings) : null,
    topRatedFilm,
    mostVotedFilm,
  };
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getFilmByRank(label, rank) {
  const decade = getDecadeRecord(label);
  if (!decade) return null;
  return decade.films.find((film) => film.rank === rank) || null;
}

function describeDifference(value, averageValue, label, higherIsBetter = true) {
  if (!Number.isFinite(value) || !Number.isFinite(averageValue)) {
    return `No ${label.toLowerCase()} comparison is available.`;
  }

  const delta = value - averageValue;
  const absDelta = Math.abs(delta);

  if (absDelta < 0.05) {
    return `${label} is almost exactly aligned with the decade average.`;
  }

  const direction = delta > 0 ? "above" : "below";
  const quality = higherIsBetter
    ? (delta > 0 ? "stronger" : "weaker")
    : (delta > 0 ? "longer" : "shorter");

  return `${label} is ${quality} than the decade baseline, sitting ${formatNumber(absDelta, 1)} ${direction === "above" ? "points" : "points"} ${direction} average.`;
}
