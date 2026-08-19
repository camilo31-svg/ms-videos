import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("catalog contains only video sections and playable videos", async () => {
  const catalog = JSON.parse(await readFile(new URL("public/catalog.json", root), "utf8"));
  assert.equal(catalog.title, "MS Videos");
  assert.ok(catalog.items.length >= 1);
  const stack = [...catalog.items];
  const names = [];
  let playable = 0;
  while (stack.length) {
    const item = stack.pop();
    names.push(item.name);
    if (item.type === "folder") stack.push(...(item.children || []));
    if (item.type === "video") playable += 1;
    assert.ok(item.type === "folder" || item.type === "video");
  }
  assert.ok(!names.includes("Audio"));
  assert.ok(!names.includes("Libros y Revistas"));
  assert.ok(playable > 0);
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
});

test("worker resolves a remote folder into nested folders and media", async () => {
  const { default: worker } = await import(new URL(`dist/server/index.js?test=${Date.now()}`, root));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(`
    <a href="javascript:p06(null,2,'I2SXE777')">2024</a>
    <a href="Videos/Test/Grabacion%20especial.mp4">Grabacion especial.mp4</a>
    <span>128.5 MB</span>
    <a href="Videos/Test/Audio.mp3">Audio.mp3</a>
    <a href="Videos/Test/Notas.pdf">Notas.pdf</a>
  `, { status: 200, headers: { "content-type": "text/html" } });
  try {
    const response = await worker.fetch(new Request("https://player.test/api/folder?id=I1SXE97&parents=%5B%22Videos%22%2C%22Sadhu%20Ram%20Ji%22%5D"));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.children[0].name, "2024");
    assert.equal(payload.children[0].type, "folder");
    assert.equal(payload.children[1].type, "video");
    assert.match(payload.children[1].url, /Grabacion%20especial\.mp4$/);
    assert.equal(payload.children.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("worker emits absolute social metadata for its current host", async () => {
  const { default: worker } = await import(new URL(`dist/server/index.js?meta=${Date.now()}`, root));
  const response = await worker.fetch(new Request("https://media-seva.test/"));
  const html = await response.text();
  assert.match(html, /https:\/\/media-seva\.test\/og\.png/);
  assert.doesNotMatch(html, /__SITE_ORIGIN__/);
});
