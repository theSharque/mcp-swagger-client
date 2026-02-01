/**
 * OpenAPI/Swagger parser with $ref resolution
 * Supports both OpenAPI 2.0 (Swagger) and OpenAPI 3.0+
 */

import type { OpenAPISpec, OpenAPI2Spec, OpenAPI3Spec, Schema } from "./types.js";

/**
 * Detect OpenAPI/Swagger version
 */
export function detectVersion(spec: OpenAPISpec): "2.0" | "3.0+" {
  if ("swagger" in spec && spec.swagger === "2.0") {
    return "2.0";
  }
  if ("openapi" in spec) {
    return "3.0+";
  }
  throw new Error("Unknown or unsupported OpenAPI/Swagger version");
}

/**
 * Resolve a $ref reference within the spec
 * Supports JSON Pointer format: #/definitions/Pet or #/components/schemas/Pet
 */
export function resolveRef(spec: OpenAPISpec, ref: string): any {
  // Only support internal references for now
  if (!ref.startsWith("#/")) {
    throw new Error(`External references not supported: ${ref}`);
  }

  // Remove leading #/ and split by /
  const path = ref.substring(2).split("/");

  let current: any = spec;
  for (const segment of path) {
    // Handle escaped characters in JSON Pointer
    const decodedSegment = segment.replace(/~1/g, "/").replace(/~0/g, "~");

    if (current === null || current === undefined) {
      throw new Error(`Cannot resolve reference: ${ref} (path does not exist)`);
    }

    if (typeof current !== "object") {
      throw new Error(`Cannot resolve reference: ${ref} (invalid path)`);
    }

    current = current[decodedSegment];
  }

  if (current === undefined) {
    throw new Error(`Cannot resolve reference: ${ref} (not found)`);
  }

  return current;
}

/**
 * Recursively resolve all $ref in a schema
 */
export function resolveSchema(spec: OpenAPISpec, schema: Schema, visited = new Set<string>()): Schema {
  if (!schema || typeof schema !== "object") {
    return schema;
  }

  // If schema has $ref, resolve it
  if (schema.$ref) {
    // Prevent infinite loops
    if (visited.has(schema.$ref)) {
      // Return a placeholder to break the cycle
      return {
        description: `Circular reference: ${schema.$ref}`,
        type: "object",
      };
    }

    visited.add(schema.$ref);

    try {
      const resolved = resolveRef(spec, schema.$ref);
      // Merge the resolved schema with current (excluding $ref)
      const { $ref, ...rest } = schema;
      const merged = { ...resolved, ...rest };

      // Recursively resolve the merged schema
      return resolveSchema(spec, merged, visited);
    } catch (error) {
      console.error(`Failed to resolve reference ${schema.$ref}: ${error}`);
      return schema;
    }
  }

  // Create a new schema object to avoid modifying the original
  const result: Schema = { ...schema };

  // Resolve nested schemas
  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => [
        key,
        resolveSchema(spec, value, new Set(visited)),
      ])
    );
  }

  if (result.items) {
    if (Array.isArray(result.items)) {
      result.items = result.items.map((item) => resolveSchema(spec, item, new Set(visited)));
    } else {
      result.items = resolveSchema(spec, result.items, new Set(visited));
    }
  }

  if (result.additionalProperties && typeof result.additionalProperties === "object") {
    result.additionalProperties = resolveSchema(spec, result.additionalProperties, new Set(visited));
  }

  if (result.allOf) {
    result.allOf = result.allOf.map((item) => resolveSchema(spec, item, new Set(visited)));
  }

  if (result.oneOf) {
    result.oneOf = result.oneOf.map((item) => resolveSchema(spec, item, new Set(visited)));
  }

  if (result.anyOf) {
    result.anyOf = result.anyOf.map((item) => resolveSchema(spec, item, new Set(visited)));
  }

  if (result.not) {
    result.not = resolveSchema(spec, result.not, new Set(visited));
  }

  return result;
}

/**
 * Get model/schema by name from the spec
 * Handles both OpenAPI 2.0 (definitions) and 3.0+ (components/schemas)
 */
export function getModelByName(spec: OpenAPISpec, modelName: string): Schema | null {
  // Remove common prefixes if present
  const cleanName = modelName
    .replace(/^#\/definitions\//, "")
    .replace(/^#\/components\/schemas\//, "")
    .replace(/^definitions\//, "")
    .replace(/^components\/schemas\//, "");

  const version = detectVersion(spec);

  if (version === "2.0") {
    const swagger2 = spec as OpenAPI2Spec;
    return swagger2.definitions?.[cleanName] || null;
  } else {
    const openapi3 = spec as OpenAPI3Spec;
    return openapi3.components?.schemas?.[cleanName] || null;
  }
}

/**
 * Get all model names from the spec
 */
export function getAllModelNames(spec: OpenAPISpec): string[] {
  const version = detectVersion(spec);

  if (version === "2.0") {
    const swagger2 = spec as OpenAPI2Spec;
    return Object.keys(swagger2.definitions || {});
  } else {
    const openapi3 = spec as OpenAPI3Spec;
    return Object.keys(openapi3.components?.schemas || {});
  }
}

/**
 * Normalize spec to make it easier to work with
 * This doesn't convert between versions, just makes common operations easier
 */
export function normalizeSpec(spec: OpenAPISpec): {
  version: string;
  title: string;
  description?: string;
  baseUrl?: string;
  paths: OpenAPISpec["paths"];
  models: Record<string, Schema>;
} {
  const version = detectVersion(spec);

  if (version === "2.0") {
    const swagger2 = spec as OpenAPI2Spec;
    const baseUrl = swagger2.host
      ? `${swagger2.schemes?.[0] || "http"}://${swagger2.host}${swagger2.basePath || ""}`
      : undefined;

    return {
      version: swagger2.swagger,
      title: swagger2.info.title,
      description: swagger2.info.description,
      baseUrl,
      paths: swagger2.paths,
      models: swagger2.definitions || {},
    };
  } else {
    const openapi3 = spec as OpenAPI3Spec;
    const baseUrl = openapi3.servers?.[0]?.url;

    return {
      version: openapi3.openapi,
      title: openapi3.info.title,
      description: openapi3.info.description,
      baseUrl,
      paths: openapi3.paths,
      models: openapi3.components?.schemas || {},
    };
  }
}

/**
 * Get schema description (with type info)
 */
export function getSchemaDescription(schema: Schema): string {
  const parts: string[] = [];

  if (schema.description) {
    parts.push(schema.description);
  }

  if (schema.type) {
    const typeStr = Array.isArray(schema.type) ? schema.type.join(" | ") : schema.type;
    parts.push(`Type: ${typeStr}`);
  }

  if (schema.format) {
    parts.push(`Format: ${schema.format}`);
  }

  if (schema.enum) {
    parts.push(`Enum: ${schema.enum.join(", ")}`);
  }

  if (schema.pattern) {
    parts.push(`Pattern: ${schema.pattern}`);
  }

  if (schema.minLength !== undefined || schema.maxLength !== undefined) {
    const constraints = [];
    if (schema.minLength !== undefined) constraints.push(`min: ${schema.minLength}`);
    if (schema.maxLength !== undefined) constraints.push(`max: ${schema.maxLength}`);
    parts.push(`Length: ${constraints.join(", ")}`);
  }

  if (schema.minimum !== undefined || schema.maximum !== undefined) {
    const constraints = [];
    if (schema.minimum !== undefined) constraints.push(`min: ${schema.minimum}`);
    if (schema.maximum !== undefined) constraints.push(`max: ${schema.maximum}`);
    parts.push(`Range: ${constraints.join(", ")}`);
  }

  return parts.join("; ") || "No description available";
}
