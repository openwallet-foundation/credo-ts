/**
 * OIDF Conformance Test Setup
 *
 * Provides setup/teardown hooks that manage the OpenID Foundation conformance
 * suite as ephemeral Docker containers (MongoDB + Java conformance server +
 * nginx TLS frontend) using Testcontainers.
 *
 * Usage in a conformance test file:
 *   import { useOidfContainers } from './oidf-setup'
 *   useOidfContainers()
 *
 * Note: `TestContainers.exposeHostPorts()` starts an SSH sidecar container that
 * keeps a persistent connection to the host. That has to run in the same worker
 * context as the tests (not in a vitest globalSetup), which is why we register
 * `beforeAll`/`afterAll` hooks here instead.
 *
 * Adapted from the OpenWallet Foundation EUDIPLO conformance setup:
 * https://github.com/openwallet-foundation/eudiplo/tree/main/apps/backend/test/oidf
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import {
  GenericContainer,
  Network,
  type StartedNetwork,
  type StartedTestContainer,
  TestContainers,
  Wait,
} from 'testcontainers'
import { afterAll, beforeAll } from 'vitest'

/**
 * Conformance suite release pinned for reproducible runs. Bump together with a
 * re-calibration of the wait thresholds (see README.md) and a refresh of any
 * module snapshots.
 */
const TAG = 'release-v5.1.44'

const CONFORMANCE_SERVER_IMAGE = `registry.gitlab.com/openid/conformance-suite:${TAG}`
const CONFORMANCE_HTTPD_IMAGE = `registry.gitlab.com/openid/conformance-suite/nginx:${TAG}`

/**
 * Port the credo-ts verifier under test listens on. It is exposed to the
 * conformance containers via `TestContainers.exposeHostPorts` so the suite
 * (acting as the wallet) can reach the verifier endpoints at
 * `https://host.testcontainers.internal:<HOST_VERIFIER_PORT>`.
 */
export const HOST_VERIFIER_PORT = 9382

/**
 * Port the conformance suite httpd (nginx) terminates TLS on. Mapped 1:1 to the
 * host so the suite UI/API is reachable at `https://localhost:8443`.
 */
const CONFORMANCE_HTTPD_PORT = 8443

/**
 * Path inside the conformance nginx image where the self-signed server
 * certificate lives. Pinned to the upstream nginx image
 * (registry.gitlab.com/openid/conformance-suite/nginx) which terminates TLS for
 * the conformance runner. Update if the upstream image relocates it.
 */
const OIDF_HTTPD_CERT_PATH_IN_CONTAINER = '/etc/ssl/certs/nginx-selfsigned.crt'

/**
 * Filesystem location (under the repo `tmp/` dir) where the extracted
 * conformance httpd CA cert is written so tests can configure their HTTPS
 * agents with it instead of disabling TLS verification entirely. Available only
 * after `setupOidfContainers()` has run.
 */
export const OIDF_HTTPD_CA_PATH = resolve(__dirname, '../../../../tmp/oidf/oidf-httpd-ca.pem')

let network: StartedNetwork | undefined
let mongoDb: StartedTestContainer | undefined
let containerServer: StartedTestContainer | undefined
let containerHttp: StartedTestContainer | undefined

/**
 * Starts MongoDB, the conformance server, and the httpd TLS frontend on a shared
 * Docker network and exposes the host verifier port to them.
 */
async function setupOidfContainers(): Promise<void> {
  try {
    await TestContainers.exposeHostPorts(HOST_VERIFIER_PORT)
    await TestContainers.exposeHostPorts(CONFORMANCE_HTTPD_PORT)

    network = await new Network().start()

    const projectLabels = {
      'com.docker.compose.project': 'oidf-conformance-suite',
    }

    // MongoDB first — the conformance server depends on it.
    mongoDb = await new GenericContainer('mongo:6.0.13')
      .withNetwork(network)
      .withNetworkAliases('mongodb')
      .withName('oidf-conformance-mongodb')
      .withLabels(projectLabels)
      .start()

    // Conformance server (depends on MongoDB). `base_url` must match the
    // public URL the httpd frontend is reachable at from the host.
    containerServer = await new GenericContainer(CONFORMANCE_SERVER_IMAGE)
      .withNetwork(network)
      .withNetworkAliases('server')
      .withName('oidf-conformance-server')
      .withLabels(projectLabels)
      .withEntrypoint([
        'java',
        '-jar',
        '/server/fapi-test-suite.jar',
        '-Djdk.tls.maxHandshakeMessageSize=65536',
        `--fintechlabs.base_url=https://host.testcontainers.internal:${CONFORMANCE_HTTPD_PORT}`,
        '--fintechlabs.devmode=true',
      ])
      .withWaitStrategy(Wait.forLogMessage(/.*Started Application in.*/))
      .withStartupTimeout(180_000)
      .start()

    // httpd / nginx TLS frontend (depends on the server).
    containerHttp = await new GenericContainer(CONFORMANCE_HTTPD_IMAGE)
      .withNetwork(network)
      .withName('oidf-conformance-httpd')
      .withLabels(projectLabels)
      .withEnvironment({
        OIDC_GITLAB_CLIENTID: 'oidf-conformance-client',
        OIDC_GITLAB_CLIENTSECRET: 'oidf-conformance-secret',
      })
      .withExposedPorts({
        container: CONFORMANCE_HTTPD_PORT,
        host: CONFORMANCE_HTTPD_PORT,
      })
      .withWaitStrategy(Wait.forListeningPorts())
      .start()

    const httpdPort = containerHttp.getMappedPort(CONFORMANCE_HTTPD_PORT)
    process.env.OIDF_TEST_URL = `https://localhost:${httpdPort}`

    // Extract the conformance httpd server certificate so tests can validate
    // the TLS chain instead of disabling certificate verification entirely.
    const certResult = await containerHttp.exec(['cat', OIDF_HTTPD_CERT_PATH_IN_CONTAINER])
    if (certResult.exitCode !== 0) {
      throw new Error(
        `Failed to read OIDF httpd cert from ${OIDF_HTTPD_CERT_PATH_IN_CONTAINER} (exit ${certResult.exitCode}): ${certResult.stderr}`
      )
    }
    mkdirSync(dirname(OIDF_HTTPD_CA_PATH), { recursive: true })
    writeFileSync(OIDF_HTTPD_CA_PATH, certResult.output)
  } catch (error) {
    // Clean up any containers that did start, then surface the original error.
    await teardownOidfContainers()
    throw error
  }
}

/**
 * Stops all conformance containers in reverse order of startup.
 */
async function teardownOidfContainers(): Promise<void> {
  const stop = async (container: StartedTestContainer | undefined) => {
    if (!container) return
    // Best-effort teardown; a failed stop must not mask the real test outcome.
    await container.stop({ remove: true, removeVolumes: true }).catch(() => undefined)
  }

  await stop(containerHttp)
  await stop(containerServer)
  await stop(mongoDb)

  containerHttp = undefined
  containerServer = undefined
  mongoDb = undefined

  // Give Docker a moment to clean up network endpoints before removing it.
  await new Promise((resolve) => setTimeout(resolve, 1000))

  if (network) {
    try {
      await network.stop()
    } catch {
      // If endpoints are still attached the first stop can fail — retry once,
      // then give up silently so teardown never throws.
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await network.stop().catch(() => undefined)
    }
    network = undefined
  }
}

/**
 * Registers the OIDF container setup/teardown hooks. Call this at the top level
 * of a conformance test file.
 */
export function useOidfContainers(): void {
  beforeAll(setupOidfContainers, 300_000) // 5 minute timeout for image pulls + boot
  afterAll(teardownOidfContainers)
}
