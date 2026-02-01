/**
 * Type definitions for MCP Swagger Server
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface SwaggerConfig {
  url: string;
  user?: string;
  password?: string;
  token?: string;
  cookies?: string;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry {
  url: string;
  etag?: string;
  lastModified?: string;
  cachedAt: string;
  spec: OpenAPISpec;
}

// ============================================================================
// OpenAPI/Swagger Specification Types
// ============================================================================

export type OpenAPISpec = OpenAPI2Spec | OpenAPI3Spec;

export interface OpenAPI2Spec {
  swagger: "2.0";
  info: Info;
  host?: string;
  basePath?: string;
  schemes?: string[];
  consumes?: string[];
  produces?: string[];
  paths: Paths;
  definitions?: Record<string, Schema>;
  parameters?: Record<string, Parameter>;
  responses?: Record<string, Response>;
  securityDefinitions?: Record<string, SecurityScheme>;
  security?: SecurityRequirement[];
  tags?: Tag[];
  externalDocs?: ExternalDocs;
}

export interface OpenAPI3Spec {
  openapi: string; // "3.0.0", "3.0.1", "3.1.0", etc.
  info: Info;
  servers?: Server[];
  paths: Paths;
  components?: Components;
  security?: SecurityRequirement[];
  tags?: Tag[];
  externalDocs?: ExternalDocs;
}

export interface Info {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: Contact;
  license?: License;
}

export interface Contact {
  name?: string;
  url?: string;
  email?: string;
}

export interface License {
  name: string;
  url?: string;
}

export interface Server {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariable>;
}

export interface ServerVariable {
  enum?: string[];
  default: string;
  description?: string;
}

export interface Tag {
  name: string;
  description?: string;
  externalDocs?: ExternalDocs;
}

export interface ExternalDocs {
  description?: string;
  url: string;
}

export interface Components {
  schemas?: Record<string, Schema>;
  responses?: Record<string, Response>;
  parameters?: Record<string, Parameter>;
  examples?: Record<string, Example>;
  requestBodies?: Record<string, RequestBody>;
  headers?: Record<string, Header>;
  securitySchemes?: Record<string, SecurityScheme>;
  links?: Record<string, Link>;
  callbacks?: Record<string, Callback>;
}

export interface Paths {
  [path: string]: PathItem;
}

export interface PathItem {
  $ref?: string;
  summary?: string;
  description?: string;
  get?: Operation;
  put?: Operation;
  post?: Operation;
  delete?: Operation;
  options?: Operation;
  head?: Operation;
  patch?: Operation;
  trace?: Operation;
  servers?: Server[];
  parameters?: Parameter[];
}

export interface Operation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  callbacks?: Record<string, Callback>;
  deprecated?: boolean;
  security?: SecurityRequirement[];
  servers?: Server[];
  externalDocs?: ExternalDocs;
}

export interface Parameter {
  name: string;
  in: "query" | "header" | "path" | "cookie" | "body" | "formData";
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: Schema;
  example?: any;
  examples?: Record<string, Example>;
  content?: Record<string, MediaType>;
  // Swagger 2.0 specific
  type?: string;
  format?: string;
  items?: Schema;
  collectionFormat?: string;
  default?: any;
  maximum?: number;
  exclusiveMaximum?: boolean;
  minimum?: number;
  exclusiveMinimum?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  enum?: any[];
  multipleOf?: number;
}

export interface RequestBody {
  description?: string;
  content: Record<string, MediaType>;
  required?: boolean;
}

export interface MediaType {
  schema?: Schema;
  example?: any;
  examples?: Record<string, Example>;
  encoding?: Record<string, Encoding>;
}

export interface Encoding {
  contentType?: string;
  headers?: Record<string, Header>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

export interface Response {
  description: string;
  headers?: Record<string, Header>;
  content?: Record<string, MediaType>;
  links?: Record<string, Link>;
  // Swagger 2.0 specific
  schema?: Schema;
  examples?: Record<string, any>;
}

export interface Header {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: Schema;
  example?: any;
  examples?: Record<string, Example>;
  content?: Record<string, MediaType>;
}

export interface Schema {
  // JSON Schema properties
  title?: string;
  description?: string;
  type?: string | string[];
  format?: string;
  default?: any;
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: boolean | number;
  minimum?: number;
  exclusiveMinimum?: boolean | number;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  enum?: any[];

  // Object properties
  properties?: Record<string, Schema>;
  additionalProperties?: boolean | Schema;

  // Array properties
  items?: Schema | Schema[];

  // Combining schemas
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  not?: Schema;

  // References
  $ref?: string;

  // OpenAPI specific
  nullable?: boolean;
  discriminator?: Discriminator;
  readOnly?: boolean;
  writeOnly?: boolean;
  xml?: XML;
  externalDocs?: ExternalDocs;
  example?: any;
  examples?: any[];
  deprecated?: boolean;
}

export interface Discriminator {
  propertyName: string;
  mapping?: Record<string, string>;
}

export interface XML {
  name?: string;
  namespace?: string;
  prefix?: string;
  attribute?: boolean;
  wrapped?: boolean;
}

export interface Example {
  summary?: string;
  description?: string;
  value?: any;
  externalValue?: string;
}

export interface Link {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, any>;
  requestBody?: any;
  description?: string;
  server?: Server;
}

export interface Callback {
  [expression: string]: PathItem;
}

export interface SecurityScheme {
  type: "apiKey" | "http" | "oauth2" | "openIdConnect" | "basic";
  description?: string;
  name?: string;
  in?: "query" | "header" | "cookie";
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlows;
  openIdConnectUrl?: string;
}

export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface SecurityRequirement {
  [name: string]: string[];
}

// ============================================================================
// MCP Tool Response Types
// ============================================================================

export interface SearchApiResult {
  path: string;
  method: string;
  description?: string;
}

export interface SearchApiResponse {
  results: SearchApiResult[];
  total: number;
}

export interface ApiDetailsResponse {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters: Parameter[];
  requestBody?: RequestBody | null;
  responses: Record<string, Response>;
  security?: SecurityRequirement[];
}

export interface ModelDetailsResponse {
  name: string;
  type?: string | string[];
  description?: string;
  required?: string[];
  properties?: Record<string, Schema>;
  // For non-object types
  schema?: Schema;
}

export interface ApiEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  tags?: string[];
}

export interface ListAllApiResponse {
  endpoints: ApiEndpoint[];
  total: number;
  groupedByTag?: Record<string, ApiEndpoint[]>;
}

export interface CheckApiRequest {
  path: string;
  method: string;
  body?: any;
  queryParams?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface CheckApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  requestUrl: string;
  executionTime: number;
}
