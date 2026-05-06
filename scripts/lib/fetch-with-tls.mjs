import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { Buffer } from "node:buffer";
import { URL } from "node:url";

function normalizeHeaders(headers = {}) {
  if (headers && typeof headers.entries === "function") {
    return Object.fromEntries(headers.entries());
  }
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)]));
}

function responseHeaders(rawHeaders) {
  const normalized = Object.fromEntries(Object.entries(rawHeaders).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value.join(", ") : String(value ?? "")]));
  return {
    get(name) {
      return normalized[String(name).toLowerCase()] ?? null;
    },
    entries() {
      return Object.entries(normalized);
    },
  };
}

export async function fetchWithTls(url, options = {}, fetchOptions = {}) {
  const target = new URL(url);
  const insecureTls = Boolean(fetchOptions.insecureTls);

  if (!insecureTls || target.protocol !== "https:") {
    return fetch(url, options);
  }

  return new Promise((resolve, reject) => {
    const headers = normalizeHeaders(options.headers);
    const body = options.body === undefined || options.body === null ? null : String(options.body);
    if (body && !Object.keys(headers).some((key) => key.toLowerCase() === "content-length")) {
      headers["content-length"] = String(Buffer.byteLength(body));
    }
    const request = httpsRequest(
      target,
      {
        method: options.method ?? "GET",
        headers,
        rejectUnauthorized: false,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const status = response.statusCode ?? 0;
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            status,
            ok: status >= 200 && status < 300,
            headers: responseHeaders(response.headers),
            async text() {
              return text;
            },
          });
        });
      },
    );

    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

export async function getWithTls(url, fetchOptions = {}) {
  const target = new URL(url);
  if (target.protocol === "http:") {
    return fetch(url);
  }
  if (target.protocol !== "https:" || !fetchOptions.insecureTls) {
    return fetch(url);
  }

  return new Promise((resolve, reject) => {
    const request = (target.protocol === "https:" ? httpsRequest : httpRequest)(
      target,
      { method: "GET", rejectUnauthorized: false },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const status = response.statusCode ?? 0;
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            status,
            ok: status >= 200 && status < 300,
            headers: responseHeaders(response.headers),
            async text() {
              return text;
            },
          });
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}
