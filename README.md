# Radio Österreich — a tiny live-radio PWA

One tap plays the stream. That's the whole app.

* **12 ORF stations** built in (Radio Niederösterreich is the default), favourites pinned to the top with ★
* **Installable** (Android/Windows/Chrome + iPhone via *Share → Add to Home Screen*), opens offline once installed
* **Lock-screen & headset controls**, live "now playing" programme name from ORF, sleep-free & ad-free
* Muted **"Deep Sea"** palette from [coolors.co](https://coolors.co/palette/0d1b2a-1b263b-415a77-778da9-e0e1dd), dark & light mode
* No frameworks, no build step, no images in the UI, ~40 KB total



Service workers (and therefore "install as app") need **localhost or HTTPS**.
To put it online: drop the folder on Netlify / Vercel / GitHub Pages / any web space — nothing else to configure.

## Files

| file | purpose |
|---|---|
| `index.html` | the whole UI |
| `app.css` | styles + palette |
| `app.js` | player, station list, favourites, programme info |
| `sw.js` | offline cache for the app shell (never caches audio) |
| `manifest.webmanifest` | install metadata, icons, shortcuts |
| `assets/*.png` | the only 3 images: app icons |

## Tweaks
* **Default station** – `DEFAULT = "noe"` in `app.js` (ids: `noe oe3 oe1 fm4 wie bgl stm ktn sbg tir vbg ooe`)
* **Add/reorder stations** – edit the `STATIONS` array at the top of `app.js`
* **Stream quality** – `state.quality = "hi"` (192 kbps) or `"lo"` (128 kbps, less data); on a stream error the app automatically retries once at 128 kbps
* **Regenerate icons** – `python3 tools/make_icons.py` (needs Pillow)

Streams: `orf-live.ors-shoutcast.at` · programme data: `audioapi.orf.at` (both public, CORS-enabled, unofficial use).
# Radio-Free
