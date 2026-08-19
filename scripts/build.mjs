import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const publicDir = join(root, "public");
const distDir = join(root, "dist");
const serverDir = join(distDir, "server");
const clientDir = join(distDir, "client");

if (distDir !== join(root, "dist")) throw new Error("Unexpected build directory");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  }));
  return nested.flat();
}

const required = ["index.html", "styles.css", "app.js", "catalog.json", "manifest.webmanifest", "sw.js", "artwork.png", "og.png", "icon-192.png", "icon-512.png"];
for (const file of required) await readFile(join(publicDir, file));

await rm(distDir, { recursive: true, force: true });
await mkdir(serverDir, { recursive: true });
await cp(publicDir, clientDir, { recursive: true });

const files = await listFiles(publicDir);
const assets = [];
for (const file of files) {
  const route = `/${relative(publicDir, file).split(sep).join("/")}`;
  const body = (await readFile(file)).toString("base64");
  const contentType = mimeTypes[extname(file).toLowerCase()] || "application/octet-stream";
  assets.push([route, { body, contentType }]);
}

const worker = String.raw`const ASSETS = new Map(${JSON.stringify(assets)});
const CATALOG_BASE = "https://mediaseva1.dsmynas.net/_%20Sant%20Mat%20Castellano/";
const FILE_TYPES = new Map([
  [".mp4", "video"], [".m4v", "video"], [".mov", "video"], [".webm", "video"], [".mpg", "video"], [".mpeg", "video"],
  [".mp3", "audio"], [".m4a", "audio"], [".aac", "audio"], [".wav", "audio"], [".ogg", "audio"], [".flac", "audio"], [".wma", "audio"],
  [".pdf", "document"], [".epub", "document"], [".doc", "document"], [".docx", "document"], [".txt", "document"]
]);

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decodeHtml(value) {
  const entities = {
    amp: "&", quot: "\"", apos: "'", lt: "<", gt: ">", nbsp: " ",
    aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
    Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
    ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü"
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (full, entity) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return entities[entity] ?? entities[entity.toLowerCase()] ?? full;
  });
}

function stripHtml(value) {
  return decodeHtml(value.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<[^>]+>/gi, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function stableId(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return "media-" + (hash >>> 0).toString(16).padStart(8, "0");
}

function extractFolders(html) {
  const ids = new Set([...html.matchAll(/p06\s*\(\s*null\s*,\s*\d+\s*,\s*["'](I\d+SXE\d+)["']\s*\)/gi)].map((match) => match[1]));
  const anchors = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || [];
  return [...ids].map((id) => {
    const names = anchors.filter((anchor) => anchor.includes(id)).map(stripHtml).filter(Boolean);
    return {
      id,
      type: "folder",
      name: names.at(-1) || "Carpeta " + id,
      children: [],
      loaded: false
    };
  });
}

function extractFiles(html, parents) {
  const files = [];
  const seen = new Set();
  const links = html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  for (const match of links) {
    const href = decodeHtml(match[1]).trim();
    if (!href || /^(javascript:|#|mailto:)/i.test(href)) continue;
    const cleanHref = href.split(/[?#]/)[0];
    const extension = cleanHref.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
    const type = FILE_TYPES.get(extension);
    if (!type) continue;
    const mediaUrl = new URL(href.replaceAll("\\", "/"), CATALOG_BASE).href;
    if (seen.has(mediaUrl)) continue;
    seen.add(mediaUrl);
    const fallbackName = decodeURIComponent(cleanHref.split("/").at(-1) || "Grabacion");
    const name = stripHtml(match[2]) || fallbackName;
    const tail = html.slice(match.index + match[0].length, match.index + match[0].length + 320);
    const size = tail.match(/\d+(?:[.,]\d+)?\s*(?:KB|MB|GB)/i)?.[0]?.replace(",", ".") || "";
    files.push({
      id: stableId(mediaUrl),
      type,
      name,
      url: mediaUrl,
      size,
      path: [...parents, name].join(" / ")
    });
  }
  return files;
}

async function serveCatalogFolder(url) {
  const id = url.searchParams.get("id") || "";
  if (!/^I\d+SXE\d+$/.test(id)) {
    return Response.json({ error: "Invalid folder" }, { status: 400 });
  }
  let parents = [];
  try {
    const parsed = JSON.parse(url.searchParams.get("parents") || "[]");
    if (Array.isArray(parsed)) parents = parsed.slice(0, 20).map((part) => String(part).slice(0, 160));
  } catch {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  const sourceUrl = new URL("_ Sant Mat Castellano" + id + "SXC.htm", CATALOG_BASE);
  const sourceResponse = await fetch(sourceUrl, { headers: { accept: "text/html" } });
  if (!sourceResponse.ok) {
    return Response.json({ error: "Catalog unavailable" }, { status: 502 });
  }
  const html = await sourceResponse.text();
  const children = [...extractFolders(html), ...extractFiles(html, parents)].sort((left, right) => {
    if (left.type === "folder" && right.type !== "folder") return -1;
    if (left.type !== "folder" && right.type === "folder") return 1;
    return left.name.localeCompare(right.name, "es", { numeric: true });
  });
  return Response.json({ id, children }, {
    headers: { "cache-control": "public, max-age=1800", "x-content-type-options": "nosniff" }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/api/folder") return serveCatalogFolder(url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    let asset = ASSETS.get(pathname);
    if (!asset && !pathname.includes(".")) asset = ASSETS.get("/index.html");
    if (!asset) return new Response("Not found", { status: 404 });
    const headers = new Headers({
      "content-type": asset.contentType,
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin"
    });
    if (pathname.startsWith("/icon-") || pathname === "/artwork.png" || pathname === "/og.png") {
      headers.set("cache-control", "public, max-age=604800, immutable");
    } else {
      headers.set("cache-control", "public, max-age=300");
    }
    const decoded = decodeBase64(asset.body);
    if (pathname === "/index.html") {
      const html = new TextDecoder().decode(decoded).replaceAll("__SITE_ORIGIN__", url.origin);
      return new Response(html, { status: 200, headers });
    }
    return new Response(decoded, { status: 200, headers });
  }
};
`;

await writeFile(join(serverDir, "index.js"), worker, "utf8");
console.log(`Built ${assets.length} assets into ${relative(root, join(serverDir, "index.js"))}`);
