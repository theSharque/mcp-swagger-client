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
