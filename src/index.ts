import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClientFromEnv } from "./swagger-client.js";

/**
 * MCP Swagger Server
 * A Model Context Protocol server for Swagger/OpenAPI documentation access
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
    description: "Search for API endpoints by keyword. Searches in path, method, summary, description, operationId, tags, and parameters.",
    inputSchema: {
      query: z.string().describe("Search query (e.g., 'user', '/api/users', 'POST')"),
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
    description: "Get detailed information about a specific API endpoint including parameters, request body, responses, and security requirements.",
    inputSchema: {
      path: z.string().describe("API endpoint path (e.g., '/api/users/{id}')"),
      method: z.string().describe("HTTP method (GET, POST, PUT, DELETE, etc.)"),
    },
    outputSchema: {
      endpoint: z.any(),
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
    description: "Get detailed information about a data model/schema including all properties, types, constraints, and nested models.",
    inputSchema: {
      modelName: z.string().describe("Model/schema name (e.g., 'User', 'Pet', '#/components/schemas/User')"),
    },
    outputSchema: {
      model: z.any(),
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
