export interface WebSocketLike {
  readonly readyState: number
  readonly OPEN: number
  readonly CLOSING: number
  readonly CLOSED: number
  send(data: string | Uint8Array): void
  close(code?: number, reason?: string): void
  addEventListener(type: 'open' | 'close', listener: () => void): void
  addEventListener(type: 'error', listener: (event: unknown) => void): void
  addEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void
  removeEventListener(type: 'open' | 'close', listener: () => void): void
  removeEventListener(type: 'error', listener: (event: unknown) => void): void
  removeEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void
}

export interface WebSocketAcceptor {
  accept(socket: WebSocketLike): void
}

export interface WebSocketAcceptorHost {
  attach(acceptor: WebSocketAcceptor): Promise<void>
  detach(acceptor: WebSocketAcceptor): Promise<void>
}

export interface WebSocketConstructor {
  readonly OPEN: number
  readonly CLOSING: number
  readonly CLOSED: number
  new (url: string | URL): WebSocketLike
}
