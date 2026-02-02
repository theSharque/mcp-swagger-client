/**
 * Local caching mechanism for OpenAPI specifications
 * Uses HEAD requests to check if cached version is still valid
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createHash } from "crypto";
import axios, { AxiosRequestConfig } from "axios";
import type { CacheEntry, OpenAPISpec, SwaggerConfig } from "./types.js";

const CACHE_DIR = join(homedir(), ".mcp-swagger-client", "cache");

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  if (!existsSync(CACHE_DIR)) {
    await mkdir(CACHE_DIR, { recursive: true });
  }
}

/**
 * Generate cache file path from URL
 * Uses SHA-256 hash to create filesystem-safe filename
 */
function getCacheFilePath(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex");
  return join(CACHE_DIR, `${hash}.json`);
}

/**
 * Perform login if loginUrl is configured
 * Returns cookies from the login response
 */
async function performLogin(config: SwaggerConfig): Promise<string | undefined> {
  if (!config.loginUrl) {
    return undefined;
  }

  try {
    const method = (config.loginMethod || "POST").toUpperCase();
    const axiosConfig: AxiosRequestConfig = {
      method: method as any,
      url: config.loginUrl,
      headers: {} as Record<string, string>,
    };

    // Add login body if provided
    if (config.loginBody && (method === "POST" || method === "PUT" || method === "PATCH")) {
      try {
        axiosConfig.data = JSON.parse(config.loginBody);
        axiosConfig.headers!["Content-Type"] = "application/json";
      } catch (error) {
        console.error(`Failed to parse login body as JSON: ${error}`);
        return undefined;
      }
    }

    console.error(`Performing login to ${config.loginUrl}...`);
    const response = await axios(axiosConfig);

    // Extract cookies from Set-Cookie headers
    const setCookieHeaders = response.headers["set-cookie"];
    if (setCookieHeaders && setCookieHeaders.length > 0) {
      // Combine all cookies into a single string
      const cookies = setCookieHeaders
        .map((cookie) => cookie.split(";")[0]) // Take only the cookie value, ignore attributes
        .join("; ");
      console.error(`Login successful, obtained cookies`);
      return cookies;
    }

    console.error(`Login successful but no cookies received`);
    return undefined;
  } catch (error) {
    console.error(`Login failed: ${error}`);
    return undefined;
  }
}

/**
 * Build axios config with authentication
 */
async function buildAxiosConfig(config: SwaggerConfig): Promise<AxiosRequestConfig> {
  const axiosConfig: AxiosRequestConfig = {
    headers: {} as Record<string, string>,
  };

  // Priority: Token → Basic Auth → Login Cookies → Cookies
  if (config.token) {
    axiosConfig.headers!["Authorization"] = `Bearer ${config.token}`;
  } else if (config.user && config.password) {
    const credentials = Buffer.from(`${config.user}:${config.password}`).toString("base64");
    axiosConfig.headers!["Authorization"] = `Basic ${credentials}`;
  }

  // If loginUrl is configured, perform login first
  let cookies = config.cookies;
  if (config.loginUrl) {
    const loginCookies = await performLogin(config);
    if (loginCookies) {
      // Merge login cookies with existing cookies
      cookies = cookies ? `${cookies}; ${loginCookies}` : loginCookies;
    }
  }

  if (cookies) {
    axiosConfig.headers!["Cookie"] = cookies;
  }

  return axiosConfig;
}

/**
 * Read cache entry from disk
 */
async function readCacheEntry(filePath: string): Promise<CacheEntry | null> {
  try {
    if (!existsSync(filePath)) {
      return null;
    }

    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as CacheEntry;
  } catch (error) {
    console.error(`Failed to read cache file: ${error}`);
    return null;
  }
}

/**
 * Write cache entry to disk
 */
async function writeCacheEntry(filePath: string, entry: CacheEntry): Promise<void> {
  await ensureCacheDir();
  await writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8");
}

/**
 * Check if remote spec has been modified using HEAD request
 * Returns true if modified or if cannot determine
 */
async function checkIfModified(
  config: SwaggerConfig,
  cachedEntry: CacheEntry
): Promise<boolean> {
  try {
    const axiosConfig = await buildAxiosConfig(config);

    // Make HEAD request to check headers
    const response = await axios.head(config.url, {
      ...axiosConfig,
      validateStatus: (status) => status < 500, // Accept 4xx responses
    });

    // If HEAD not supported, assume modified
    if (response.status === 405) {
      console.error("HEAD method not supported, will fetch full spec");
      return true;
    }

    if (response.status >= 400) {
      console.error(`HEAD request failed with status ${response.status}`);
      return true;
    }

    const etag = response.headers["etag"];
    const lastModified = response.headers["last-modified"];

    // If we have ETag, use it for comparison
    if (etag && cachedEntry.etag) {
      return etag !== cachedEntry.etag;
    }

    // Fall back to Last-Modified
    if (lastModified && cachedEntry.lastModified) {
      return lastModified !== cachedEntry.lastModified;
    }

    // If no cache validation headers available, assume modified
    return true;
  } catch (error) {
    console.error(`Failed to check if spec modified: ${error}`);
    // On error, assume modified to fetch fresh copy
    return true;
  }
}

/**
 * Fetch OpenAPI spec from URL
 */
async function fetchSpec(config: SwaggerConfig): Promise<{
  spec: OpenAPISpec;
  etag?: string;
  lastModified?: string;
}> {
  try {
    const axiosConfig = await buildAxiosConfig(config);
    const response = await axios.get(config.url, axiosConfig);

    if (response.status !== 200) {
      throw new Error(`Failed to fetch spec: HTTP ${response.status}`);
    }

    const spec = response.data as OpenAPISpec;
    const etag = response.headers["etag"];
    const lastModified = response.headers["last-modified"];

    return { spec, etag, lastModified };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        throw new Error(
          `Failed to fetch Swagger spec: HTTP ${error.response.status} - ${error.response.statusText}`
        );
      } else if (error.request) {
        throw new Error(
          `Failed to fetch Swagger spec: No response from server (${error.message})`
        );
      }
    }
    throw new Error(`Failed to fetch Swagger spec: ${error}`);
  }
}

/**
 * Get OpenAPI spec from cache or fetch if needed
 * This is the main entry point for getting specs
 */
export async function getCachedSpec(config: SwaggerConfig): Promise<OpenAPISpec> {
  const cacheFilePath = getCacheFilePath(config.url);
  const cachedEntry = await readCacheEntry(cacheFilePath);

  // If no cache, fetch fresh
  if (!cachedEntry) {
    console.error(`No cache found for ${config.url}, fetching fresh spec`);
    const { spec, etag, lastModified } = await fetchSpec(config);

    const newEntry: CacheEntry = {
      url: config.url,
      etag,
      lastModified,
      cachedAt: new Date().toISOString(),
      spec,
    };

    await writeCacheEntry(cacheFilePath, newEntry);
    return spec;
  }

  // Check if cache is still valid
  const isModified = await checkIfModified(config, cachedEntry);

  if (!isModified) {
    console.error(`Using cached spec for ${config.url}`);
    return cachedEntry.spec;
  }

  // Cache is stale, fetch fresh
  console.error(`Cache stale for ${config.url}, fetching fresh spec`);
  try {
    const { spec, etag, lastModified } = await fetchSpec(config);

    const newEntry: CacheEntry = {
      url: config.url,
      etag,
      lastModified,
      cachedAt: new Date().toISOString(),
      spec,
    };

    await writeCacheEntry(cacheFilePath, newEntry);
    return spec;
  } catch (error) {
    // If fetch fails, fall back to cached version
    console.error(`Failed to fetch fresh spec, using cached version: ${error}`);
    return cachedEntry.spec;
  }
}

/**
 * Clear cache for a specific URL
 */
export async function clearCache(url: string): Promise<void> {
  const cacheFilePath = getCacheFilePath(url);
  if (existsSync(cacheFilePath)) {
    const { unlink } = await import("fs/promises");
    await unlink(cacheFilePath);
  }
}

/**
 * Clear all cache entries
 */
export async function clearAllCache(): Promise<void> {
  if (existsSync(CACHE_DIR)) {
    const { readdir, unlink } = await import("fs/promises");
    const files = await readdir(CACHE_DIR);
    await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map((file) => unlink(join(CACHE_DIR, file)))
    );
  }
}
