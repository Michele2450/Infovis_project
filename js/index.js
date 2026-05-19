const DECADES = [
  { year: "1900s", slug: "1900s", info: "Silent cinema · Origins", fill: "#a08040" },
  { year: "1910s", slug: "1910s", info: "Chaplin · Griffith", fill: "#aa8848" },
  { year: "1920s", slug: "1920s", info: "Expressionism · Silent", fill: "#b49050" },
  { year: "1930s", slug: "1930s", info: "Sound era · Golden Age", fill: "#be9858" },
  { year: "1940s", slug: "1940s", info: "Film Noir · Neorealism", fill: "#c8a060" },
  { year: "1950s", slug: "1950s", info: "CinemaScope · Epics", fill: "#d2a868" },
  { year: "1960s", slug: "1960s", info: "New Hollywood · New Wave", fill: "#dcb070" },
  { year: "1970s", slug: "1970s", info: "Coppola · Scorsese", fill: "#e6b878" },
  { year: "1980s", slug: "1980s", info: "VHS · Blockbuster", fill: "#e8c080" },
  { year: "1990s", slug: "1990s", info: "Indie · Digital", fill: "#e4c47c" },
  { year: "2000s", slug: "2000s", info: "CGI · Franchise", fill: "#dfc078" },
  { year: "2010s", slug: "2010s", info: "Marvel · Streaming", fill: "#dabc74" },
  { year: "2020s", slug: "2020s", info: "OTT · Renaissance", fill: "#d5b870" },
];

const ITEM_W = 130;

let current = 6;
let wheelAccum = 0;

const trackEl = document.getElementById("track");
const dotsEl = document.getElementById("dots");
const ctaBtn = document.getElementById("ctaBtn");
const analysisBtn = document.getElementById("analysisBtn");
const overlay = document.getElementById("overlay");

function starSVG(fill, active) {
  const pts = "50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35";
  return `<svg class="star-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${pts}" fill="${fill}" opacity="${active ? 1 : 0.4}"/>
    ${active ? `<polygon points="${pts}" fill="none" stroke="${fill}" stroke-width="1" opacity="0.5"/>` : ""}
  </svg>`;
}

function navigate(i) {
  overlay.classList.add("active");
  setTimeout(() => { window.location.href = `${DECADES[i].slug}.html`; }, 450);
}

function navigateTo(url) {
  overlay.classList.add("active");
  setTimeout(() => { window.location.href = url; }, 450);
}

function render() {
  trackEl.innerHTML = "";
  dotsEl.innerHTML = "";

  DECADES.forEach((d, i) => {
    const active = i === current;

    const item = document.createElement("div");
    item.className = `decade-item${active ? " active" : ""}`;
    item.innerHTML =
      `<div class="star-wrap">${starSVG(d.fill, active)}</div>` +
      `<div class="decade-label">${d.year}</div>` +
      `<div class="decade-info">${d.info}</div>`;
    item.addEventListener("click", () => {
      if (i !== current) {
        current = i;
        render();
      } else {
        navigate(i);
      }
    });
    trackEl.appendChild(item);

    const dot = document.createElement("div");
    dot.className = `dot${active ? " active" : ""}`;
    dot.addEventListener("click", () => {
      current = i;
      render();
    });
    dotsEl.appendChild(dot);
  });

  const offset = window.innerWidth / 2 - current * ITEM_W - ITEM_W / 2;
  trackEl.style.transform = `translateX(${offset}px)`;

  ctaBtn.href = `${DECADES[current].slug}.html`;
  ctaBtn.classList.add("visible");
  if (analysisBtn) {
    analysisBtn.href = `decade_analysis.html?decade=${DECADES[current].slug}&rank=1`;
    analysisBtn.classList.add("visible");
  }
}

ctaBtn.addEventListener("click", (e) => {
  e.preventDefault();
  navigate(current);
});

if (analysisBtn) {
  analysisBtn.addEventListener("click", (e) => {
    e.preventDefault();
    navigateTo(`decade_analysis.html?decade=${DECADES[current].slug}&rank=1`);
  });
}

document.addEventListener("wheel", (e) => {
  e.preventDefault();
  wheelAccum += e.deltaY;
  if (Math.abs(wheelAccum) >= 60) {
    if (wheelAccum > 0 && current < DECADES.length - 1) current++;
    else if (wheelAccum < 0 && current > 0) current--;
    wheelAccum = 0;
    render();
  }
}, { passive: false });

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" && current < DECADES.length - 1) { current++; render(); }
  if (e.key === "ArrowLeft" && current > 0) { current--; render(); }
  if (e.key === "Enter") navigate(current);
});

window.addEventListener("resize", render);

overlay.classList.add("active");
window.addEventListener("load", () => {
  setTimeout(() => overlay.classList.remove("active"), 100);
});

render();
