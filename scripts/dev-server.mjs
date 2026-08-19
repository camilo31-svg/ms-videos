import { createServer } from "node:http";

await import("./build.mjs");
const workerUrl = new URL(`../dist/server/index.js?dev=${Date.now()}`, import.meta.url);
const { default: worker } = await import(workerUrl);

const port = Number.parseInt(process.env.PORT || "4173", 10);
const host = "127.0.0.1";

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || `${host}:${port}`}`);
    const workerResponse = await worker.fetch(new Request(requestUrl, {
      method: request.method,
      headers: request.headers
    }));
    response.writeHead(workerResponse.status, Object.fromEntries(workerResponse.headers));
    response.end(Buffer.from(await workerResponse.arrayBuffer()));
  } catch (error) {
    console.error(error);
    response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Remote catalog unavailable" }));
  }
});

server.listen(port, host, () => console.log(`Local: http://${host}:${port}`));
