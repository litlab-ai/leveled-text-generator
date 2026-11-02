import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { generatePassage } from "./generate.js";
import { isLevel } from "./levels.js";
import { getProvider } from "./providers/index.js";
import { loadWordBank } from "./words.js";

try {
  process.loadEnvFile();
} catch {
  // No .env file: fall back to defaults (mock provider).
}

const PORT = Number(process.env.PORT ?? 3000);
const INDEX_HTML = new URL("../public/index.html", import.meta.url);

const provider = getProvider();
const bank = loadWordBank();

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(await readFile(INDEX_HTML));
      return;
    }

    if (req.method === "GET" && req.url === "/api/words") {
      return sendJson(res, 200, bank);
    }

    if (req.method === "POST" && req.url === "/api/generate") {
      const body = await readJson(req);
      if (!isLevel(body?.level)) {
        return sendJson(res, 400, { error: 'level must be "easy", "medium" or "hard"' });
      }
      const words = Array.isArray(body.words)
        ? body.words.filter((w: unknown): w is string => typeof w === "string")
        : undefined;

      const result = await generatePassage({ level: body.level, words }, { provider, bank });
      return sendJson(res, 200, result);
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: err instanceof Error ? err.message : "Internal error" });
  }
});

server.listen(PORT, () => {
  console.log(`Leveled text generator running at http://localhost:${PORT} (provider: ${provider.name})`);
});

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}
