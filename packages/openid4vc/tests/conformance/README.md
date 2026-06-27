# OID4VC Conformance Tests

Automated [OpenID Foundation conformance suite](https://gitlab.com/openid/conformance-suite)
runs against credo-ts. The suite is started in Docker via
[testcontainers](https://node.testcontainers.org/) and drives credo-ts as the
system under test.

Inspired by
[Building trust in EUDI flows](https://mmollik.medium.com/building-trust-in-eudi-flows-my-oidf-conformance-ci-cd-setup-for-eudiplo-61342f3e6af5)
and the
[EUDIPLO OIDF setup](https://github.com/openwallet-foundation/eudiplo/tree/main/apps/backend/test/oidf).

## What runs

| File                                   | Role     | Plan                              |
| -------------------------------------- | -------- | --------------------------------- |
| `oid4vp-verifier.conformance.test.ts`  | Verifier | `oid4vp-1final-verifier-haip-test-plan` |

In the verifier flow the conformance suite plays the **wallet**: credo-ts
creates a signed authorization request, the suite fetches the request object
from the credo-ts verifier endpoint and posts an authorization response back,
and credo-ts verifies it. One test is reported per `(credential format, module)`
combination (SD-JWT VC and ISO mdoc).

## Layout

- `oidf-setup.ts` – testcontainers harness (MongoDB + Java conformance server +
  nginx TLS frontend). Exposes the host verifier port to the containers and
  extracts the suite's self-signed CA so tests validate TLS instead of disabling
  it.
- `oidf-suite.ts` – thin client for the conformance suite REST API (create plan,
  start module, poll status, export logs).
- `tls.ts` – generates the EC P-256 key material used for both the verifier's
  x509 request-signing certificate and the HTTPS server certificate.
- `*.conformance.test.ts` – the conformance specs themselves.

## Running locally

Requires a running Docker daemon.

```sh
# Map the testcontainers host alias to localhost so the suite can reach the
# verifier (one-time, or use TESTCONTAINERS_HOST_OVERRIDE as in CI).
echo "127.0.0.1 host.testcontainers.internal" | sudo tee -a /etc/hosts

# Run the full conformance project (pulls ~1GB of images on first run).
pnpm test:conformance

# Iterate on a subset of modules.
OIDF_MODULES=happy-flow pnpm test:conformance
```

The conformance tests are a dedicated vitest project and are **not** part of
`pnpm test:unit` / `pnpm test:e2e`, so the Docker requirement never affects
normal test runs. In CI they run inside the existing `E2E Tests` job (which
already starts Docker).

Per-plan HTML logs are exported to `tmp/oidf/logs/` and uploaded as CI
artifacts.

## Environment variables

| Variable                                  | Purpose                                                    | Default                           |
| ----------------------------------------- | --------------------------------------------------------- | --------------------------------- |
| `OIDF_MODULES`                            | Comma-separated substrings; only matching modules run     | _(all modules)_                   |
| `OIDF_TEST_URL`                           | Conformance suite URL (set automatically by the harness)  | `https://localhost:8443`          |
| `OIDF_DEMO_TOKEN`                         | Bearer token for a hosted suite instance                  | _(none, local suite needs none)_  |
| `TESTCONTAINERS_HOST_OVERRIDE`            | Host alias the containers use to reach the verifier       | _(none)_                          |
| `OIDF_WAIT_POLL_INTERVAL_MS`              | Status poll interval                                      | `300`                             |
| `OIDF_WAIT_NO_PROGRESS_ATTEMPTS_WAITING`  | No-progress bail-out while `WAITING` (~12s)               | `40`                              |
| `OIDF_WAIT_NO_PROGRESS_ATTEMPTS`          | No-progress bail-out otherwise (~36s)                     | `120`                             |
| `OIDF_WAIT_MAX_ATTEMPTS`                  | Hard cap on poll attempts per module (~72s)               | `240`                             |

## Timing calibration

Suite response times vary by machine and CI load. Hardcoded waits that are too
high hide hangs and make failures slow; waits that are too low make healthy runs
flaky. For each module two phases matter:

1. **Runner boot** – from creating the runner to the first `WAITING` state.
2. **Completion** – from the first `waitForFinished()` poll to a terminal status
   (`FINISHED` / `INTERRUPTED`).

To calibrate: run a representative subset, capture p50/p95 per phase from the
failure messages' poll checkpoints, and set thresholds from p95. A practical
rule of thumb:

- `WAITING` no-progress limit ≈ `ceil(p95_waiting_ms / poll_interval_ms) + 5`
  (keep strict — hangs usually stay in `WAITING`).
- Global no-progress limit ≈ `ceil(p95_stall_ms / poll_interval_ms) + 10`.
- Max attempts ≥ 2× the global no-progress limit.

Re-calibrate when the suite image (`TAG` in `oidf-setup.ts`) changes, the CI
runner type changes, or the networking/container stack changes.
