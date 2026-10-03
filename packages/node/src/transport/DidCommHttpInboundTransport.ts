import type { AgentContext } from '@credo-ts/core'
import type { DidCommInboundTransport } from '@credo-ts/didcomm'
import { DidCommHttpInboundTransport as DidCommHttpTransport } from '@credo-ts/didcomm'
import type { Express } from 'express'
import { ExpressHost } from '../express'

/**
 * HTTP inbound transport served by Express.
 *
 * Wraps the DIDComm HTTP inbound transport from `@credo-ts/didcomm` with an {@link ExpressHost}.
 *
 * @deprecated Use the `transports.inbound` option of `DidCommModule` with `httpServerHost()` from `@credo-ts/node` instead.
 */
export class DidCommHttpInboundTransport implements DidCommInboundTransport {
  private host: ExpressHost
  private transport: DidCommHttpTransport

  public get app(): Express {
    return this.host.app
  }

  public get server() {
    return this.host.server
  }

  public constructor({
    app,
    path,
    port,
    processedMessageListenerTimeoutMs,
  }:
    | { app: Express; port?: undefined; path?: string; processedMessageListenerTimeoutMs?: number }
    | { app?: Express; port: number; path?: string; processedMessageListenerTimeoutMs?: number }) {
    this.host = port === undefined ? new ExpressHost({ app: app as Express }) : new ExpressHost({ app, port })
    this.transport = new DidCommHttpTransport({ host: this.host, path, processedMessageListenerTimeoutMs })
  }

  public async start(agentContext: AgentContext) {
    await this.transport.start(agentContext)
  }

  public async stop(): Promise<void> {
    await this.transport.stop()
  }
}
