import type { AgentContext } from '@credo-ts/core'
import { CredoError, EventEmitter, utils } from '@credo-ts/core'
import { filter, firstValueFrom, ReplaySubject, take, timeout } from 'rxjs'
import type { DidCommMessageProcessedEvent, DidCommMessageReceivedEvent } from '../DidCommEvents'
import { DidCommEventTypes } from '../DidCommEvents'
import { DidCommModuleConfig } from '../DidCommModuleConfig'
import type { DidCommTransportSession } from '../DidCommTransportService'
import { DidCommTransportService } from '../DidCommTransportService'
import type { DidCommEncryptedMessage } from '../types'
import { DidCommMimeType } from '../types'
import type {
  DidCommHttpInboundBinding,
  DidCommHttpInboundHost,
  DidCommHttpInboundRequest,
  DidCommHttpInboundResponse,
} from './DidCommInboundHosting'
import type { DidCommInboundTransport } from './DidCommInboundTransport'

const supportedContentTypes: string[] = [DidCommMimeType.V0, DidCommMimeType.V1]
const maxBodyBytes = 5 * 1024 * 1024

export interface DidCommHttpInboundTransportOptions {
  /**
   * The host that serves the HTTP route, for example `expressHost()` from `@credo-ts/node/express`.
   */
  host: DidCommHttpInboundHost

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
  private host: DidCommHttpInboundHost
  private path: string
  private processedMessageListenerTimeoutMs: number
  private binding?: DidCommHttpInboundBinding

  public constructor({ host, path, processedMessageListenerTimeoutMs }: DidCommHttpInboundTransportOptions) {
    this.host = host
    this.processedMessageListenerTimeoutMs = processedMessageListenerTimeoutMs ?? 10000 // timeout after 10 seconds
    this.path = path ?? '/'
  }

  public async start(agentContext: AgentContext) {
    const transportService = agentContext.dependencyManager.resolve(DidCommTransportService)

    agentContext.config.logger.debug('Starting HTTP inbound transport', {
      path: this.path,
    })

    const binding = this.createBinding(agentContext, transportService)
    this.binding = binding
    await this.host.attach(binding)
  }

  public async stop(): Promise<void> {
    if (!this.binding) {
      return
    }

    await this.host.detach(this.binding)
  }

  private createBinding(
    agentContext: AgentContext,
    transportService: DidCommTransportService
  ): DidCommHttpInboundBinding {
    return {
      path: this.path,
      contentTypes: supportedContentTypes,
      maxBodyBytes,
      handle: async (req, res) => {
        const contentType = req.contentType

        if (!contentType || !supportedContentTypes.includes(contentType)) {
          return res.send(
            415,
            `Unsupported content-type. Supported content-types are: ${supportedContentTypes.join(', ')}`
          )
        }

        const session = new HttpTransportSession(utils.uuid(), req, res)
        // We want to make sure the session is removed if the connection is closed, as it
        // can't be used anymore then. This could happen if the client abruptly closes the connection.
        req.onClose(() => transportService.removeSession(session))

        try {
          const message = req.body as string
          const encryptedMessage = JSON.parse(message) as DidCommEncryptedMessage

          const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)
          const observable = eventEmitter.observable<DidCommMessageProcessedEvent>(
            DidCommEventTypes.DidCommMessageProcessed
          )
          const subject = new ReplaySubject(1)

          observable
            .pipe(
              filter((e) => e.type === DidCommEventTypes.DidCommMessageProcessed),
              filter((e) => e.payload.encryptedMessage === encryptedMessage),
              timeout({
                first: this.processedMessageListenerTimeoutMs,
                meta: 'DidCommHttpInboundTransport.start',
              }),
              take(1) // automatically unsubscribe after the first matching event
            )
            .subscribe(subject)

          eventEmitter.emit<DidCommMessageReceivedEvent>(agentContext, {
            type: DidCommEventTypes.DidCommMessageReceived,
            payload: {
              message: encryptedMessage,
              session: session,
            },
          })

          // Wait for message to be processed
          await firstValueFrom(subject)

          // If agent did not use session when processing message we need to send response here.
          if (!res.headersSent) {
            res.send(200)
          }
        } catch (error) {
          agentContext.config.logger.error(`Error processing inbound message: ${error.message}`, error)

          if (!res.headersSent) {
            res.send(500, 'Error processing message')
          }
        } finally {
          transportService.removeSession(session)
        }
      },
    }
  }
}

export class HttpTransportSession implements DidCommTransportSession {
  public id: string
  public readonly type = 'http'
  public req: DidCommHttpInboundRequest
  public res: DidCommHttpInboundResponse

  public constructor(id: string, req: DidCommHttpInboundRequest, res: DidCommHttpInboundResponse) {
    this.id = id
    this.req = req
    this.res = res
  }

  public async close(): Promise<void> {
    if (!this.res.headersSent) {
      this.res.send(200)
    }
  }

  public async send(agentContext: AgentContext, encryptedMessage: DidCommEncryptedMessage): Promise<void> {
    if (this.res.headersSent) {
      throw new CredoError(`${this.type} transport session has been closed.`)
    }

    // By default we take the agent config's default DIDComm content-type
    const didcommConfig = agentContext.dependencyManager.resolve(DidCommModuleConfig)
    let responseMimeType = didcommConfig.didCommMimeType as string

    // However, if the request mime-type is a mime-type that is supported by us, we use that
    // to minimize the chance of interoperability issues
    const requestMimeType = this.req.contentType
    if (requestMimeType && supportedContentTypes.includes(requestMimeType)) {
      responseMimeType = requestMimeType
    }

    this.res.send(200, JSON.stringify(encryptedMessage), responseMimeType)
  }
}
