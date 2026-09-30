import type { AgentContext } from '@credo-ts/core'
import type { DidCommInboundTransport } from '@credo-ts/didcomm'
import { DidCommWsInboundTransport as DidCommWsTransport } from '@credo-ts/didcomm'
import type { WebSocketServer } from 'ws'
import { WebSocketHost } from '../webSocketHost'

/**
 * WebSocket inbound transport served by a `ws` WebSocketServer.
 *
 * Wraps the DIDComm WebSocket inbound transport from `@credo-ts/didcomm` with a {@link WebSocketHost}.
 *
 * @deprecated Use the `webSocket` option of `DidCommModule` with `webSocketHost()` from `@credo-ts/node` instead.
 */
export class DidCommWsInboundTransport implements DidCommInboundTransport {
  private transport: DidCommWsTransport

  public constructor(options: { server: WebSocketServer; port?: undefined } | { server?: undefined; port: number }) {
    this.transport = new DidCommWsTransport({ host: new WebSocketHost(options) })
  }

  public async start(agentContext: AgentContext) {
    await this.transport.start(agentContext)
  }

  public async stop() {
    await this.transport.stop()
  }
}
