/**
 * README fetching.
 *
 * Raw GitHub content (raw.githubusercontent.com) is not part of the REST rate
 * limit, so it is the primary path. The API's /readme endpoint is the fallback
 * because it resolves non-standard filenames and default branches for us.
 */

import { githubJson, isNotFound, isRateLimited } from "./github.mjs";

const RAW = "https://raw.githubusercontent.com";
const RAW_FILENAMES = ["README.md", "readme.md", "Readme.md", "README.rst", "README.txt", "README"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url, { fetchImpl = globalThis.fetch, timeoutMs = 20000, retries = 1 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) await sleep(500 * 2 ** attempt);
    try {
      const response = await fetchImpl(url, {
        headers: { "User-Agent": "stargap", Accept: "text/plain, */*" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return await response.text();
      if (response.status === 404) return null;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** Fetch a README as text. Returns null when the repo has no README. */
export async function fetchReadme(fullName, options = {}) {
  const { cache, fetchImpl = globalThis.fetch } = options;
  const cacheKey = `readme ${fullName}`;
  const cached = await cache?.get(cacheKey);
  if (cached !== undefined && cached !== null) return cached;

  let text = null;
  for (const filename of RAW_FILENAMES) {
    try {
      text = await fetchText(`${RAW}/${fullName}/HEAD/${filename}`, { ...options, fetchImpl });
    } catch {
      text = null;
    }
    if (text) break;
  }

  if (text === null) {
    // Fallback for repos whose README has an unusual filename. This consumes
    // the 60/hour core quota, so a rate limit here must not kill the scan —
    // the repo is simply treated as having no README.
    try {
      const { data } = await githubJson(`/repos/${fullName}/readme`, options);
      if (data && typeof data.content === "string") {
        text = Buffer.from(data.content, data.encoding === "base64" ? "base64" : "utf8").toString("utf8");
      }
    } catch (error) {
      if (!isNotFound(error) && !isRateLimited(error)) throw error;
      text = null;
    }
  }

  await cache?.set(cacheKey, text);
  return text;
}

