/**
 * Minimal GitHub REST client: retries, rate-limit awareness, optional caching.
 * Docs: https://docs.github.com/rest
 */

import { createCache } from "./cache.mjs";

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(message, { status = 0, body = "", url = "", rateLimited = false } = {}) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
    this.body = body;
    this.url = url;
    this.rateLimited = rateLimited;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch JSON from the GitHub API with exponential backoff and caching.
 *
 * @param {string} path API path beginning with "/", e.g. "/search/repositories".
 * @param {object} [options]
 * @param {Record<string, string | number>} [options.params] Query string params.
 * @param {string} [options.token] GitHub token (optional but strongly recommended).
 * @param {number} [options.retries] Number of retries for 403/429/5xx responses.
 * @param {number} [options.timeoutMs] Per-request timeout.
 * @param {typeof fetch} [options.fetchImpl] Injectable fetch for tests.
 * @param {import("./cache.mjs").createCache extends (...args: any) => infer R ? R : never} [options.cache]
 * @returns {Promise<{ data: any, headers: Headers }>}
 */
export async function githubJson(path, options = {}) {
  const {
    params = {},
    token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "",
    retries = 3,
    timeoutMs = 20000,
    fetchImpl = globalThis.fetch,
    cache = defaultCache(),
  } = options;

  if (typeof fetchImpl !== "function") {
    throw new GitHubError("global fetch is unavailable; Node 18+ is required");
  }

  const url = new URL(API + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  // `cache: false` is used by endpoints that must always reflect live state,
  // such as /rate_limit.
  const cacheStore = cache === false ? null : cache;
  const cacheKey = `GET ${url.href}`;
  const cached = await cacheStore?.get(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "stargap",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) await sleep(Math.min(1000 * 2 ** attempt, 15000));
    let response;
    try {
      response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      lastError = new GitHubError(`network error: ${error.message}`, { url: url.href });
      continue;
    }

    if (response.ok) {
      const data = await response.json();
      const result = { data, headers: response.headers };
      await cacheStore?.set(cacheKey, result);
      return result;
    }

    const body = await response.text().catch(() => "");
    const remaining = response.headers.get("x-ratelimit-remaining");
    const reset = response.headers.get("x-ratelimit-reset");
    const isRateLimited = (response.status === 403 || response.status === 429) && remaining === "0";
    const retryable = response.status === 403 || response.status === 429 || response.status >= 500;

    if (!retryable) {
      throw new GitHubError(`GitHub API ${response.status} for ${url.pathname}`, {
        status: response.status,
        body: body.slice(0, 500),
        url: url.href,
      });
    }

    lastError = new GitHubError(
      isRateLimited
        ? `GitHub rate limit exhausted for ${url.pathname}`
        : `GitHub API ${response.status} for ${url.pathname}`,
      { status: response.status, body: body.slice(0, 500), url: url.href, rateLimited: isRateLimited },
    );

    if (isRateLimited) {
      const waitMs = reset ? Number(reset) * 1000 - Date.now() + 1000 : 0;
      // Only wait for a short window; otherwise surface the error so callers
      // can tell the user to set GITHUB_TOKEN instead of hanging for an hour.
      if (waitMs > 0 && waitMs < 65000) await sleep(waitMs);
      else break;
    }
  }

  throw lastError;
}

let sharedCache;
function defaultCache() {
  if (!sharedCache) sharedCache = createCache();
  return sharedCache;
}

/** True when the error means "no such README", as opposed to a real failure. */
export function isNotFound(error) {
  return error instanceof GitHubError && error.status === 404;
}

/** True when GitHub's rate limit is exhausted. */
export function isRateLimited(error) {
  return error instanceof GitHubError && error.rateLimited;
}

/** Human-readable hint for a failed request. */
export function rateLimitHint(error) {
  if (isRateLimited(error)) {
    return "GitHub rate limit exhausted. Set GITHUB_TOKEN (a classic token with no scopes is enough) for 5,000 req/h.";
  }
  return null;
}

/**
 * Search repositories. Returns a flat list of normalized repo objects.
 */
export async function searchRepositories(query, options = {}) {
  const { perPage = 30, maxPages = 1, ...rest } = options;
  const repos = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const { data } = await githubJson("/search/repositories", {
      ...rest,
      params: {
        q: query,
        sort: "stars",
        order: "desc",
        per_page: perPage,
        page,
      },
    });
    const items = Array.isArray(data.items) ? data.items : [];
    for (const item of items) repos.push(normalizeRepo(item));
    if (items.length < perPage) break;
  }
  return repos;
}

/**
 * Fetch a single repo's metadata.
 *
 * `/repos/:owner/:name` uses the core quota, which is only 60/hour without a
 * token. Search has a separate quota, so it is used as a fallback.
 */
export async function fetchRepo(fullName, options = {}) {
  try {
    const { data } = await githubJson(`/repos/${fullName}`, options);
    return normalizeRepo(data);
  } catch (error) {
    if (!isRateLimited(error)) throw error;
    const results = await searchRepositories(`repo:${fullName}`, { perPage: 1, ...options });
    if (!results.length) throw error;
    return results[0];
  }
}

export function normalizeRepo(item) {
  return {
    fullName: item.full_name,
    stars: item.stargazers_count ?? 0,
    description: item.description ?? "",
    url: item.html_url,
    topics: Array.isArray(item.topics) ? item.topics : [],
    pushedAt: item.pushed_at ?? null,
    archived: Boolean(item.archived),
    isFork: Boolean(item.fork),
  };
}

/** Current rate-limit budget, useful for `stargap doctor`. */
export async function rateLimit(options = {}) {
  // Never cache the live budget: `stargap doctor` exists to show what is left
  // right now, not what was left when the cache was first populated.
  const { data } = await githubJson("/rate_limit", { ...options, cache: false });
  return data;
}



