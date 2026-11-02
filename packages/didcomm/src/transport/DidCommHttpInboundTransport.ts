import type { AgentContext } from '@credo-ts/core'
import { CredoError, EventEmitter, utils } from '@credo-ts/core'
import { type HttpRoute, HttpRouter, readBodyText } from '@credo-ts/core/http'
import { filter, firstValueFrom, ReplaySubject, take, timeout } from 'rxjs'
import {
  DidCommEventTypes,
  type DidCommMessageProcessedEvent,
  type DidCommMessageReceivedEvent,
} from '../DidCommEvents'
import { DidCommTransportService, type DidCommTransportSession } from '../DidCommTransportService'
import { type DidCommEncryptedMessage, DidCommMimeType } from '../types'
import type { DidCommInboundTransport } from './DidCommInboundTransport'

const supportedContentTypes: string[] = [DidCommMimeType.V0, DidCommMimeType.V1]
const maxBodySize = 5 * 1024 * 1024

export interface DidCommHttpInboundTransportOptions {
  /**
   * @default '/'
   */
  path?: string

  /**
   * @default 10000
   */
  processedMessageListenerTimeoutMs?: number
}

/**
 * Receives DIDComm messages over HTTP on the agent's {@link HttpRouter}, hosted by the agent's `http` hosts.
 */
export class DidCommHttpInboundTransport implements DidCommInboundTransport {
  private path: string
  private processedMessageListenerTimeoutMs: number
  private route?: HttpRoute
  private router?: HttpRouter

  public constructor(options: DidCommHttpInboundTransportOptions = {}) {
    this.path = options.path ?? '/'
    this.processedMessageListenerTimeoutMs = options.processedMessageListenerTimeoutMs ?? 10000
  }

  public async start(agentContext: AgentContext) {
    agentContext.config.logger.debug('Starting HTTP inbound transport', { path: this.path })

    this.router = agentContext.dependencyManager.resolve(HttpRouter)
    this.route = { method: 'POST', path: this.path, handler: this.handler(agentContext) }
    this.router.addRoute(this.route)
  }

  public async stop() {
    if (this.route) this.router?.removeRoute(this.route)
  }

  private handler(agentContext: AgentContext): HttpRoute['handler'] {
    const transportService = agentContext.dependencyManager.resolve(DidCommTransportService)
    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)

    return async (request) => {
      const contentType = request.headers.get('content-type')
      if (!contentType || !supportedContentTypes.includes(contentType)) {
        return new Response(
          `Unsupported content-type. Supported content-types are: ${supportedContentTypes.join(', ')}`,
          { status: 415 }
        )
      }

      const body = await readBodyText(request, maxBodySize)
      if (body === undefined) return new Response('Payload too large', { status: 413 })

      const session = new DidCommHttpTransportSession(utils.uuid(), contentType)
      // The session can't be used once the client closed the connection
      request.signal.addEventListener('abort', () => transportService.removeSession(session), { once: true })

      try {
        const encryptedMessage = JSON.parse(body) as DidCommEncryptedMessage

        const subject = new ReplaySubject(1)
        eventEmitter
          .observable<DidCommMessageProcessedEvent>(DidCommEventTypes.DidCommMessageProcessed)
          .pipe(
            filter((e) => e.payload.encryptedMessage === encryptedMessage),
            timeout({ first: this.processedMessageListenerTimeoutMs, meta: 'DidCommHttpInboundTransport.start' }),
            take(1)
          )
          .subscribe(subject)

        eventEmitter.emit<DidCommMessageReceivedEvent>(agentContext, {
          type: DidCommEventTypes.DidCommMessageReceived,
          payload: { message: encryptedMessage, session },
        })

        // Answer as soon as the agent responds over the session, else once the message is processed
        await Promise.race([firstValueFrom(subject), session.responded])
        return session.response ?? new Response(null, { status: 200 })
      } catch (error) {
        agentContext.config.logger.error(`Error processing inbound message: ${error.message}`, error)
        return session.response ?? new Response('Error processing message', { status: 500 })
      } finally {
        transportService.removeSession(session)
      }
    }
  }
}

export class DidCommHttpTransportSession implements DidCommTransportSession {
  public readonly type = 'http'
  public response?: Response
  public readonly responded: Promise<void>
  private resolveResponded!: () => void

  public constructor(
    public id: string,
    private requestMimeType: string
  ) {
    this.responded = new Promise((resolve) => {
      this.resolveResponded = resolve
    })
  }

  public async close(): Promise<void> {
    this.respond(new Response(null, { status: 200 }))
  }

  public async send(_agentContext: AgentContext, encryptedMessage: DidCommEncryptedMessage): Promise<void> {
    if (this.response) {
      throw new CredoError(`${this.type} transport session has been closed.`)
    }

    // Answer with the request's mime-type, which we support, to minimize the chance of interoperability issues
    this.respond(
      new Response(JSON.stringify(encryptedMessage), {
        status: 200,
        headers: { 'Content-Type': this.requestMimeType },
      })
    )
  }

  private respond(response: Response) {
    this.response ??= response
    this.resolveResponded()
  }
}
