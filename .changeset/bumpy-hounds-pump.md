---
'@credo-ts/webvh': patch
---

Upgrade `didwebvh-ts` to 3.1.0 (requires Node.js >=22.12.0).

- Require complete caller-authored documents for create/update, create fields under `options`, and explicit document/controller KMS mappings.
- Automatically register DID adapters through `WebVhModule`, preserving explicitly configured adapters.
- Add deactivation, publication-data/proof storage, KMS-backed witness signing, proof verification/fetching, unpublished-log resolution, and portable U-label migration via `WebVhApi.migrate`. Applications remain responsible for witness coordination and publication; finished operations indicate local persistence only.
- `agent.dids.*` supports ordinary DID create, resolve, update, and deactivate operations; `agent.modules.webvh.*` supports WebVH-specific controller and witness agent actions, resources, and migration (`webvh` is the configured module key).
- Resolve published logs through upstream with version selectors and validation metadata/errors preserved; disable caching and local-record shortcuts. Valid deactivation returns a null document with `deactivated: true`.
- Fix resource URL conversion and replace `WebVhDidResolverOptions.maxResourceBytes` with agent `fetchLimits.maxResponseBytes`.

Re-issue unsupported v0.5 and single-label-host DIDs. Disable pre-rotation with a full-document update before deactivation. Import context-free `getWitnessRequirements` and `deriveNextKeyHash` utilities directly from `didwebvh-ts`.
