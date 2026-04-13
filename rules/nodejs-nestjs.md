# NestJS — project conventions

## Architecture

- Module-based structure. Every feature is a `@Module()` with controllers, services, and providers.
- Follow NestJS conventions: `users/users.module.ts`, `users/users.controller.ts`, `users/users.service.ts`.
- Use dependency injection everywhere — never instantiate services with `new`. Inject via constructor.
- Keep controllers thin: validate input, call service, return response. No business logic in controllers.
- Use barrel exports (`index.ts`) in each module for clean imports.

## DTOs & Validation

- Create DTO classes for every endpoint input: `CreateUserDto`, `UpdateUserDto`.
- Use `class-validator` decorators on DTOs: `@IsEmail()`, `@IsNotEmpty()`, `@MinLength()`.
- Enable `ValidationPipe` globally in `main.ts` with `whitelist: true` and `transform: true`.
- Use `@ApiProperty()` from `@nestjs/swagger` on every DTO field for auto-generated docs.
- Never access `req.body` directly — use typed DTOs with `@Body()`.

## Error Handling

- Use NestJS built-in exceptions: `throw new NotFoundException('User not found')`.
- Create custom exceptions extending `HttpException` for domain-specific errors.
- Use `@Catch()` exception filters for centralized error handling.
- Never return raw error objects — always use structured error responses.

## Guards & Interceptors

- Use `@UseGuards(AuthGuard)` for authentication, not middleware.
- Use `@UseInterceptors()` for logging, caching, response transformation.
- Use `@SetMetadata()` + custom guards for role-based access control.
- Order: Guards → Interceptors (before) → Pipes → Handler → Interceptors (after) → Filters.

## Database

- Use TypeORM or Prisma with NestJS modules. Prefer Prisma for new projects.
- Use repository pattern: inject repository via DI, never use `getRepository()` directly.
- Migrations are mandatory for schema changes — never use `synchronize: true` in production.
- Use transactions for multi-step operations via `QueryRunner` or Prisma `$transaction`.

## Testing

- Unit test services: mock dependencies with `@nestjs/testing` `Test.createTestingModule()`.
- E2E test controllers: use `supertest` with `INestApplication`.
- Test guards and pipes in isolation.
- Use `overrideProvider()` to mock external services in tests.

## Security

- Enable `helmet` via `app.use(helmet())` in `main.ts`.
- Enable CORS with explicit origins: `app.enableCors({ origin: [...] })`.
- Use `@nestjs/throttler` for rate limiting.
- Never expose internal IDs in URLs if they're sequential — use UUIDs.
