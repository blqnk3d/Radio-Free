/* Radio Österreich — tiny live-radio PWA. No dependencies, no build step. */
(() => {
"use strict";

/* streams verified working: https://orf-live.ors-shoutcast.at/<id>-q2a (192 kbps) / -q1a (128) */
const STATIONS = [
  { id:"noe", mono:"NÖ", name:"Radio Niederösterreich", sub:"Lower Austria · hits & oldies" },
  { id:"oe3", mono:"Ö3", name:"Hitradio Ö3",            sub:"Charts & hits" },
  { id:"oe1", mono:"Ö1", name:"Ö1",                     sub:"Culture, classical & news" },
  { id:"fm4", mono:"FM4",name:"FM4",                    sub:"Alternative & youth culture" },
  { id:"wie", mono:"W",  name:"Radio Wien",             sub:"Vienna" },
  { id:"bgl", mono:"B",  name:"Radio Burgenland",       sub:"Burgenland" },
  { id:"stm", mono:"ST", name:"Radio Steiermark",       sub:"Styria" },
  { id:"ktn", mono:"K",  name:"Radio Kärnten",          sub:"Carinthia" },
  { id:"sbg", mono:"S",  name:"Radio Salzburg",         sub:"Salzburg" },
  { id:"tir", mono:"T",  name:"Radio Tirol",            sub:"Tyrol" },
  { id:"vbg", mono:"V",  name:"Radio Vorarlberg",       sub:"Vorarlberg" },
  { id:"ooe", mono:"OÖ", name:"Radio Oberösterreich",   sub:"Upper Austria" },
];
const DEFAULT = "noe";
const $ = (s) => document.querySelector(s);
const el = {
  audio: $("#audio"), mono: $("#npMono"), name: $("#npName"), show: $("#npShow"),
  live: $("#liveBadge"), play: $("#playBtn"), prev: $("#prevBtn"), next: $("#nextBtn"),
  vol: $("#vol"), status: $("#status"), list: $("#stations"),
  offline: $("#offlineBanner"), toast: $("#toast"),
};
const store = {
  get: (k, fb) => { try { const v = JSON.parse(localStorage.getItem("radio:" + k)); return v == null ? fb : v; } catch { return fb; } },
  set: (k, v) => { try { localStorage.setItem("radio:" + k, JSON.stringify(v)); } catch {} },
};

const state = {
  current: store.get("last", DEFAULT),
  playing: false, buffering: false, wantPlay: false,
  quality: "hi", fellBack: false,
  volume: store.get("vol", 0.8),
  favs: new Set(store.get("favs", [])),
  epg: null,
};
const byId = (id) => STATIONS.find((s) => s.id === id) || byId(DEFAULT);
const url = (s) => `https://orf-live.ors-shoutcast.at/${s.id}-${state.quality === "hi" ? "q2a" : "q1a"}`;

let toastT = 0;
const toast = (m) => { el.toast.textContent = m; el.toast.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove("show"), 2400); };
const status = (m, err) => { el.status.textContent = m; el.status.classList.toggle("err", !!err); };
const hhmm = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

/* ---------- render ---------- */
function renderNow() {
  const s = byId(state.current);
  el.mono.textContent = s.mono;
  el.name.textContent = s.name;
  el.live.hidden = !state.playing;
  document.body.classList.toggle("playing", state.playing);
  document.body.classList.toggle("buffering", state.buffering);
  el.play.setAttribute("aria-label", state.playing ? "Pause" : "Play");
  document.title = state.playing ? `${s.name} · live` : "Radio Österreich";
  if (!state.playing && !state.buffering && !el.show.dataset.live) el.show.textContent = "Tap play to listen";
  renderList();
  mediaMeta();
}

function renderList() {
  const favs = STATIONS.filter((s) => state.favs.has(s.id));
  const rest = STATIONS.filter((s) => !state.favs.has(s.id));
  el.list.innerHTML = [...favs, ...rest].map((s) => `
    <li class="srow${s.id === state.current ? " current" : ""}${s.id === state.current && state.playing ? " on" : ""}">
      <button class="hit" data-id="${s.id}" aria-label="Play ${s.name}">
        <span class="mono">${s.mono}</span>
        <span class="meta"><span class="name">${s.name}</span><span class="sub">${s.sub}</span></span>
        <span class="seq" aria-hidden="true"><i></i><i></i><i></i></span>
      </button>
      <button class="star" data-fav="${s.id}" aria-pressed="${state.favs.has(s.id)}" aria-label="Favourite ${s.name}">
        <svg viewBox="0 0 24 24"><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8Z"/></svg>
      </button>
    </li>`).join("");
}

/* ---------- playback ---------- */
function start() {
  const s = byId(state.current);
  if (!navigator.onLine) { status("You’re offline — connect to listen.", true); return; }
  state.wantPlay = true; state.buffering = true; status("Connecting…");
  el.audio.src = url(s);
  el.audio.load();
  el.audio.volume = state.volume;
  el.audio.play().catch((e) => {
    if (e && e.name === "NotAllowedError") { state.wantPlay = state.buffering = state.playing = false; status("Tap play to start."); renderNow(); }
  });
  renderNow();
}
function stop() { state.wantPlay = state.buffering = false; el.audio.pause(); renderNow(); }
const toggle = () => (state.playing || state.buffering ? stop() : start());

function select(id, autoplay) {
  if (id === state.current) { if (autoplay && !state.playing) start(); return; }
  state.current = id; store.set("last", id);
  state.epg = null; delete el.show.dataset.live;
  el.audio.pause(); el.audio.removeAttribute("src");
  state.buffering = false;
  if (autoplay || state.playing || state.wantPlay) start(); else renderNow();
  fetchEpg();
}
const step = (d) => {
  const i = STATIONS.findIndex((s) => s.id === state.current);
  const n = STATIONS[(i + d + STATIONS.length) % STATIONS.length];
  select(n.id, state.playing || state.wantPlay);
  toast(n.name);
};

el.audio.addEventListener("playing", () => {
  state.playing = true; state.buffering = false; state.fellBack = false;
  status(""); el.show.dataset.live = "1"; paintEpg();
  if (navigator.mediaSession) navigator.mediaSession.playbackState = "playing";
  renderNow();
});
el.audio.addEventListener("pause", () => {
  state.playing = state.buffering = false; delete el.show.dataset.live;
  if (navigator.mediaSession) navigator.mediaSession.playbackState = "paused";
  renderNow();
});
el.audio.addEventListener("waiting", () => { state.buffering = true; status("Buffering…"); renderNow(); });
el.audio.addEventListener("error", (ev) => {
  if (!state.wantPlay) return;
  const s = byId(state.current);
  if (!el.audio.src || !el.audio.src.includes("/" + s.id + "-")) return;   /* stale error from a previous station */
  if (state.quality === "hi" && !state.fellBack) {          /* quietly retry on the lighter stream */
    state.fellBack = true; state.quality = "lo"; status("Reconnecting…"); setTimeout(start, 500); return;
  }
  state.playing = state.buffering = state.wantPlay = false;
  status("Can’t play this stream right now.", true); renderNow();
});

/* ---------- programme info (ORF) ---------- */
async function fetchEpg() {
  const id = state.current;
  try {
    const r = await fetch(`https://audioapi.orf.at/${id}/api/json/current/broadcasts`, { cache: "no-store" });
    if (!r.ok || id !== state.current) return;
    const all = (await r.json()).flatMap((d) => d.broadcasts || []);
    const now = Date.now();
    state.epg = all.find((b) => b.start <= now && b.end > now) || null;
    paintEpg();
  } catch {}
}
function paintEpg() {
  if (!state.epg) return;
  const t = (state.epg.title || "").replace(/\s+/g, " ").trim();
  if (t) el.show.textContent = `${t} · ${hhmm(state.epg.start)}–${hhmm(state.epg.end)}`;
}
setInterval(() => { if (!document.hidden && navigator.onLine && (state.playing || state.wantPlay)) fetchEpg(); }, 60000);

/* ---------- lock screen / headset ---------- */
function mediaMeta() {
  const ms = navigator.mediaSession; if (!ms || typeof MediaMetadata === "undefined") return;
  const s = byId(state.current);
  try {
    ms.metadata = new MediaMetadata({ title: state.epg ? state.epg.title : s.name, artist: s.name + " · live", album: "Radio Österreich" });
  } catch {}
  try {
    ms.setActionHandler("play", start); ms.setActionHandler("pause", stop);
    ms.setActionHandler("previoustrack", () => step(-1)); ms.setActionHandler("nexttrack", () => step(1));
  } catch {}
}

/* ---------- ui wiring ---------- */
el.play.addEventListener("click", toggle);
el.prev.addEventListener("click", () => step(-1));
el.next.addEventListener("click", () => step(1));
el.vol.addEventListener("input", () => {
  state.volume = el.vol.value / 100; el.audio.volume = state.volume; el.audio.muted = false;
  store.set("vol", state.volume);
  el.vol.style.setProperty("--fill", el.vol.value + "%");
});
el.list.addEventListener("click", (e) => {
  const fav = e.target.closest("[data-fav]");
  if (fav) {
    const id = fav.dataset.fav;
    state.favs.has(id) ? state.favs.delete(id) : state.favs.add(id);
    store.set("favs", [...state.favs]); renderList(); return;
  }
  const hit = e.target.closest("[data-id]");
  if (hit) select(hit.dataset.id, true);
});
addEventListener("keydown", (e) => {
  const t = e.target;
  if (t && typeof t.matches === "function" && t.matches("input,select,textarea")) return;
  if (e.key === " ") { e.preventDefault(); toggle(); }
  else if (e.key === "n" || e.key === "ArrowRight") step(1);
  else if (e.key === "p" || e.key === "ArrowLeft") step(-1);
  else if (e.key === "ArrowUp") { e.preventDefault(); el.vol.value = Math.min(100, +el.vol.value + 5); el.vol.dispatchEvent(new Event("input")); }
  else if (e.key === "ArrowDown") { e.preventDefault(); el.vol.value = Math.max(0, +el.vol.value - 5); el.vol.dispatchEvent(new Event("input")); }
});
const paintNet = () => { el.offline.hidden = navigator.onLine; if (navigator.onLine && state.wantPlay && !state.playing) start(); };
addEventListener("online", paintNet); addEventListener("offline", paintNet);

/* ---------- boot ---------- */
const param = new URLSearchParams(location.search).get("station");
if (param && byId(param).id === param) state.current = param;
el.audio.volume = state.volume;
el.vol.value = Math.round(state.volume * 100);
el.vol.style.setProperty("--fill", el.vol.value + "%");
renderNow(); fetchEpg(); paintNet();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
})();
