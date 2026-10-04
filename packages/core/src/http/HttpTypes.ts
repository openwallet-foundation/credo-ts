export interface HttpAbortSignal {
  readonly aborted: boolean
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void
  removeEventListener(type: 'abort', listener: () => void): void
}

export interface HttpRequest {
  readonly method: string
  readonly url: string
  readonly headers: Pick<Headers, 'get'>
  readonly signal: HttpAbortSignal
  readonly body: ReadableStream<Uint8Array> | null
  readonly bodyUsed: boolean
  arrayBuffer(): Promise<ArrayBuffer>
  blob(): Promise<Blob>
  formData(): Promise<FormData>
  json(): Promise<unknown>
  text(): Promise<string>
  clone(): HttpRequest
}

export interface HttpHandler {
  readonly pathPrefixes: readonly string[]
  readonly maxRequestBodyBytes: number
  handle(request: HttpRequest): Promise<Response | undefined>
}

export interface HttpHandlerHost {
  attach(handler: HttpHandler): Promise<void>
  detach(handler: HttpHandler): Promise<void>
}
