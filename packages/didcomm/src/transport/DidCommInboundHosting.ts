/**
 * Internal contracts between the DIDComm inbound transports and the platform hosts that
 * serve them. They are satisfied structurally by the hosts in `@credo-ts/node`, so they
 * are intentionally not exported from the package.
 */

export interface DidCommHttpInboundRequest {
  /**
   * The request body, if it was read by the host. Hosts only read bodies whose
   * content-type is listed in {@link DidCommHttpInboundBinding.contentTypes}.
   */
  readonly body?: string
  readonly contentType?: string
  onClose(listener: () => void): void
}

export interface DidCommHttpInboundResponse {
  readonly headersSent: boolean
  send(statusCode: number, body?: string, contentType?: string): void
}

export interface DidCommHttpInboundBinding {
  readonly path: string
  readonly contentTypes: string[]
  readonly maxBodyBytes: number
  handle(request: DidCommHttpInboundRequest, response: DidCommHttpInboundResponse): Promise<void>
}

export interface DidCommHttpInboundHost {
  attach(binding: DidCommHttpInboundBinding): Promise<void>
  detach(binding: DidCommHttpInboundBinding): Promise<void>
}

export interface DidCommWebSocket {
  readonly readyState: number
  send(data: string, callback?: (error?: Error) => void): void
  close(): void
  terminate(): void
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
  addEventListener(type: 'close', listener: () => void): void
}

export interface DidCommWebSocketAcceptor {
  accept(socket: DidCommWebSocket): void
}

export interface DidCommWebSocketHost {
  attach(acceptor: DidCommWebSocketAcceptor): Promise<void>
  detach(acceptor: DidCommWebSocketAcceptor): Promise<void>
}
