/**
 * Tiny on-disk cache. GitHub's unauthenticated limit is 60 requests/hour, so a
 * scan that re-fetches the same READMEs is unusable without caching.
 *
 * Cache lives in ~/.stargap/cache/<sha256>.json. Entries are best-effort:
 * any filesystem or parse error is treated as a cache miss.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export function cacheDir(env = process.env) {
  if (env.STARGAP_CACHE_DIR) return env.STARGAP_CACHE_DIR;
  return join(homedir(), ".stargap", "cache");
}

function keyFor(key) {
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

export function createCache({ dir = cacheDir(), ttlMs = DEFAULT_TTL_MS, enabled = true, now = () => Date.now() } = {}) {
  const memory = new Map();

  return {
    enabled,
    /** @returns {Promise<any | null>} */
    async get(key) {
      if (!enabled) return null;
      if (memory.has(key)) {
        const entry = memory.get(key);
        if (now() - entry.storedAt < ttlMs) return entry.value;
        memory.delete(key);
      }
      try {
        const raw = await readFile(join(dir, `${keyFor(key)}.json`), "utf8");
        const entry = JSON.parse(raw);
        if (typeof entry?.storedAt !== "number" || now() - entry.storedAt >= ttlMs) return null;
        memory.set(key, entry);
        return entry.value;
      } catch {
        return null;
      }
    },
    async set(key, value) {
      if (!enabled) return;
      const entry = { storedAt: now(), value };
      memory.set(key, entry);
      try {
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, `${keyFor(key)}.json`), JSON.stringify(entry), "utf8");
      } catch {
        // Cache writes are best-effort.
      }
    },
  };
}
