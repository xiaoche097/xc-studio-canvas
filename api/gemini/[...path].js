const ALLOWED_TARGET_HOSTS = new Set([
  "yunwu.ai",
  "api.apiplus.org",
  "api3.wlai.vip",
  "api.zhongzhuan.chat",
  "api.bltcy.ai",
  "api.rcouyi.com",
  "us.rcouyi.com",
  "us-1.rcouyi.com",
  "us-2.rcouyi.com",
  "us-3.rcouyi.com",
  "hk-2.rcouyi.com",
  "sgp.rcouyi.com",
  "jp.rcouyi.com",
]);

export const config = {
  maxDuration: 300,
};

const readRequestBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const normalizeTarget = (target) => {
  const targetValue = Array.isArray(target) ? target[0] : target;
  if (!targetValue) {
    throw new Error("Missing X-Gemini-Proxy-Target header.");
  }

  const url = new URL(targetValue);
  if (url.protocol !== "https:" || !ALLOWED_TARGET_HOSTS.has(url.hostname)) {
    throw new Error(`Proxy target is not allowed: ${url.hostname}`);
  }

  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
};

export default async function handler(req, res) {
  res.setHeader("x-xcai-gemini-proxy", "vercel-function");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const targetBaseUrl = normalizeTarget(req.headers["x-gemini-proxy-target"]);
    const path = Array.isArray(req.query.path) ? req.query.path.join("/") : req.query.path || "";
    const search = new URLSearchParams(req.query);
    search.delete("path");

    const upstreamUrl = `${targetBaseUrl}/${path}${search.size ? `?${search}` : ""}`;
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey === "host" ||
        lowerKey === "content-length" ||
        lowerKey === "x-gemini-proxy-target" ||
        lowerKey.startsWith("x-forwarded-")
      ) {
        continue;
      }

      if (Array.isArray(value)) {
        headers.set(key, value.join(","));
      } else if (value) {
        headers.set(key, value);
      }
    }

    const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readRequestBody(req);
    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body,
    });

    res.status(upstreamResponse.status);
    upstreamResponse.headers.forEach((value, key) => {
      if (!["content-encoding", "content-length", "transfer-encoding"].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const responseBody = Buffer.from(await upstreamResponse.arrayBuffer());
    res.send(responseBody);
  } catch (error) {
    res.status(502).json({
      error: {
        message: error?.message || "Gemini proxy request failed.",
      },
    });
  }
}
