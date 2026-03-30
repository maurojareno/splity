# Security Rules

- NEVER use string interpolation in raw SQL queries. Use parameterized queries only.
- NEVER use `$queryRawUnsafe` or `$executeRawUnsafe` with user input.
- Always verify user authorization before returning/modifying resources (check group membership, expense ownership).
- Use `crypto.randomBytes()` for tokens, NEVER `Math.random()`.
- Do not log tokens, passwords, or sensitive data even in development.
- Add input length limits (`.max()`) to all Zod string validators.
- Validate file dimensions/size before processing uploads.
