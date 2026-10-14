// Service worker: guarda os arquivos do próprio app para funcionar sem internet.
// Não envia nada a lugar nenhum. A lista abaixo é preenchida pelo script de publicação.
const PRECACHE = ["assets/ibm-plex-mono-cyrillic-400-normal-BSMlKf0J.woff2","assets/ibm-plex-mono-cyrillic-400-normal-CEL4l2ZJ.woff","assets/ibm-plex-mono-cyrillic-ext-400-normal-DMdlQ8Kv.woff","assets/ibm-plex-mono-cyrillic-ext-400-normal-xuaO2J-f.woff2","assets/ibm-plex-mono-latin-400-normal-CvHOgSBP.woff","assets/ibm-plex-mono-latin-400-normal-DMJ8VG8y.woff2","assets/ibm-plex-mono-latin-ext-400-normal-BmRBH3aV.woff2","assets/ibm-plex-mono-latin-ext-400-normal-D3D2R8hC.woff","assets/ibm-plex-mono-vietnamese-400-normal-BulugwFq.woff2","assets/ibm-plex-mono-vietnamese-400-normal-DDuiU_S-.woff","assets/ibm-plex-sans-cyrillic-400-normal-BTotfTJu.woff","assets/ibm-plex-sans-cyrillic-400-normal-DZqxrq2p.woff2","assets/ibm-plex-sans-cyrillic-500-normal-ByOcLdNv.woff","assets/ibm-plex-sans-cyrillic-500-normal-CocWQlwt.woff2","assets/ibm-plex-sans-cyrillic-600-normal-71GNu3SW.woff2","assets/ibm-plex-sans-cyrillic-600-normal-BGq0mW3O.woff","assets/ibm-plex-sans-cyrillic-ext-400-normal-Dsrv2Tcn.woff","assets/ibm-plex-sans-cyrillic-ext-400-normal-g30qAdWV.woff2","assets/ibm-plex-sans-cyrillic-ext-500-normal-Cs5J6C77.woff2","assets/ibm-plex-sans-cyrillic-ext-500-normal-DB5PtV2g.woff","assets/ibm-plex-sans-cyrillic-ext-600-normal-Bz0x94Yp.woff","assets/ibm-plex-sans-cyrillic-ext-600-normal-DUMzJB7m.woff2","assets/ibm-plex-sans-greek-400-normal-D9ESIMu3.woff","assets/ibm-plex-sans-greek-400-normal-_efipK4i.woff2","assets/ibm-plex-sans-greek-500-normal-CuWXN6rf.woff","assets/ibm-plex-sans-greek-500-normal-JMMifIXV.woff2","assets/ibm-plex-sans-greek-600-normal-D-CqTdkO.woff","assets/ibm-plex-sans-greek-600-normal-DzTrcv_p.woff2","assets/ibm-plex-sans-latin-400-normal-CDDApCn2.woff2","assets/ibm-plex-sans-latin-400-normal-CYLoc0-x.woff","assets/ibm-plex-sans-latin-500-normal-6ng42L7E.woff2","assets/ibm-plex-sans-latin-500-normal-BgVn5rGT.woff","assets/ibm-plex-sans-latin-600-normal-Cu4Hd6ag.woff","assets/ibm-plex-sans-latin-600-normal-CuJfVYMP.woff2","assets/ibm-plex-sans-latin-ext-400-normal-C5H60-Va.woff2","assets/ibm-plex-sans-latin-ext-400-normal-RBey6euL.woff","assets/ibm-plex-sans-latin-ext-500-normal-D0aIdm-b.woff","assets/ibm-plex-sans-latin-ext-500-normal-DakdToA3.woff2","assets/ibm-plex-sans-latin-ext-600-normal-DIrixKbi.woff","assets/ibm-plex-sans-latin-ext-600-normal-DOrvGEcy.woff2","assets/ibm-plex-sans-vietnamese-400-normal-DG4YqDda.woff2","assets/ibm-plex-sans-vietnamese-400-normal-fK1oJ5dG.woff","assets/ibm-plex-sans-vietnamese-500-normal-BEb3_waV.woff","assets/ibm-plex-sans-vietnamese-500-normal-e4dixQRQ.woff2","assets/ibm-plex-sans-vietnamese-600-normal-DgdngZtN.woff","assets/ibm-plex-sans-vietnamese-600-normal-DpPYBSTl.woff2","assets/index-DPe5pOJa.js","assets/routes-Cj994ntC.js","assets/styles-Cyp6Yka5.css","favicon.ico","icon-192.png","icon-512.png","index.html","manifest.webmanifest"];
const CACHE = "anonimizador-eb72ae3d8a";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", ...PRECACHE])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Primeiro o cache (abre instantâneo e offline); se faltar, busca e guarda.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => caches.match("./")),
    ),
  );
});
