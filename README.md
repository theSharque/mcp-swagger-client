# MCP Swagger

[![npm version](https://img.shields.io/npm/v/mcp-swagger-client.svg)](https://www.npmjs.com/package/mcp-swagger-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Model Context Protocol (MCP) server for accessing and searching Swagger/OpenAPI documentation

**Smart MCP server** that connects to Swagger/OpenAPI specifications with intelligent caching and powerful search capabilities.

📦 **Install**: `npm install -g mcp-swagger-client` or use via npx
🌐 **npm**: https://www.npmjs.com/package/mcp-swagger-client
🔗 **GitHub**: https://github.com/theSharque/mcp-swagger-client

## Overview

Access and explore your API documentation through Swagger/OpenAPI specs with AI-powered search, detailed endpoint information, and automatic schema resolution.

## Features

- 🔍 **Smart Search**: Search API endpoints by path, method, description, tags, and parameters
- 📋 **Detailed Information**: Get complete endpoint details including parameters, request/response schemas, and error codes
- 📦 **Model Inspector**: Explore data models with full property details and constraints
- 🚀 **Intelligent Caching**: Local caching with HEAD request validation (ETag/Last-Modified)
- 🔐 **Multiple Auth Methods**: Support for Bearer tokens, Basic Auth, and cookies
- 📚 **OpenAPI Support**: Works with both Swagger 2.0 and OpenAPI 3.0+
- 🔗 **Reference Resolution**: Automatically resolves `$ref` links to schemas

## Quick Start

### For Users (using npm package)

```bash
# No installation needed - use directly in Cursor/Claude Desktop
# Just configure it as described in Integration section below
```

### For Developers

1. Clone the repository:
```bash
git clone https://github.com/theSharque/mcp-swagger-client.git
cd mcp-swagger-client
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

Configure the server using environment variables:

### Required

- `MCP_SWAGGER_URL` - URL to your Swagger/OpenAPI specification (e.g., `https://api.example.com/swagger.json`)

### Optional Authentication

Choose one of the following methods:

- `MCP_SWAGGER_TOKEN` - Bearer token for authentication
- `MCP_SWAGGER_USER` + `MCP_SWAGGER_PASSWORD` - Basic authentication
- `MCP_SWAGGER_COOKIES` - Cookie string for session-based auth

**Priority**: Token → Basic Auth → Cookies

## Integration

### Cursor IDE

1. Open Cursor Settings → Features → Model Context Protocol
2. Click "Edit Config" button
3. Add one of the configurations below

#### Option 1: Via npx (Recommended)

Installs from npm registry automatically:

```json
{
  "mcpServers": {
    "swagger": {
      "command": "npx",
      "args": ["-y", "mcp-swagger-client"],
      "env": {
        "MCP_SWAGGER_URL": "https://petstore.swagger.io/v2/swagger.json"
      }
    }
  }
}
```

With authentication:

```json
{
  "mcpServers": {
    "swagger": {
      "command": "npx",
      "args": ["-y", "mcp-swagger-client"],
      "env": {
        "MCP_SWAGGER_URL": "https://api.example.com/swagger.json",
        "MCP_SWAGGER_TOKEN": "your_bearer_token_here"
      }
    }
  }
}
```

#### Option 2: Via npm link (Development)

For local development with live changes:

```json
{
  "mcpServers": {
    "swagger": {
      "command": "mcp-swagger-client",
      "env": {
        "MCP_SWAGGER_URL": "https://api.example.com/swagger.json"
      }
    }
  }
}
```

Requires: `cd /path/to/mcp-swagger-client && npm link -g`

#### Option 3: Direct path

```json
{
  "mcpServers": {
    "swagger": {
      "command": "node",
      "args": ["/path/to/mcp-swagger-client/dist/index.js"],
      "env": {
        "MCP_SWAGGER_URL": "https://api.example.com/swagger.json"
      }
    }
  }
}
```

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "swagger": {
      "command": "npx",
      "args": ["-y", "mcp-swagger-client"],
      "env": {
        "MCP_SWAGGER_URL": "https://petstore.swagger.io/v2/swagger.json"
      }
    }
  }
}
```

With authentication:

```json
{
  "mcpServers": {
    "swagger": {
      "command": "npx",
      "args": ["-y", "mcp-swagger-client"],
      "env": {
        "MCP_SWAGGER_URL": "https://api.example.com/swagger.json",
        "MCP_SWAGGER_TOKEN": "your_bearer_token_here"
      }
    }
  }
}
```

### Continue.dev

Edit `.continue/config.json`:

```json
{
  "mcpServers": {
    "swagger": {
      "command": "npx",
      "args": ["-y", "mcp-swagger-client"],
      "env": {
        "MCP_SWAGGER_URL": "https://petstore.swagger.io/v2/swagger.json"
      }
    }
  }
}
```

### Authentication Examples

#### Bearer Token

```json
{
  "env": {
    "MCP_SWAGGER_URL": "https://api.example.com/swagger.json",
    "MCP_SWAGGER_TOKEN": "your_bearer_token_here"
  }
}
```

#### Basic Auth

```json
{
  "env": {
    "MCP_SWAGGER_URL": "https://api.example.com/swagger.json",
    "MCP_SWAGGER_USER": "username",
    "MCP_SWAGGER_PASSWORD": "password"
  }
}
```

#### Cookies

```json
{
  "env": {
    "MCP_SWAGGER_URL": "https://api.example.com/swagger.json",
    "MCP_SWAGGER_COOKIES": "session=abc123; token=xyz789"
  }
}
```

## Tools

### 1. `search-api`

Search for API endpoints by keyword. Returns minimal information for quick browsing.

**Input:**
- `query` (string) - Search query

**Output:**
- `results` - Array of matching endpoints
  - `path` - Endpoint path
  - `method` - HTTP method
  - `description` - Brief description
- `total` - Number of results

**Example:**
```typescript
// Search for user-related endpoints
{
  "query": "user"
}

// Returns:
{
  "results": [
    {
      "path": "/api/users",
      "method": "GET",
      "description": "Get all users"
    },
    {
      "path": "/api/users/{id}",
      "method": "GET",
      "description": "Get user by ID"
    }
  ],
  "total": 2
}
```

### 2. `get-api-details`

Get complete details about a specific API endpoint.

**Input:**
- `path` (string) - API endpoint path (e.g., `/api/users/{id}`)
- `method` (string) - HTTP method (GET, POST, PUT, DELETE, etc.)

**Output:**
Complete endpoint information including:
- Summary and description
- All parameters (path, query, header, cookie)
- Request body schema
- All response schemas with status codes
- Security requirements
- Examples (if available)

**Example:**
```typescript
// Get details for user endpoint
{
  "path": "/api/users/{id}",
  "method": "GET"
}

// Returns:
{
  "path": "/api/users/{id}",
  "method": "GET",
  "operationId": "getUserById",
  "summary": "Get user by ID",
  "description": "Retrieves detailed information about a specific user",
  "tags": ["Users"],
  "parameters": [
    {
      "name": "id",
      "in": "path",
      "required": true,
      "schema": { "type": "integer" },
      "description": "User ID"
    }
  ],
  "responses": {
    "200": {
      "description": "Successful response",
      "content": {
        "application/json": {
          "schema": { "$ref": "#/components/schemas/User" }
        }
      }
    },
    "404": {
      "description": "User not found"
    }
  }
}
```

### 3. `get-model-details`

Get complete information about a data model/schema.

**Input:**
- `modelName` (string) - Model name (e.g., `User`, `Pet`, or `#/components/schemas/User`)

**Output:**
Full model schema including:
- Type and description
- All properties with types and constraints
- Required fields
- Nested models (resolved `$ref`)
- Examples and validation rules

**Example:**
```typescript
// Get User model details
{
  "modelName": "User"
}

// Returns:
{
  "name": "User",
  "type": "object",
  "description": "User account information",
  "required": ["id", "email", "username"],
  "properties": {
    "id": {
      "type": "integer",
      "format": "int64",
      "description": "Unique user identifier"
    },
    "email": {
      "type": "string",
      "format": "email",
      "description": "User email address"
    },
    "username": {
      "type": "string",
      "minLength": 3,
      "maxLength": 50,
      "description": "User's unique username"
    }
  }
}
```

## How Caching Works

The server implements intelligent caching to minimize API requests:

1. **First Request**: Downloads and caches the OpenAPI spec in `~/.mcp-swagger-client/cache/`
2. **Subsequent Requests**:
   - Makes a quick HEAD request to check if the spec has changed
   - Compares `ETag` and `Last-Modified` headers
   - Uses cached version if unchanged
   - Downloads fresh copy if modified

**Benefits:**
- Fast response times for repeated queries
- Minimal load on your API
- Always up-to-date when spec changes
- Works offline if cache exists

**Cache Location**: `~/.mcp-swagger-client/cache/`

## Usage

### Development Mode

Run with hot reload:
```bash
npm run dev
```

### Production Mode

Start the server:
```bash
npm start
```

### MCP Inspector

Debug and test your server with the MCP Inspector:
```bash
npm run inspector
```

This opens the MCP Inspector UI where you can test all tools interactively.

## Development

### Project Structure

```
mcp-swagger-client/
├── src/
│   ├── index.ts          # MCP server with tool registration
│   ├── swagger-client.ts # Main client for API operations
│   ├── cache.ts          # Caching mechanism with HEAD validation
│   ├── parser.ts         # OpenAPI parser with $ref resolution
│   └── types.ts          # TypeScript type definitions
├── dist/                 # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

## Use Cases

### 1. API Exploration
```
"Find all endpoints related to authentication"
→ search-api: { query: "auth" }
```

### 2. Integration Development
```
"Show me the details of the create user endpoint"
→ get-api-details: { path: "/api/users", method: "POST" }
```

### 3. Understanding Data Models
```
"What fields does the User model have?"
→ get-model-details: { modelName: "User" }
```

### 4. Error Handling
```
"What error responses does the login endpoint return?"
→ get-api-details: { path: "/api/auth/login", method: "POST" }
```

## Troubleshooting

### Error: "MCP_SWAGGER_URL environment variable is required"

Make sure you've set the `MCP_SWAGGER_URL` environment variable with your Swagger/OpenAPI URL.

### Authentication Errors

- Verify your credentials are correct
- Check if the authentication method matches your API (token, basic auth, or cookies)
- Ensure the token/credentials have the necessary permissions

### Cache Issues

If you're seeing stale data, you can manually clear the cache:

```bash
rm -rf ~/.mcp-swagger-client/cache/
```

### OpenAPI Version Issues

The server supports both Swagger 2.0 and OpenAPI 3.0+. If you encounter parsing issues, verify your spec is valid using:
- [Swagger Editor](https://editor.swagger.io/)
- [OpenAPI Validator](https://validator.swagger.io/)

## License

MIT

## Author

theSharque
