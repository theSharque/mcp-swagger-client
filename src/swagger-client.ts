/**
 * Swagger/OpenAPI client
 * Provides search and detail retrieval functionality
 */

import { getCachedSpec } from "./cache.js";
import {
  detectVersion,
  resolveSchema,
  getModelByName,
  normalizeSpec,
  getSchemaDescription,
} from "./parser.js";
import type {
  SwaggerConfig,
  OpenAPISpec,
  SearchApiResult,
  SearchApiResponse,
  ApiDetailsResponse,
  ModelDetailsResponse,
  ApiEndpoint,
  ListAllApiResponse,
  CheckApiRequest,
  CheckApiResponse,
  Operation,
  Parameter,
  RequestBody,
  Response,
  Schema,
} from "./types.js";

/**
 * Main Swagger client class
 */
export class SwaggerClient {
  private config: SwaggerConfig;
  private spec: OpenAPISpec | null = null;

  constructor(config: SwaggerConfig) {
    this.config = config;
  }

  /**
   * Get the OpenAPI spec (with caching)
   */
  async getSpec(): Promise<OpenAPISpec> {
    if (!this.spec) {
      this.spec = await getCachedSpec(this.config);
    }
    return this.spec;
  }

  /**
   * Force refresh the spec (bypass cache)
   */
  async refreshSpec(): Promise<OpenAPISpec> {
    this.spec = await getCachedSpec(this.config);
    return this.spec;
  }

  /**
   * Search for API endpoints by query
   * Searches in: path, method, summary, description, operationId, tags, parameters
   */
  async searchApi(query: string): Promise<SearchApiResponse> {
    const spec = await this.getSpec();
    const normalized = normalizeSpec(spec);
    const results: SearchApiResult[] = [];

    const lowerQuery = query.toLowerCase();

    // Search through all paths and operations
    for (const [path, pathItem] of Object.entries(normalized.paths)) {
      if (!pathItem) continue;

      const methods = ["get", "post", "put", "delete", "patch", "options", "head", "trace"] as const;

      for (const method of methods) {
        const operation = pathItem[method] as Operation | undefined;
        if (!operation) continue;

        // Check if query matches this endpoint
        const matches = [
          path.toLowerCase().includes(lowerQuery),
          method.toLowerCase().includes(lowerQuery),
          operation.summary?.toLowerCase().includes(lowerQuery),
          operation.description?.toLowerCase().includes(lowerQuery),
          operation.operationId?.toLowerCase().includes(lowerQuery),
          operation.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)),
          operation.parameters?.some(
            (param) =>
              param.name?.toLowerCase().includes(lowerQuery) ||
              param.description?.toLowerCase().includes(lowerQuery)
          ),
        ].some(Boolean);

        if (matches) {
          results.push({
            path,
            method: method.toUpperCase(),
            description: operation.summary || operation.description || `${method.toUpperCase()} ${path}`,
          });
        }
      }
    }

    return {
      results,
      total: results.length,
    };
  }

  /**
   * Get detailed information about a specific API endpoint
   */
  async getApiDetails(path: string, method: string): Promise<ApiDetailsResponse | null> {
    const spec = await this.getSpec();
    const normalized = normalizeSpec(spec);

    const pathItem = normalized.paths[path];
    if (!pathItem) {
      return null;
    }

    const methodLower = method.toLowerCase() as
      | "get"
      | "post"
      | "put"
      | "delete"
      | "patch"
      | "options"
      | "head"
      | "trace";
    const operation = pathItem[methodLower] as Operation | undefined;

    if (!operation) {
      return null;
    }

    // Collect parameters from both path-level and operation-level
    const parameters: Parameter[] = [];

    // Path-level parameters
    if (pathItem.parameters) {
      parameters.push(...pathItem.parameters);
    }

    // Operation-level parameters
    if (operation.parameters) {
      parameters.push(...operation.parameters);
    }

    // Resolve parameter schemas if they have $ref
    const resolvedParameters = parameters.map((param) => {
      if (param.schema && param.schema.$ref) {
        return {
          ...param,
          schema: resolveSchema(spec, param.schema),
        };
      }
      return param;
    });

    // Resolve request body schemas
    let requestBody: RequestBody | null = null;
    if (operation.requestBody) {
      requestBody = { ...operation.requestBody };
      if (requestBody.content) {
        requestBody.content = Object.fromEntries(
          Object.entries(requestBody.content).map(([mediaType, mediaTypeObj]) => {
            if (mediaTypeObj.schema) {
              return [
                mediaType,
                {
                  ...mediaTypeObj,
                  schema: resolveSchema(spec, mediaTypeObj.schema),
                },
              ];
            }
            return [mediaType, mediaTypeObj];
          })
        );
      }
    }

    // Resolve response schemas
    const responses: Record<string, Response> = {};
    for (const [statusCode, response] of Object.entries(operation.responses)) {
      const resolvedResponse: Response = { ...response };

      // OpenAPI 3.0+ style (content)
      if (resolvedResponse.content) {
        resolvedResponse.content = Object.fromEntries(
          Object.entries(resolvedResponse.content).map(([mediaType, mediaTypeObj]) => {
            if (mediaTypeObj.schema) {
              return [
                mediaType,
                {
                  ...mediaTypeObj,
                  schema: resolveSchema(spec, mediaTypeObj.schema),
                },
              ];
            }
            return [mediaType, mediaTypeObj];
          })
        );
      }

      // OpenAPI 2.0 style (schema)
      if (resolvedResponse.schema) {
        resolvedResponse.schema = resolveSchema(spec, resolvedResponse.schema);
      }

      responses[statusCode] = resolvedResponse;
    }

    return {
      path,
      method: method.toUpperCase(),
      operationId: operation.operationId,
      summary: operation.summary,
      description: operation.description,
      tags: operation.tags,
      parameters: resolvedParameters,
      requestBody,
      responses,
      security: operation.security,
    };
  }

  /**
   * Get detailed information about a model/schema
   */
  async getModelDetails(modelName: string): Promise<ModelDetailsResponse | null> {
    const spec = await this.getSpec();

    const schema = getModelByName(spec, modelName);
    if (!schema) {
      return null;
    }

    // Resolve the schema to expand all $ref
    const resolvedSchema = resolveSchema(spec, schema);

    // Clean model name
    const cleanName = modelName
      .replace(/^#\/definitions\//, "")
      .replace(/^#\/components\/schemas\//, "")
      .replace(/^definitions\//, "")
      .replace(/^components\/schemas\//, "");

    // If it's an object type, return properties
    if (resolvedSchema.type === "object" || resolvedSchema.properties) {
      return {
        name: cleanName,
        type: resolvedSchema.type || "object",
        description: resolvedSchema.description,
        required: resolvedSchema.required,
        properties: resolvedSchema.properties,
      };
    }

    // For non-object types (arrays, primitives, etc.), return the full schema
    return {
      name: cleanName,
      type: resolvedSchema.type,
      description: resolvedSchema.description || getSchemaDescription(resolvedSchema),
      schema: resolvedSchema,
    };
  }

  /**
   * List all available models
   */
  async listModels(): Promise<string[]> {
    const spec = await this.getSpec();
    const version = detectVersion(spec);

    if (version === "2.0") {
      return Object.keys((spec as any).definitions || {});
    } else {
      return Object.keys((spec as any).components?.schemas || {});
    }
  }

  /**
   * Get API info
   */
  async getApiInfo(): Promise<{
    title: string;
    version: string;
    description?: string;
    baseUrl?: string;
  }> {
    const spec = await this.getSpec();
    const normalized = normalizeSpec(spec);

    return {
      title: normalized.title,
      version: normalized.version,
      description: normalized.description,
      baseUrl: normalized.baseUrl,
    };
  }

  /**
   * List all API endpoints
   */
  async listAllApi(): Promise<ListAllApiResponse> {
    const spec = await this.getSpec();
    const normalized = normalizeSpec(spec);
    const endpoints: ApiEndpoint[] = [];
    const groupedByTag: Record<string, ApiEndpoint[]> = {};

    // Iterate through all paths and operations
    for (const [path, pathItem] of Object.entries(normalized.paths)) {
      if (!pathItem) continue;

      const methods = ["get", "post", "put", "delete", "patch", "options", "head", "trace"] as const;

      for (const method of methods) {
        const operation = pathItem[method] as Operation | undefined;
        if (!operation) continue;

        const endpoint: ApiEndpoint = {
          path,
          method: method.toUpperCase(),
          operationId: operation.operationId,
          summary: operation.summary,
          tags: operation.tags,
        };

        endpoints.push(endpoint);

        // Group by tags
        if (operation.tags && operation.tags.length > 0) {
          for (const tag of operation.tags) {
            if (!groupedByTag[tag]) {
              groupedByTag[tag] = [];
            }
            groupedByTag[tag].push(endpoint);
          }
        } else {
          // Endpoints without tags go to "Untagged" group
          if (!groupedByTag["Untagged"]) {
            groupedByTag["Untagged"] = [];
          }
          groupedByTag["Untagged"].push(endpoint);
        }
      }
    }

    return {
      endpoints,
      total: endpoints.length,
      groupedByTag,
    };
  }

  /**
   * Execute an API request
   */
  async checkApi(request: CheckApiRequest): Promise<CheckApiResponse> {
    const spec = await this.getSpec();
    const normalized = normalizeSpec(spec);

    // Get base URL from spec
    let baseUrl = normalized.baseUrl || "";

    // If baseUrl is not set, try to extract from config URL
    if (!baseUrl) {
      try {
        const specUrl = new URL(this.config.url);
        baseUrl = `${specUrl.protocol}//${specUrl.host}`;
      } catch (error) {
        throw new Error("Could not determine base URL for API requests");
      }
    }

    // Build full URL
    let fullUrl = baseUrl + request.path;

    // Add query parameters
    if (request.queryParams && Object.keys(request.queryParams).length > 0) {
      const params = new URLSearchParams(request.queryParams);
      fullUrl += `?${params.toString()}`;
    }

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...request.headers,
    };

    // Add authentication if configured
    if (this.config.token) {
      headers["Authorization"] = `Bearer ${this.config.token}`;
    } else if (this.config.user && this.config.password) {
      const auth = Buffer.from(`${this.config.user}:${this.config.password}`).toString("base64");
      headers["Authorization"] = `Basic ${auth}`;
    } else if (this.config.cookies) {
      headers["Cookie"] = this.config.cookies;
    }

    // Execute request
    const startTime = Date.now();

    try {
      const fetchOptions: RequestInit = {
        method: request.method.toUpperCase(),
        headers,
      };

      // Add body for methods that support it
      if (request.body && !["GET", "HEAD"].includes(request.method.toUpperCase())) {
        fetchOptions.body = typeof request.body === "string"
          ? request.body
          : JSON.stringify(request.body);
      }

      const response = await fetch(fullUrl, fetchOptions);
      const executionTime = Date.now() - startTime;

      // Parse response
      const contentType = response.headers.get("content-type") || "";
      let data: any;

      if (contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch {
          data = await response.text();
        }
      } else {
        data = await response.text();
      }

      // Collect response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data,
        requestUrl: fullUrl,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      throw new Error(`Request failed after ${executionTime}ms: ${error}`);
    }
  }
}

/**
 * Create a SwaggerClient from environment variables
 */
export function createClientFromEnv(): SwaggerClient {
  const url = process.env.MCP_SWAGGER_URL;
  if (!url) {
    throw new Error("MCP_SWAGGER_URL environment variable is required");
  }

  const config: SwaggerConfig = {
    url,
    user: process.env.MCP_SWAGGER_USER,
    password: process.env.MCP_SWAGGER_PASSWORD,
    token: process.env.MCP_SWAGGER_TOKEN,
    cookies: process.env.MCP_SWAGGER_COOKIES,
  };

  return new SwaggerClient(config);
}
