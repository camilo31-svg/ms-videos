import { readFile, writeFile } from "node:fs/promises";

const catalogUrl = new URL("../public/catalog.json", import.meta.url);
const maximumConcurrency = 4;
let activeRequests = 0;
let completedFolders = 0;
const waitingRequests = [];

await import("./build.mjs");
const worker = (await import(`../dist/server/index.js?crawl=${Date.now()}`)).default;
const seed = JSON.parse(await readFile(catalogUrl, "utf8"));

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withRequestSlot(task) {
  if (activeRequests >= maximumConcurrency) {
    await new Promise((resolve) => waitingRequests.push(resolve));
  }
  activeRequests += 1;
  try {
    return await task();
  } finally {
    activeRequests -= 1;
    waitingRequests.shift()?.();
  }
}

async function fetchFolder(folder, parents) {
  const endpoint = new URL("https://catalog.local/api/folder");
  endpoint.searchParams.set("source", folder.source || "castellano");
  endpoint.searchParams.set("id", folder.remoteId || folder.id);
  endpoint.searchParams.set("name", folder.name);
  endpoint.searchParams.set("parents", JSON.stringify([...parents, folder.name]));

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await withRequestSlot(() => worker.fetch(new Request(endpoint)));
    if (response.ok) return response.json();
    if (attempt < 3) await delay(attempt * 1000);
  }

  throw new Error(`Could not read ${[...parents, folder.name].join(" / ")}`);
}

async function crawlFolder(folder, parents) {
  const payload = await fetchFolder(folder, parents);
  if (!Array.isArray(payload.children)) throw new Error(`Invalid catalog response for ${folder.name}`);

  completedFolders += 1;
  if (completedFolders % 25 === 0) console.log(`Read ${completedFolders} folders...`);

  const childParents = [...parents, folder.name];
  const children = await Promise.all(payload.children.map((child) =>
    child.type === "folder" ? crawlFolder(child, childParents) : child
  ));

  return { ...folder, children, loaded: true };
}

const items = await Promise.all(seed.items.map(async (library) => {
  const folders = (library.children || [])
    .filter((child) => child.type === "folder")
    .map((child) => ({ ...child, children: [], loaded: false }));
  return {
    ...library,
    children: await Promise.all(folders.map((folder) => crawlFolder(folder, [library.name]))),
    loaded: true
  };
}));

const catalog = {
  title: seed.title || "MS Videos",
  updatedAt: new Date().toISOString(),
  items
};

await writeFile(catalogUrl, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Saved ${completedFolders} folders to public/catalog.json`);
