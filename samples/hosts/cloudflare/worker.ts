/**
 * Hosts the agent in a Cloudflare Durable Object, next to the routes of your Hono app, HTTP and WebSockets on one
 * port. The agent keeps its records and keys in the Durable Object's SQLite storage.
 *
 * DIDComm messages reach the agent over HTTP and WebSockets, but it can't decrypt them yet: DIDComm v1 envelopes need
 * XSalsa20-Poly1305, which only the Askar key management service supports, and Askar is a native library.
 *
 * Run with `pnpm build && WRANGLER_BUILD_CONDITIONS=cli,workerd,worker,browser npx wrangler dev -c samples/hosts/cloudflare/wrangler.jsonc`.
 * The `cli` condition makes wrangler bundle the built packages, as it would for an app.
 */
import type { AgentContext, Kms } from '@credo-ts/core'
import { Agent, ConsoleLogger, LogLevel } from '@credo-ts/core'
import { cloudflareHost } from '@credo-ts/core/http/cloudflare'
import { KeyManagementModule } from '@credo-ts/core/kms'
import { DidCommModule } from '@credo-ts/didcomm'
import { DrizzleStorageModule } from '@credo-ts/drizzle-storage'
import { coreBundle } from '@credo-ts/drizzle-storage/core'
import coreMigrations from '@credo-ts/drizzle-storage/core/migrations/sqlite'
import { didcommBundle } from '@credo-ts/drizzle-storage/didcomm'
import didcommMigrations from '@credo-ts/drizzle-storage/didcomm/migrations/sqlite'
import { agentDependencies, NodeKeyManagementService, type NodeKeyManagementStorage } from '@credo-ts/node'
import { drizzle } from 'drizzle-orm/durable-sqlite'
import { migrate } from 'drizzle-orm/durable-sqlite/migrator'
import { Hono } from 'hono'

// The parts of the Cloudflare types this sample uses, without adding @cloudflare/workers-types to this repo
interface DurableObjectState {
  storage: {
    get<T>(key: string): Promise<T | undefined>
    put(key: string, value: unknown): Promise<void>
    delete(key: string): Promise<boolean>
  }
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>
}
interface Env {
  CREDO_AGENT: { idFromName(name: string): unknown; get(id: unknown): { fetch(request: Request): Promise<Response> } }
  AGENT_URL: string
}

/**
 * Runs the agent. One instance serves all requests, so the agent and its WebSocket connections live in one place.
 */
export class CredoAgent {
  private app = new Hono()
  private host = cloudflareHost(this, { fetch: this.app.fetch })
  private agent: ReturnType<typeof createAgent>

  public fetch = this.host.fetch
  public webSocketMessage = this.host.webSocketMessage
  public webSocketClose = this.host.webSocketClose

  public constructor(
    public ctx: DurableObjectState,
    env: Env
  ) {
    const database = drizzle(ctx.storage as never)
    this.agent = createAgent(env.AGENT_URL, database, this.host, new DurableObjectKeyStorage(ctx))

    this.app.get('/health', (c) => c.json({ status: 'ok' }))
    this.app.get('/invitation', async (c) => {
      const { outOfBandInvitation } = await this.agent.didcomm.oob.createInvitation({ multiUseInvitation: true })
      return c.text(outOfBandInvitation.toUrl({ domain: env.AGENT_URL }))
    })

    // Requests wait until the database is migrated and the agent is initialized
    void ctx.blockConcurrencyWhile(async () => {
      await migrate(database, mergeMigrations([coreMigrations, didcommMigrations]))
      await this.agent.initialize()
    })
  }
}

export default {
  fetch: (request: Request, env: Env) => env.CREDO_AGENT.get(env.CREDO_AGENT.idFromName('agent')).fetch(request),
}

function createAgent(
  url: string,
  database: ReturnType<typeof drizzle>,
  host: ReturnType<typeof cloudflareHost>,
  keyStorage: NodeKeyManagementStorage
) {
  return new Agent({
    config: { logger: new ConsoleLogger(LogLevel.Info) },
    dependencies: agentDependencies,
    http: host,
    modules: {
      storage: new DrizzleStorageModule({ database, bundles: [coreBundle, didcommBundle] }),
      kms: new KeyManagementModule({ backends: [new NodeKeyManagementService(keyStorage)] }),
      didcomm: new DidCommModule({
        endpoints: [url, url.replace(/^http/, 'ws')],
        transports: {
          inbound: { http: true, ws: true },
          outbound: { http: true, ws: true },
        },
        connections: { autoAcceptConnections: true },
      }),
    },
  })
}

/**
 * Merges the migrations of several bundles into one set ordered by time. Drizzle's migrator skips migrations older
 * than the last one it applied, so running the bundles one after another would skip some of them.
 */
function mergeMigrations(sets: Parameters<typeof migrate>[1][]): Parameters<typeof migrate>[1] {
  const name = (idx: number) => `m${idx.toString().padStart(4, '0')}`
  const ordered = sets
    .flatMap(({ journal, migrations }) => journal.entries.map((entry) => ({ entry, sql: migrations[name(entry.idx)] })))
    .sort((a, b) => a.entry.when - b.entry.when)

  return {
    journal: { entries: ordered.map(({ entry }, idx) => ({ ...entry, idx })) },
    migrations: Object.fromEntries(ordered.map(({ sql }, idx) => [name(idx), sql])),
  }
}

/**
 * Keeps the private keys of the Node.js key management service in the Durable Object's storage.
 */
class DurableObjectKeyStorage implements NodeKeyManagementStorage {
  public constructor(private ctx: DurableObjectState) {}

  public async get(agentContext: AgentContext, keyId: string) {
    return (await this.ctx.storage.get<Kms.KmsJwkPrivate>(this.key(agentContext, keyId))) ?? null
  }

  public async has(agentContext: AgentContext, keyId: string) {
    return (await this.get(agentContext, keyId)) !== null
  }

  public async set(agentContext: AgentContext, keyId: string, jwk: Kms.KmsJwkPrivate) {
    await this.ctx.storage.put(this.key(agentContext, keyId), jwk)
  }

  public async delete(agentContext: AgentContext, keyId: string) {
    return this.ctx.storage.delete(this.key(agentContext, keyId))
  }

  private key(agentContext: AgentContext, keyId: string) {
    return `kms:${agentContext.contextCorrelationId}:${keyId}`
  }
}
