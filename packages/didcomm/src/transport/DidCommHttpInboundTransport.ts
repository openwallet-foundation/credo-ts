import type { AgentContext } from '@credo-ts/core'
import { CredoError, EventEmitter, utils } from '@credo-ts/core'
import type { HttpHandler, HttpHandlerHost, HttpRequest } from '@credo-ts/core/http'
import { RequestBodyTooLargeError, readRequestBody } from '@credo-ts/core/http'
import { filter, firstValueFrom, Observable, ReplaySubject, take, takeUntil, timeout } from 'rxjs'
import type { DidCommMessageProcessedEvent, DidCommMessageReceivedEvent } from '../DidCommEvents'
import { DidCommEventTypes } from '../DidCommEvents'
import { DidCommModuleConfig } from '../DidCommModuleConfig'
import type { DidCommTransportSession } from '../DidCommTransportService'
import { DidCommTransportService } from '../DidCommTransportService'
import type { DidCommEncryptedMessage } from '../types'
import { DidCommMimeType } from '../types'
import type { DidCommInboundTransport } from './DidCommInboundTransport'

const supportedContentTypes: string[] = [DidCommMimeType.V0, DidCommMimeType.V1]
const maxRequestBodyBytes = 5 * 1024 * 1024

export interface DidCommHttpInboundTransportOptions {
  /**
   * The host that serves the HTTP handler, for example `httpServerHost()` from `@credo-ts/node/http`.
   */
  host?: HttpHandlerHost

  /**
   * The path on which inbound DIDComm messages are accepted.
   *
   * @default '/'
   */
  path?: string

  /**
   * How long to wait for an inbound message to be processed before responding.
   *
   * @default 10000
   */
  processedMessageListenerTimeoutMs?: number
}

export class DidCommHttpInboundTransport implements DidCommInboundTransport {
  public readonly handler: HttpHandler
  private readonly host?: HttpHandlerHost
  private readonly path: string
  private readonly processedMessageListenerTimeoutMs: number
  private readonly sessions = new Map<HttpTransportSession, () => void>()
  private agentContext?: AgentContext
  private stopped$?: ReplaySubject<void>
  private lifecycle: Promise<void> = Promise.resolve()

  public constructor({ host, path, processedMessageListenerTimeoutMs }: DidCommHttpInboundTransportOptions = {}) {
    this.host = host
    this.processedMessageListenerTimeoutMs = processedMessageListenerTimeoutMs ?? 10000
    this.path = path ?? '/'
    if (!this.path.startsWith('/')) {
      throw new CredoError(`HTTP path must be absolute: ${this.path}`)
    }

    this.handler = {
      pathPrefixes: [this.path],
      maxRequestBodyBytes,
      handle: (request) => this.handle(request),
    }
  }

  public start(agentContext: AgentContext): Promise<void> {
    return this.enqueue(async () => {
      if (this.agentContext) return

      agentContext.config.logger.debug('Starting HTTP inbound transport', {
        path: this.path,
      })

      this.agentContext = agentContext
      this.stopped$ = new ReplaySubject(1)

      try {
        await this.host?.attach(this.handler)
      } catch (error) {
        this.agentContext = undefined
        this.stopped$ = undefined
        throw error
      }
    })
  }

  public stop(): Promise<void> {
    return this.enqueue(async () => {
      if (!this.agentContext) return

      this.agentContext = undefined
      this.stopped$?.next()
      this.stopped$?.complete()
      this.stopped$ = undefined

      const sessions = [...this.sessions]
      this.sessions.clear()

      try {
        await Promise.all(
          sessions.map(async ([session, removeSession]) => {
            removeSession()
            await session.close()
          })
        )
      } finally {
        await this.host?.detach(this.handler)
      }
    })
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.lifecycle.then(operation, operation)
    this.lifecycle = result.catch(() => undefined)
    return result
  }

  private async handle(request: HttpRequest): Promise<Response | undefined> {
    if (request.method !== 'POST' || new URL(request.url).pathname !== this.path) return undefined

    const agentContext = this.agentContext
    const stopped$ = this.stopped$
    if (!agentContext || !stopped$) return new Response('Service unavailable', { status: 503 })

    const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
    if (!contentType || !supportedContentTypes.includes(contentType)) {
      return new Response(
        `Unsupported content-type. Supported content-types are: ${supportedContentTypes.join(', ')}`,
        { status: 415 }
      )
    }

    let session: HttpTransportSession | undefined
    let removeSession: (() => void) | undefined
    let onAbort: (() => void) | undefined
    try {
      const body = await readRequestBody(request, { maxBytes: maxRequestBodyBytes })
      if (this.stopped$ !== stopped$) return new Response('Service unavailable', { status: 503 })

      const encryptedMessage = JSON.parse(new TextDecoder().decode(body)) as DidCommEncryptedMessage
      const transportService = agentContext.dependencyManager.resolve(DidCommTransportService)
      session = new HttpTransportSession(utils.uuid(), request, contentType)
      const activeSession = session
      let removed = false
      removeSession = () => {
        if (removed) return
        removed = true
        transportService.removeSession(activeSession)
      }
      this.sessions.set(session, removeSession)

      onAbort = () => {
        removeSession?.()
        void activeSession.close()
      }
      request.signal.addEventListener('abort', onAbort, { once: true })
      if (request.signal.aborted) {
        onAbort()
        return await session.response
      }

      const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)
      const processed = firstValueFrom(
        eventEmitter.observable<DidCommMessageProcessedEvent>(DidCommEventTypes.DidCommMessageProcessed).pipe(
          filter((event) => event.payload.encryptedMessage === encryptedMessage),
          timeout({ first: this.processedMessageListenerTimeoutMs, meta: 'DidCommHttpInboundTransport.start' }),
          takeUntil(fromAbortSignal(request.signal)),
          takeUntil(stopped$),
          take(1)
        )
      )

      eventEmitter.emit<DidCommMessageReceivedEvent>(agentContext, {
        type: DidCommEventTypes.DidCommMessageReceived,
        payload: { message: encryptedMessage, session },
      })

      try {
        await processed
      } catch (error) {
        if (this.stopped$ !== stopped$ || request.signal.aborted) {
          await session.close()
          return await session.response
        }
        throw error
      }

      await session.close()
      return await session.response
    } catch (error) {
      if (request.signal.aborted) return undefined
      if (error instanceof RequestBodyTooLargeError) {
        return new Response(error.message, { status: error.status })
      }

      if (this.stopped$ !== stopped$ && session) {
        await session.close()
        return await session.response
      }

      agentContext.config.logger.error(`Error processing inbound message: ${String(error)}`, error)
      if (session?.closed) return await session.response
      return new Response('Error processing message', { status: 500 })
    } finally {
      removeSession?.()
      if (session) {
        if (onAbort) request.signal.removeEventListener('abort', onAbort)
        this.sessions.delete(session)
        await session.close()
      }
    }
  }
}

export class HttpTransportSession implements DidCommTransportSession {
  public readonly type = 'http'
  public readonly response: Promise<Response>
  private resolveResponse!: (response: Response) => void
  private _closed = false

  public get closed() {
    return this._closed
  }

  public constructor(
    public readonly id: string,
    public readonly req: HttpRequest,
    private readonly requestMimeType: string
  ) {
    this.response = new Promise((resolve) => {
      this.resolveResponse = resolve
    })
  }

  public async close(): Promise<void> {
    if (this.closed) return
    this._closed = true
    this.resolveResponse(new Response(null, { status: 200 }))
  }

  public async send(agentContext: AgentContext, encryptedMessage: DidCommEncryptedMessage): Promise<void> {
    if (this.closed) throw new CredoError(`${this.type} transport session has been closed.`)

    const didcommConfig = agentContext.dependencyManager.resolve(DidCommModuleConfig)
    const responseMimeType = supportedContentTypes.includes(this.requestMimeType)
      ? this.requestMimeType
      : (didcommConfig.didCommMimeType as string)

    this._closed = true
    this.resolveResponse(
      new Response(JSON.stringify(encryptedMessage), {
        status: 200,
        headers: { 'content-type': `${responseMimeType}; charset=utf-8` },
      })
    )
  }
}

function fromAbortSignal(signal: HttpRequest['signal']): Observable<void> {
  return new Observable((subscriber) => {
    const onAbort = () => subscriber.next()
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
    return () => signal.removeEventListener('abort', onAbort)
  })
}
