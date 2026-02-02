import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClientFromEnv } from "./swagger-client.js";
import { clearCache, clearAllCache } from "./cache.js";

/**
 * MCP Swagger Server
 *
 * A Model Context Protocol server that provides AI assistants with intelligent access
 * to Swagger/OpenAPI API documentation.
 *
 * This server enables:
 * - Semantic search across API endpoints
 * - Detailed endpoint documentation retrieval
 * - Schema/model exploration with full type information
 * - Complete API inventory and navigation
 *
 * The server automatically caches OpenAPI specs with intelligent cache invalidation
 * using ETag and Last-Modified headers for optimal performance.
 *
 * Configuration via environment variables:
 * - MCP_SWAGGER_URL (required): URL to OpenAPI/Swagger JSON specification
 * - MCP_SWAGGER_TOKEN (optional): Bearer token for authentication
 * - MCP_SWAGGER_USER + MCP_SWAGGER_PASSWORD (optional): Basic authentication
 * - MCP_SWAGGER_COOKIES (optional): Cookie string for session-based auth
 */
const server = new McpServer({
  name: "mcp-swagger",
  version: "1.0.0",
});

// Create swagger client from environment variables
let client: ReturnType<typeof createClientFromEnv>;

try {
  client = createClientFromEnv();
} catch (error) {
  console.error(`Failed to initialize Swagger client: ${error}`);
  process.exit(1);
}

/**
 * Tool: Search for API endpoints
 */
server.registerTool(
  "search-api",
  {
    title: "Search API Endpoints",
    description: `Search for API endpoints by keyword across the entire OpenAPI specification.

This tool performs a comprehensive search across multiple fields:
- Endpoint paths (e.g., '/api/users', '/auth/login')
- HTTP methods (GET, POST, PUT, DELETE, etc.)
- Summaries and descriptions
- Operation IDs
- Tags
- Parameter names and descriptions

Use this tool when you need to:
- Find endpoints related to a specific feature (e.g., "authentication", "user management")
- Locate endpoints by HTTP method (e.g., "POST")
- Search for endpoints containing specific path segments

Returns: A list of matching endpoints with their paths, methods, and brief descriptions.`,
    inputSchema: {
      query: z.string().describe("Search query - can be a keyword, path segment, HTTP method, or any text to search for (e.g., 'user', '/api/users', 'POST', 'authentication')"),
    },
    outputSchema: {
      results: z.array(
        z.object({
          path: z.string(),
          method: z.string(),
          description: z.string().optional(),
        })
      ),
      total: z.number(),
      error: z.string().optional(),
    },
  },
  async ({ query }) => {
    try {
      const result = await client.searchApi(query);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching API: ${error}`,
          },
        ],
        structuredContent: {
          results: [],
          total: 0,
          error: String(error),
        },
      };
    }
  }
);

/**
 * Tool: Get API endpoint details
 */
server.registerTool(
  "get-api-details",
  {
    title: "Get API Endpoint Details",
    description: `Get complete, detailed information about a specific API endpoint.

This tool provides comprehensive endpoint documentation including:
- Full summary and description
- All parameters (path, query, header, cookie) with types and constraints
- Request body schema with all properties and validation rules
- Response schemas for all status codes (200, 400, 404, 500, etc.)
- Security/authentication requirements
- Operation ID and tags
- Examples (if available in the spec)

Use this tool when you need to:
- Understand how to call a specific endpoint
- See what parameters are required/optional
- Know what data format to send in request body
- Understand possible response formats and error codes
- Implement API integration code

Returns: Complete endpoint specification with all schemas resolved (no $ref links).`,
    inputSchema: {
      path: z.string().describe("Exact API endpoint path as it appears in the spec (e.g., '/api/users/{id}', '/api/auth/login'). Use search-api tool first if you don't know the exact path."),
      method: z.string().describe("HTTP method in uppercase (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD, or TRACE)"),
    },
    outputSchema: {
      endpoint: z.any(),
      error: z.string().optional(),
    },
  },
  async ({ path, method }) => {
    try {
      const details = await client.getApiDetails(path, method);

      if (!details) {
        return {
          content: [
            {
              type: "text",
              text: `Endpoint not found: ${method.toUpperCase()} ${path}`,
            },
          ],
          structuredContent: {
            endpoint: null,
            error: "Endpoint not found",
          },
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(details, null, 2),
          },
        ],
        structuredContent: {
          endpoint: details,
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting API details: ${error}`,
          },
        ],
        structuredContent: {
          endpoint: null,
          error: String(error),
        },
      };
    }
  }
);

/**
 * Tool: Get model/schema details
 */
server.registerTool(
  "get-model-details",
  {
    title: "Get Model Details",
    description: `Get detailed information about a data model/schema definition.

This tool provides complete schema documentation including:
- All properties with their types (string, number, boolean, object, array, etc.)
- Field constraints (minLength, maxLength, minimum, maximum, pattern, enum, etc.)
- Required vs optional fields
- Property descriptions
- Nested object structures (fully resolved)
- Array item types
- Format specifications (email, date-time, uri, etc.)

Use this tool when you need to:
- Understand the structure of request/response bodies
- Know what fields are required in an object
- See validation rules for each field
- Understand nested data structures
- Generate DTOs or data classes for API integration

Returns: Complete schema definition with all nested references resolved.

Note: Model names can be found in endpoint details (request/response schemas) or by examining the OpenAPI spec structure.`,
    inputSchema: {
      modelName: z.string().describe("Model/schema name. Can be simple name (e.g., 'User', 'Task', 'Role') or full reference path (e.g., '#/components/schemas/User'). Case-sensitive."),
    },
    outputSchema: {
      model: z.any(),
      error: z.string().optional(),
    },
  },
  async ({ modelName }) => {
    try {
      const details = await client.getModelDetails(modelName);

      if (!details) {
        return {
          content: [
            {
              type: "text",
              text: `Model not found: ${modelName}`,
            },
          ],
          structuredContent: {
            model: null,
            error: "Model not found",
          },
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(details, null, 2),
          },
        ],
        structuredContent: {
          model: details,
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting model details: ${error}`,
          },
        ],
        structuredContent: {
          model: null,
          error: String(error),
        },
      };
    }
  }
);

/**
 * Tool: List all API endpoints
 */
server.registerTool(
  "list-all-api",
  {
    title: "List All API Endpoints",
    description: `Get a complete overview of all available API endpoints in the OpenAPI specification.

This tool provides a comprehensive inventory of the entire API including:
- All endpoint paths and HTTP methods
- Operation IDs (used for code generation)
- Brief summaries/descriptions
- Tags/categories for logical grouping
- Total endpoint count

The results are organized by tags (e.g., "user-controller", "Authentication", "task-controller")
for easy navigation and understanding of API structure.

Use this tool when you need to:
- Get an overview of the entire API surface
- Discover what endpoints are available
- Understand API organization and structure
- Find endpoints by category/tag
- Generate API documentation or client code
- Explore a new or unfamiliar API

Returns: Complete list of all endpoints grouped by tags, with total count.

Note: This tool takes no parameters and always returns all endpoints. For targeted search, use 'search-api' instead.`,
    inputSchema: {},
    outputSchema: {
      endpoints: z.array(
        z.object({
          path: z.string(),
          method: z.string(),
          operationId: z.string().optional(),
          summary: z.string().optional(),
          tags: z.array(z.string()).optional(),
        })
      ),
      total: z.number(),
      groupedByTag: z.record(
        z.array(
          z.object({
            path: z.string(),
            method: z.string(),
            operationId: z.string().optional(),
            summary: z.string().optional(),
            tags: z.array(z.string()).optional(),
          })
        )
      ).optional(),
      error: z.string().optional(),
    },
  },
  async () => {
    try {
      const result = await client.listAllApi();

      // Format output text
      let text = `Total endpoints: ${result.total}\n\n`;

      // Group by tags for better readability
      for (const [tag, endpoints] of Object.entries(result.groupedByTag || {})) {
        text += `\n## ${tag}\n`;
        for (const endpoint of endpoints) {
          text += `- ${endpoint.method} ${endpoint.path}`;
          if (endpoint.summary) {
            text += ` - ${endpoint.summary}`;
          }
          text += '\n';
        }
      }

      return {
        content: [
          {
            type: "text",
            text,
          },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error listing API endpoints: ${error}`,
          },
        ],
        structuredContent: {
          endpoints: [],
          total: 0,
          error: String(error),
        },
      };
    }
  }
);

/**
 * Tool: Execute API request
 */
server.registerTool(
  "check-api",
  {
    title: "Execute API Request",
    description: `Execute a real HTTP request to any API endpoint from the OpenAPI specification.

This tool acts as a built-in HTTP client that allows you to:
- Test API endpoints without leaving the MCP environment
- Make real requests with any HTTP method (GET, POST, PUT, DELETE, etc.)
- Send request bodies (JSON or other formats)
- Add custom headers and query parameters
- Get complete response information including status, headers, and data

The tool automatically handles:
- Base URL resolution from the OpenAPI spec
- Authentication (Bearer token, Basic auth, or Cookies from config)
- Content-Type headers
- Response parsing (JSON or text)
- Execution time measurement

Use this tool when you need to:
- Test an endpoint with real data
- Verify API responses
- Debug API behavior
- Execute CRUD operations
- Validate authentication/authorization
- Test error handling

Returns: Complete response with status code, headers, data, and execution time.

Note: This tool makes REAL requests to the API. Be careful with POST/PUT/DELETE operations!`,
    inputSchema: {
      path: z.string().describe("API endpoint path (e.g., '/api/users', '/api/features/123'). Must match a path from the OpenAPI spec."),
      method: z.string().describe("HTTP method (GET, POST, PUT, DELETE, PATCH, etc.)"),
      body: z.any().optional().describe("Request body (will be JSON stringified if object). Only for POST, PUT, PATCH methods."),
      queryParams: z.record(z.string()).optional().describe("Query parameters as key-value pairs (e.g., {\"page\": \"1\", \"limit\": \"10\"})"),
      headers: z.record(z.string()).optional().describe("Additional HTTP headers (e.g., {\"X-Custom-Header\": \"value\"}). Auth headers are added automatically."),
    },
    outputSchema: {
      status: z.number(),
      statusText: z.string(),
      headers: z.record(z.string()),
      data: z.any(),
      requestUrl: z.string(),
      executionTime: z.number(),
      error: z.string().optional(),
    },
  },
  async ({ path, method, body, queryParams, headers }) => {
    try {
      const result = await client.checkApi({
        path,
        method,
        body,
        queryParams,
        headers,
      });

      // Format output text
      let text = `HTTP ${result.status} ${result.statusText}\n`;
      text += `URL: ${result.requestUrl}\n`;
      text += `Execution time: ${result.executionTime}ms\n\n`;

      text += `Response Headers:\n`;
      for (const [key, value] of Object.entries(result.headers)) {
        text += `  ${key}: ${value}\n`;
      }

      text += `\nResponse Data:\n`;
      text += typeof result.data === "string"
        ? result.data
        : JSON.stringify(result.data, null, 2);

      return {
        content: [
          {
            type: "text",
            text,
          },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error executing API request: ${error}`,
          },
        ],
        structuredContent: {
          status: 0,
          statusText: "Error",
          headers: {},
          data: null,
          requestUrl: "",
          executionTime: 0,
          error: String(error),
        },
      };
    }
  }
);

/**
 * Tool: Clear OpenAPI spec cache
 */
server.registerTool(
  "cache-clear",
  {
    title: "Clear OpenAPI Cache",
    description: `Clear cached OpenAPI/Swagger specification data.

This tool allows you to:
- Clear all cached OpenAPI specs (if no URL provided)
- Clear cache for a specific Swagger URL (if URL provided)

The cache is used to store OpenAPI specifications locally to avoid repeated downloads.
Clearing the cache forces the server to fetch fresh specifications on the next request.

Use this tool when you need to:
- Force refresh of API documentation after API changes
- Clear stale cached data
- Troubleshoot cache-related issues
- Free up disk space

Returns: Confirmation message with details about what was cleared.`,
    inputSchema: {
      url: z.string().optional().describe("Optional: Specific Swagger/OpenAPI URL to clear cache for. If not provided, clears all cached specs."),
    },
    outputSchema: {
      success: z.boolean(),
      message: z.string(),
      clearedUrl: z.string().optional(),
      clearedAll: z.boolean().optional(),
    },
  },
  async ({ url }) => {
    try {
      if (url) {
        // Clear cache for specific URL
        await clearCache(url);
        return {
          content: [
            {
              type: "text",
              text: `Cache cleared for URL: ${url}`,
            },
          ],
          structuredContent: {
            success: true,
            message: `Cache cleared for URL: ${url}`,
            clearedUrl: url,
            clearedAll: false,
          },
        };
      } else {
        // Clear all cache
        await clearAllCache();
        return {
          content: [
            {
              type: "text",
              text: "All OpenAPI cache entries cleared successfully.",
            },
          ],
          structuredContent: {
            success: true,
            message: "All OpenAPI cache entries cleared successfully.",
            clearedAll: true,
          },
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error clearing cache: ${error}`,
          },
        ],
        structuredContent: {
          success: false,
          message: `Error clearing cache: ${error}`,
        },
      };
    }
  }
);

/**
 * Main function to start the MCP server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Write to stderr so it doesn't interfere with MCP communication on stdout
  console.error("MCP Swagger server started on stdin/stdout");

  // Log configuration
  console.error(`Swagger URL: ${process.env.MCP_SWAGGER_URL}`);

  try {
    const info = await client.getApiInfo();
    console.error(`API: ${info.title} (${info.version})`);
    if (info.baseUrl) {
      console.error(`Base URL: ${info.baseUrl}`);
    }
  } catch (error) {
    console.error(`Warning: Could not fetch API info: ${error}`);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
