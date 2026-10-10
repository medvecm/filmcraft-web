// FilmCraft service worker: lets the installed web app (manifest.webmanifest) start offline.
//
// Online nothing changes: the page and the other unversioned files are fetched from the network
// (refreshing the cached copy), so a new deployment shows up on the next load as before. The glue
// and the wasm carry the build hash in their URL (`?v=…`, see index.html) and never change, so
// they come from the cache. Offline, everything comes from the cache. Any other request (media,
// `importUrl`, range reads) is left to the browser.
//
// `cargo xtask web` replaces 67eb8cb54f9e2249 with the build hash, so every build is a new worker: it
// caches its build's files when it installs and drops older builds' files when it activates.
const BUILD = "67eb8cb54f9e2249";
const HASHED = !BUILD.startsWith("__");
const BASE = new URL("./", self.location.href);
// One cache per deployment path: other apps (or FilmCraft builds) on this origin keep theirs.
const CACHE = "filmcraft:" + BASE.pathname;
// Network first, the cached copy when offline.
const SHELL = ["index.html", "audio-worklet.js", "favicon.png", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
// Loaded with `?v=<build>`: cache first.
const VERSIONED = ["filmcraft_web.js", "filmcraft_web_bg.wasm"];
// How long opening the app waits for the network before it starts from the cached page instead.
const NAVIGATE_TIMEOUT_MS = 4000;

const href = (name) => new URL(name, BASE).href;
// Unversioned files are always revalidated with the server: hosts that can't set `no-cache` on
// them (GitHub Pages caches everything for 10 minutes) would otherwise hand out the old page, or an
// old worklet next to a new wasm, after a deployment.
const fresh = (req) => new Request(req, { cache: "no-cache" });
// A followed redirect (hosts that send /index.html to /) can't answer a navigation later: keep a
// plain copy.
const storable = (res) => (res.redirected ? new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers }) : res);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const versioned = HASHED ? VERSIONED.map((f) => new Request(href(`${f}?v=${BUILD}`))) : [];
      await Promise.all(
        [...SHELL.map((f) => fresh(href(f))), ...versioned].map(async (req) => {
          const res = await fetch(req);
          if (!res.ok) throw new Error(`${req.url}: HTTP ${res.status}`);
          await cache.put(req.url, storable(res));
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const req of await cache.keys()) {
        const url = new URL(req.url);
        const name = url.pathname.slice(BASE.pathname.length);
        if (VERSIONED.includes(name) && url.searchParams.get("v") !== BUILD) {
          await cache.delete(req);
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  const name = url.pathname.slice(BASE.pathname.length);
  if (req.mode === "navigate") {
    // any query (`?webgl`, `?empty`…) is the same page
    if (name === "" || name === "index.html") {
      event.respondWith(networkFirst(event, "index.html", NAVIGATE_TIMEOUT_MS));
    }
  } else if (VERSIONED.includes(name) && url.searchParams.has("v")) {
    event.respondWith(cacheFirst(event));
  } else if (SHELL.includes(name)) {
    event.respondWith(networkFirst(event, name, 0));
  }
});

async function networkFirst(event, name, timeoutMs) {
  const network = fetch(fresh(event.request)).then((res) => {
    if (res.ok && res.type === "basic") {
      const copy = storable(res.clone());
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(href(name), copy)));
    }
    return res;
  });
  // keep the worker alive until the cached copy is refreshed, even when the cache answers first;
  // a failure is handled below
  event.waitUntil(network.catch(() => {}));
  const cache = await caches.open(CACHE);
  try {
    if (timeoutMs > 0) {
      const late = new Promise((resolve) => setTimeout(resolve, timeoutMs, null));
      const res = await Promise.race([network, late]);
      if (res) return res;
      // a slow network: start from the cached page; the fetch still refreshes the cache
      const cached = await cache.match(href(name));
      if (cached) return cached;
    }
    return await network;
  } catch (err) {
    const cached = await cache.match(href(name));
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  const res = await fetch(event.request);
  if (res.ok && res.type === "basic") event.waitUntil(cache.put(event.request, storable(res.clone())));
  return res;
}
