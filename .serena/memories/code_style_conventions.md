# SuperCode Code Style and Conventions

## TypeScript Style
- **No semicolons**: `"semi": false` in prettier config
- **Print width**: 120 characters
- **Consistent spacing**: Use Prettier for formatting

## Code Patterns
- **Export namespaces**: Use `export namespace` pattern for organizing related functionality
- **Zod schemas**: Extensive use of Zod for type validation and API schemas
- **Hono framework**: RESTful API design with typed routes
- **OpenAPI integration**: All API endpoints documented with OpenAPI specs

## File Naming
- **kebab-case**: For file names (e.g., `web-routes.ts`, `web-templates.ts`)
- **PascalCase**: For exported classes/namespaces
- **camelCase**: For functions and variables

## Import/Export Style
- Use destructured imports where appropriate
- Prefer named exports over default exports
- Organize imports: external libraries first, then internal modules

## Error Handling
- Use `NamedError` pattern for structured error handling
- Comprehensive error responses in API with proper HTTP status codes

## API Design
- RESTful endpoints with clear operation IDs
- Consistent JSON responses
- Proper HTTP status codes
- Comprehensive OpenAPI documentation

## Development Principles
- Type safety first (TypeScript + Zod)
- API-first design
- Modular architecture with clear separation of concerns
- Performance optimization for large repositories