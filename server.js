const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URLSearchParams } = require("url");

const PORT = Number(process.env.PORT || 4174);
const PUBLIC_DIR = path.join(__dirname, "public");
const LEXUS_HOST = "www.lexuscpo.com.tw";
const TESLA_DATA_HOST = "electrify.tw";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function send(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function httpsRequest({ hostname, requestPath, method = "GET", headers = {}, body = "" }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path: requestPath,
        method,
        headers
      },
      (response) => {
        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`${hostname} returned ${response.statusCode}: ${data.slice(0, 140)}`));
            return;
          }
          resolve(data);
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(20000, () => {
      req.destroy(new Error(`${hostname} request timed out`));
    });
    if (body) req.write(body);
    req.end();
  });
}

function fetchLexusInventory(query) {
  const form = new URLSearchParams({
    Limit: "100",
    Sort: "UpdateTime",
    Order: "desc",
    Offset: "0",
    Page: "1",
    IsEnable: "true",
    PriceStart: query.get("priceStart") || "0",
    PriceEnd: query.get("priceEnd") || "1000",
    YearStart: query.get("yearStart") || "0",
    YearEnd: query.get("yearEnd") || "20",
    MileageStart: query.get("mileageStart") || "0",
    MileageEnd: query.get("mileageEnd") || "30"
  });

  const series = query.get("series");
  if (series) form.set("Series", series);

  const body = form.toString();
  return httpsRequest({
    hostname: LEXUS_HOST,
    requestPath: "/Home/GetCar",
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Content-Length": Buffer.byteLength(body),
      "User-Agent": "Mozilla/5.0 Lexus CPO CP Inventory",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Origin": "https://www.lexuscpo.com.tw",
      "Referer": "https://www.lexuscpo.com.tw/Home/Search"
    }
  });
}

async function fetchTeslaInventory() {
  const payload = await httpsRequest({
    hostname: TESLA_DATA_HOST,
    requestPath: "/app/inventory/data.json",
    headers: {
      "User-Agent": "Mozilla/5.0 Lexus Tesla CP Inventory",
      "Accept": "application/json, text/plain, */*",
      "Referer": "https://electrify.tw/app/inventory/"
    }
  });
  const rows = JSON.parse(payload);
  return {
    total: rows.length,
    rows,
    source: "https://electrify.tw/app/inventory/data.json",
    errors: []
  };
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, content, mimeTypes[ext] || "application/octet-stream");
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/inventory" || url.pathname === "/api/lexus-inventory") {
    try {
      const payload = await fetchLexusInventory(url.searchParams);
      send(res, 200, payload, "application/json; charset=utf-8");
    } catch (error) {
      send(res, 502, JSON.stringify({ error: error.message }), "application/json; charset=utf-8");
    }
    return;
  }

  if (url.pathname === "/api/tesla-inventory") {
    try {
      const payload = await fetchTeslaInventory();
      send(res, 200, JSON.stringify(payload), "application/json; charset=utf-8");
    } catch (error) {
      send(res, 502, JSON.stringify({ total: 0, rows: [], errors: [error.message] }), "application/json; charset=utf-8");
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Lexus and Tesla CP inventory running at http://localhost:${PORT}`);
});
