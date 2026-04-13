# Fastify — project conventions

## Architecture

- Plugin-based architecture. Every feature is a Fastify plugin registered via `fastify.register()`.
- Use `@fastify/autoload` for automatic plugin discovery from `plugins/` and `routes/` directories.
- Separate concerns: routes, schemas, services, repositories. Routes are thin — delegate to services.
- Use `fastify.decorate()` for shared services (DB, cache, auth). Access via `fastify.db`, not imports.

## Schemas & Validation

- Define JSON Schema for EVERY route (body, querystring, params, response).
- Use `@sinclair/typebox` or `json-schema-to-ts` for type-safe schemas.
- Never trust input without schema validation — Fastify validates automatically when schema is provided.
- Share schemas via `fastify.addSchema()` with `$id` for `$ref` reuse.

## Error Handling

- Use `fastify.setErrorHandler()` for centralized error handling.
- Throw `httpErrors` from `@fastify/sensible` (`reply.notFound()`, `reply.badRequest()`).
- Never swallow errors in async route handlers — Fastify catches rejections automatically.
- Always return proper HTTP status codes, not generic 500.

## Performance

- Use `fastify.log` (pino), not `console.log`. Pino is built-in and faster.
- Enable `@fastify/compress` for response compression.
- Use `@fastify/caching` and `@fastify/etag` for cache headers.
- Prefer streaming responses for large payloads (`reply.send(stream)`).

## Testing

- Use `fastify.inject()` for integration tests — no real HTTP server needed.
- Test plugins in isolation with `fastify.register()` in test setup.
- Use `tap` or `vitest` — both work well with Fastify's inject API.
- Test schema validation: verify 400 responses for invalid input.

## Security

- Use `@fastify/helmet` for security headers.
- Use `@fastify/cors` with explicit origin whitelist, never `origin: true` in production.
- Use `@fastify/rate-limit` for API endpoints.
- Validate JWT with `@fastify/jwt`, not custom middleware.
