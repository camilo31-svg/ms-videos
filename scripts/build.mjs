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
const SOURCES = {
  sadhu: {
    base: "https://mediaseva1.dsmynas.net/-%20Sadhu%20Ram%20Ji/",
    fetchBase: "http://mediaseva1.dsmynas.net/-%20Sadhu%20Ram%20Ji/",
    prefix: "- Sadhu Ram Ji"
  },
  ajaib: {
    base: "https://mediaseva1.dsmynas.net/-%20Ajaib%20Singh%20Ji/",
    fetchBase: "http://mediaseva1.dsmynas.net/-%20Ajaib%20Singh%20Ji/",
    prefix: "- Ajaib Singh Ji"
  },
  castellano: {
    base: "https://mediaseva1.dsmynas.net/_%20Sant%20Mat%20Castellano/",
    fetchBase: "http://mediaseva1.dsmynas.net/_%20Sant%20Mat%20Castellano/",
    prefix: "_ Sant Mat Castellano"
  }
};
const FILE_TYPES = new Map([
  [".mp4", "video"], [".m4v", "video"], [".mov", "video"], [".webm", "video"],
  [".avi", "video"], [".mpg", "video"], [".mpeg", "video"], [".mkv", "video"], [".wmv", "video"]
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

function extractFolders(html, sourceKey) {
  const folders = [];
  const entries = html.matchAll(/<div\b[^>]*id\s*=\s*["'](I\d+SXE\d+)SXP["'][^>]*>([\s\S]*?)<\/div>/gi);
  for (const entry of entries) {
    const remoteId = entry[1];
    const label = entry[2].match(/<a\b[^>]*class\s*=\s*["']SXLP\d+["'][^>]*>([\s\S]*?)<\/a>/i);
    const name = stripHtml(label?.[1] || "") || "Carpeta " + remoteId;
    folders.push({
      id: sourceKey + ":" + remoteId,
      remoteId,
      source: sourceKey,
      type: "folder",
      name,
      children: [],
      loaded: false
    });
  }
  return folders;
}

function qualityDescriptor(name, extension = "") {
  const normalized = String(name || "").toLowerCase();
  const format = extension.replace(".", "").toUpperCase();
  if (/ultra\s*hd|\b4k\b/.test(normalized)) return { label: "4K", rank: 60 };
  if (/hi\s*def|alta\s*def|\bhd\b/.test(normalized)) return { label: "HD", rank: 50 };
  if (/cellphones?|ipods?|low\s*res|baja\s*res/.test(normalized)) return { label: "Baja", rank: 10 };
  if (/download[-\s]*only|avis?\s+para\s+bajar/.test(normalized)) return { label: "DVD AVI", rank: 20 };
  if (/tablets?|dvd\s*resolution|dvd\s*res/.test(normalized)) return { label: "DVD", rank: 35 };
  if (/^\s*mp4\s*$/.test(normalized)) return { label: "MP4", rank: 40 };
  if (/^\s*avi\s*$/.test(normalized)) return { label: "AVI", rank: 25 };
  return { label: format || "Video", rank: format === "MP4" ? 40 : 30 };
}

function isQualityFolder(name) {
  return /cellphones?|ipods?|low\s*res|baja\s*res|tablets?|dvd\s*(?:resolution|res)|download[-\s]*only|avis?\s+para\s+bajar|hi\s*def|alta\s*def|ultra\s*hd|\b4k\b|^\s*(?:mp4|avi|m4v|webm)\s*$/i.test(name);
}

function isAudioFolder(name) {
  return /\b(?:audio|mp3)\b/i.test(name);
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractSize(value) {
  const match = value.match(/\d+(?:[.,]\d+)?\s*(?:KB|MB|GB)/i)?.[0]?.replace(",", ".") || "";
  if (!match) return "";
  const amount = Number.parseFloat(match);
  if (/MB$/i.test(match) && amount > 100000) return "";
  if (/GB$/i.test(match) && amount > 1000) return "";
  return match;
}

function extractFiles(html, parents, source, qualityName = "") {
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
    const mediaUrl = new URL(href.replaceAll("\\", "/"), source.base).href;
    if (seen.has(mediaUrl)) continue;
    seen.add(mediaUrl);
    const fallbackName = safeDecode(cleanHref.split("/").at(-1) || "Video");
    const anchorText = stripHtml(match[2]) || fallbackName;
    const tail = html.slice(match.index + match[0].length, match.index + match[0].length + 320);
    const size = extractSize(anchorText + " " + tail);
    const name = anchorText.replace(/\s+\d+(?:[.,]\d+)?\s*(?:KB|MB|GB)\s*$/i, "").trim() || fallbackName;
    const quality = qualityDescriptor(qualityName, extension);
    files.push({
      id: stableId(mediaUrl),
      name,
      url: mediaUrl,
      size,
      quality: quality.label,
      qualityRank: quality.rank,
      format: extension.slice(1).toUpperCase(),
      playable: !/[.](?:avi|wmv|mpg|mpeg|mkv)$/i.test(cleanHref),
      path: [...parents, name].join(" / ")
    });
  }
  return files;
}

function baseVideoName(name) {
  return name.replace(/\.(?:mp4|m4v|mov|webm|avi|mpg|mpeg|mkv|wmv)$/i, "").trim();
}

function videoIdentity(name) {
  const base = baseVideoName(name);
  const code = base.match(/(?:^|[-_\s])(\d{3,4}[a-z]{0,3})(?=(?:[-_\s]*(?:cbr|subt[-_\s]*esp))?\s*$)/i)?.[1];
  const durationMatch = base.match(/(?:^|[-_\s])(\d+\s*h(?:\s*\d+\s*m)?|\d+\s*(?:m|min))(?=[-_\s])/i)?.[1] || "";
  const duration = durationMatch.replace(/\s+/g, "").replace(/min$/i, "m").toLowerCase();
  if (code) return "recording:" + code.toLowerCase() + ":duration:" + duration;
  return "title:" + base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\W]+/g, "")
    .toLowerCase();
}

function displayVideoName(names) {
  const selected = [...names].sort((left, right) => right.length - left.length)[0] || "Video";
  return baseVideoName(selected).replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function groupVideoFiles(files, parents, sourceKey) {
  const groups = new Map();
  for (const file of files) {
    const key = videoIdentity(file.name);
    const group = groups.get(key) || { key, names: [], variants: [] };
    group.names.push(file.name);
    if (!group.variants.some((variant) => variant.url === file.url)) group.variants.push(file);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    const variants = group.variants.sort((left, right) => {
      if (left.playable !== right.playable) return left.playable ? -1 : 1;
      if (left.qualityRank !== right.qualityRank) return right.qualityRank - left.qualityRank;
      return left.quality.localeCompare(right.quality, "es");
    });
    const preferred = variants[0];
    const name = displayVideoName(group.names);
    return {
      id: stableId(sourceKey + ":" + parents.join("/") + ":" + group.key),
      source: sourceKey,
      type: "video",
      name,
      url: preferred.url,
      size: preferred.size,
      quality: preferred.quality,
      variants: variants.map(({ url, size, quality, format, playable }) => ({ url, size, quality, format, playable })),
      path: [...parents, name].join(" / ")
    };
  });
}

async function fetchFolder(source, id) {
  const sourceUrl = new URL(source.prefix + id + "SXC.htm", source.fetchBase);
  const response = await fetch(sourceUrl, { headers: { accept: "text/html" } });
  if (!response.ok) throw new Error("Catalog unavailable");
  return response.text();
}

async function serveCatalogFolder(url) {
  const sourceKey = url.searchParams.get("source") || "";
  const source = SOURCES[sourceKey];
  const id = url.searchParams.get("id") || "";
  if (!source || !/^I\d+SXE\d+$/.test(id)) {
    return Response.json({ error: "Invalid folder" }, { status: 400 });
  }
  let parents = [];
  try {
    const parsed = JSON.parse(url.searchParams.get("parents") || "[]");
    if (Array.isArray(parsed)) parents = parsed.slice(0, 20).map((part) => String(part).slice(0, 160));
  } catch {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  let html;
  try {
    html = await fetchFolder(source, id);
  } catch {
    return Response.json({ error: "Catalog unavailable" }, { status: 502 });
  }

  const folderName = url.searchParams.get("name") || "";
  const folders = extractFolders(html, sourceKey).filter((folder) => !isAudioFolder(folder.name));
  const qualityFolders = folders.filter((folder) => isQualityFolder(folder.name));
  const regularFolders = folders.filter((folder) => !isQualityFolder(folder.name));
  const files = extractFiles(html, parents, source, isQualityFolder(folderName) ? folderName : "");

  const expanded = await Promise.all(qualityFolders.map(async (folder) => {
    try {
      const qualityHtml = await fetchFolder(source, folder.remoteId);
      return { folder, files: extractFiles(qualityHtml, parents, source, folder.name) };
    } catch {
      return { folder, files: null };
    }
  }));
  for (const result of expanded) {
    if (result.files) files.push(...result.files);
    else regularFolders.push(result.folder);
  }

  const groupedVideos = groupVideoFiles(files, parents, sourceKey);
  const children = [...regularFolders, ...groupedVideos].sort((left, right) => {
    if (left.type === "folder" && right.type !== "folder") return -1;
    if (left.type !== "folder" && right.type === "folder") return 1;
    return left.name.localeCompare(right.name, "es", { numeric: true });
  });
  return Response.json({ id: sourceKey + ":" + id, children }, {
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
