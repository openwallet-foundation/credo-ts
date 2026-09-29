---
'@credo-ts/core': patch
'@credo-ts/node': patch
'@credo-ts/didcomm': patch
---

Make published TypeScript declarations resolvable without development dependencies. Move `@types/events` to dependencies in `@credo-ts/core`, and `@types/node` and `@types/ws` to dependencies in `@credo-ts/node`. Replace non-portable and self-referential imports in core, and use `AgentDependencies` for the WebSocket type in `@credo-ts/didcomm` instead of importing from undeclared `ws`.
