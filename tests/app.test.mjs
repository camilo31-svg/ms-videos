import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("catalog contains the two video libraries and only the selected Castellano collections", async () => {
  const catalog = JSON.parse(await readFile(new URL("public/catalog.json", root), "utf8"));
  assert.equal(catalog.title, "MS Videos");
  assert.deepEqual(catalog.items.map((item) => item.name), [
    "Sant Sadhu Ram Ji",
    "Sant Ajaib Singh Ji",
    "Colecciones en castellano"
  ]);
  assert.equal(catalog.items[0].children.length, 22);
  assert.ok(catalog.items[0].children.some((item) => item.name === "2023"));
  assert.ok(catalog.items[1].children.some((item) => item.name === "1984 H"));
  assert.ok(!catalog.items[1].children.some((item) => /audio|mp3/i.test(item.name)));
  assert.deepEqual(catalog.items[2].children.map((item) => item.name), [
    "Maestro Kirpal con subtitulos",
    "Serie Lluvia de Gracia"
  ]);
});

test("app includes local library and lock-screen media support", async () => {
  const app = await readFile(new URL("public/app.js", root), "utf8");
  const html = await readFile(new URL("public/index.html", root), "utf8");
  assert.match(app, /localStorage/);
  assert.match(app, /mediaSession/);
  assert.match(app, /setActionHandler/);
  assert.match(html, /audio-mode-toggle/);
  assert.match(html, /data-tab="favorites"/);
  assert.match(html, /data-tab="history"/);
  assert.match(html, /MS Videos/);
  assert.match(app, /createYearSection/);
  assert.match(app, /year-card/);
  assert.match(app, /toggleQualityPanel/);
  assert.match(app, /calidades disponibles/);
});

test("mobile mini-player reuses the live video and shares playback state", async () => {
  const app = await readFile(new URL("public/app.js", root), "utf8");
  const html = await readFile(new URL("public/index.html", root), "utf8");
  const css = await readFile(new URL("public/styles.css", root), "utf8");
  assert.match(html, /id="mini-visual"/);
  assert.match(html, /autopictureinpicture/);
  assert.match(app, /els\.miniVisual\.append\(els\.video\)/);
  assert.match(app, /els\.video\.controls = !showLiveMiniVideo/);
  assert.match(app, /els\.miniPlay\.addEventListener\("click"/);
  assert.match(app, /requestPictureInPicture/);
  assert.match(app, /webkitSetPresentationMode/);
  assert.match(css, /grid-template-columns: 96px minmax\(0, 1fr\)/);
  const serviceWorker = await readFile(new URL("public/sw.js", root), "utf8");
  assert.match(serviceWorker, /ms-videos-pages-v2/);
});

test("app supports system-aware light and dark themes with a saved preference", async () => {
  const app = await readFile(new URL("public/app.js", root), "utf8");
  const html = await readFile(new URL("public/index.html", root), "utf8");
  const css = await readFile(new URL("public/styles.css", root), "utf8");
  assert.match(html, /id="theme-toggle"/);
  assert.match(html, /prefers-color-scheme: dark/);
  assert.match(app, /ms-videos-theme-v1/);
  assert.match(app, /applyTheme/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /color-scheme: dark/);
});

test("static PWA assets resolve below the GitHub Pages repository path", async () => {
  const app = await readFile(new URL("public/app.js", root), "utf8");
  const html = await readFile(new URL("public/index.html", root), "utf8");
  const manifest = JSON.parse(await readFile(new URL("public/manifest.webmanifest", root), "utf8"));
  const serviceWorker = await readFile(new URL("public/sw.js", root), "utf8");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.match(html, /href="\.\/manifest\.webmanifest"/);
  assert.match(html, /src="\.\/app\.js"/);
  assert.match(app, /new URL\("catalog\.json", document\.baseURI\)/);
  assert.match(app, /new URL\("sw\.js", document\.baseURI\)/);
  assert.match(serviceWorker, /"\.\/catalog\.json"/);
});

test("worker collapses quality folders into one video with selectable variants", async () => {
  const { default: worker } = await import(new URL(`dist/server/index.js?test=${Date.now()}`, root));
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (input) => {
    const href = String(input);
    requested.push(href);
    if (href.includes("I0SXE5SXC")) return new Response(`
      <div id="I1SXE6SXP"><a class="SXLP1">Audio only - MP3</a></div>
      <div id="I1SXE7SXP"><a class="SXLP1">Cellphones iPods Low Res - Celulares Baja Res</a></div>
      <div id="I1SXE8SXP"><a class="SXLP1">Tablets - DVD Resolution</a></div>
    `, { status: 200 });
    if (href.includes("I1SXE7SXC")) return new Response(`
      <a href="2002/Low/SR%20020500%20INDIA%20Discourses%20Pt%201%20-2h%2036m-%201052.mp4">SR 020500 INDIA Discourses Pt 1 -2h 36m- 1052.mp4 100.8MB</a>
      <a href="2002/Low/SR%20020501%20INDIA%20Questions%20-1h-%201052.mp4">SR 020501 INDIA Questions -1h- 1052.mp4 40.0MB</a>
    `, { status: 200 });
    if (href.includes("I1SXE8SXC")) return new Response(`
      <a href="2002/DVD/0205--%20INDIA%20Discourses%20Pt%201%20-2h%2036m-%201052.mp4">0205-- INDIA Discourses Pt 1 -2h 36m- 1052.mp4 798.4MB</a>
      <a href="2002/DVD/0205--%20INDIA%20Questions%20-1h-%201052.mp4">0205-- INDIA Questions -1h- 1052.mp4 300.0MB</a>
    `, { status: 200 });
    return new Response("Not found", { status: 404 });
  };
  try {
    const response = await worker.fetch(new Request("https://player.test/api/folder?source=sadhu&id=I0SXE5&name=2002&parents=%5B%22Sant%20Sadhu%20Ram%20Ji%22%2C%222002%22%5D"));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.children.length, 2);
    const discourse = payload.children.find((item) => item.name.includes("Discourses Pt 1"));
    assert.equal(discourse.type, "video");
    assert.deepEqual(discourse.variants.map((variant) => variant.quality), ["DVD", "Baja"]);
    assert.equal(discourse.variants[0].size, "798.4MB");
    assert.ok(discourse.variants.every((variant) => variant.url.startsWith("https://mediaseva1.dsmynas.net/")));
    assert.ok(payload.children.some((item) => item.name.includes("Questions")));
    assert.ok(requested.every((href) => href.startsWith("http://mediaseva1.dsmynas.net/")));
    assert.ok(requested.some((href) => decodeURIComponent(href).includes("- Sadhu Ram JiI1SXE7SXC.htm")));
    assert.ok(!requested.some((href) => href.includes("I1SXE6SXC")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("development preview reloads a newly compiled worker", async () => {
  const server = await readFile(new URL("scripts/dev-server.mjs", root), "utf8");
  assert.match(server, /stat\(workerPath\)/);
  assert.match(server, /version !== workerVersion/);
  assert.match(server, /await currentWorker\(\)/);
});

test("worker keeps a single available quality directly playable", async () => {
  const { default: worker } = await import(new URL(`dist/server/index.js?single=${Date.now()}`, root));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(`
    <a href="1997/Video%20unico.mp4">Video unico.mp4 88.0MB</a>
  `, { status: 200 });
  try {
    const response = await worker.fetch(new Request("https://player.test/api/folder?source=ajaib&id=I0SXE635&name=1997&parents=%5B%22Sant%20Ajaib%20Singh%20Ji%22%2C%221997%22%5D"));
    const payload = await response.json();
    assert.equal(payload.children[0].name, "Video unico");
    assert.equal(payload.children[0].variants.length, 1);
    assert.equal(payload.children[0].variants[0].quality, "MP4");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("worker emits absolute GitHub Pages social metadata", async () => {
  const { default: worker } = await import(new URL(`dist/server/index.js?meta=${Date.now()}`, root));
  const response = await worker.fetch(new Request("https://media-seva.test/"));
  const html = await response.text();
  assert.match(html, /https:\/\/camilo31-svg\.github\.io\/ms-videos\/og\.png/);
  assert.doesNotMatch(html, /__SITE_ORIGIN__/);
});
