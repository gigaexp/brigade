# Express — project conventions

## Architecture

- Router-based structure. Group routes by domain: `routes/users.js`, `routes/orders.js`.
- Use `express.Router()` for each route group. Mount in `app.js` with `app.use('/api/users', usersRouter)`.
- Middleware chain: error handler LAST, auth/validation FIRST.
- Separate concerns: routes → controllers → services → repositories. Routes are thin.

## Middleware

- Use middleware for cross-cutting concerns: auth, logging, validation, rate limiting.
- Order matters: `cors()` → `helmet()` → `express.json()` → auth → routes → error handler.
- Never call `next()` AND send a response — pick one.
- Async middleware: wrap in try/catch or use `express-async-errors` package.

## Error Handling

- Centralized error handler middleware (4 args: `err, req, res, next`). Register LAST.
- Create custom error classes: `class NotFoundError extends Error { statusCode = 404 }`.
- Never send stack traces in production. Use `NODE_ENV` to control error detail.
- Always call `next(err)` in catch blocks — don't swallow errors.

## Validation

- Use `express-validator` or `zod` with middleware for input validation.
- Validate body, params, query separately. Return 400 with specific field errors.
- Sanitize input: trim strings, escape HTML where needed.
- Never trust `req.body` without validation — even with TypeScript types.

## Performance

- Use `compression` middleware for response compression.
- Set proper `Cache-Control` headers for static and API responses.
- Use `helmet` for security headers (enabled by default in production).
- For file uploads use `multer` with size limits, never buffer entire file in memory.

## Testing

- Use `supertest` for integration tests — no real server needed.
- Test middleware in isolation by mocking `req`, `res`, `next`.
- Test error handler: verify correct status codes and response shapes.
- Test validation: verify 400 responses for invalid input.

## Security

- Use `helmet()` — no exceptions.
- Use `cors()` with explicit origin whitelist.
- Use `express-rate-limit` for public endpoints.
- Never use `eval()`, `new Function()`, or template strings with user input.
- Use parameterized queries for SQL — never string concatenation.
