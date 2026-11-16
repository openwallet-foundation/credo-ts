import type { AgentContext } from '@credo-ts/core'
import { CredoError, EventEmitter, utils } from '@credo-ts/core'
import type {
  DidCommEncryptedMessage,
  DidCommInboundTransport,
  DidCommMessageProcessingFailedEvent,
  DidCommMessageReceivedEvent,
  DidCommTransportSession,
} from '@credo-ts/didcomm'
import {
  DIDCOMM_V2_ENCRYPTED_MIME_TYPE,
  DIDCOMM_V2_SIGNED_MIME_TYPE,
  DidCommEventTypes,
  DidCommMimeType,
  DidCommModuleConfig,
  DidCommTransportService,
  isDidCommV2EncryptedMessage,
  normalizeDidCommMediaType,
} from '@credo-ts/didcomm'
import type { Express, Request, Response } from 'express'
import express, { text } from 'express'
import type { Server } from 'http'
import { firstValueFrom, from, timeout } from 'rxjs'

const supportedContentTypes: string[] = [DidCommMimeType.V0, DidCommMimeType.V1]

export type DidCommHttpInboundTransportOptions = (
  | { app: Express; port?: undefined }
  | { app?: Express; port: number }
) & {
  path?: string
  processedMessageListenerTimeoutMs?: number

  /**
   * Respond once the message has been processed. By default a message that doesn't get a response over the request
   * is answered as soon as it has been decrypted. Serverless platforms can stop the CPU once the response is sent.
   *
   * @default false
   */
  respondAfterProcessing?: boolean
}

export class DidCommHttpInboundTransport implements DidCommInboundTransport {
  public readonly app: Express
  private port?: number
  private path: string
  private _server?: Server
  private processedMessageListenerTimeoutMs: number
  private respondAfterProcessing: boolean

  public get server() {
    return this._server
  }

  public constructor({
    app,
    path,
    port,
    processedMessageListenerTimeoutMs,
    respondAfterProcessing,
  }: DidCommHttpInboundTransportOptions) {
    this.port = port
    this.processedMessageListenerTimeoutMs = processedMessageListenerTimeoutMs ?? 10000 // timeout after 10 seconds
    this.respondAfterProcessing = respondAfterProcessing ?? false

    // Use the caller-provided Express app, or create one
    this.app = app ?? express()
    this.path = path ?? '/'
  }

  public async start(agentContext: AgentContext) {
    const transportService = agentContext.dependencyManager.resolve(DidCommTransportService)

    agentContext.config.logger.debug('Starting HTTP inbound transport', {
      port: this.port,
    })

    this.registerRoute(agentContext, transportService)

    if (this.port === undefined) {
      return
    }

    const server = this.app.listen(this.port)
    this._server = server

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        server.off('listening', onListening)
        reject(error)
      }
      const onListening = () => {
        server.off('error', onError)
        resolve()
      }

      server.once('error', onError)
      server.once('listening', onListening)
    })
  }

  public async stop(): Promise<void> {
    if (!this._server) {
      return
    }

    return new Promise((resolve, reject) => this._server?.close((err) => (err ? reject(err) : resolve())))
  }

  private registerRoute(agentContext: AgentContext, transportService: DidCommTransportService) {
    const acceptedContentTypes = agentContext.dependencyManager.resolve(DidCommModuleConfig).isSupported('v2')
      ? [...supportedContentTypes, DIDCOMM_V2_ENCRYPTED_MIME_TYPE, DIDCOMM_V2_SIGNED_MIME_TYPE]
      : supportedContentTypes
    const isAccepted = (contentType: string | undefined): boolean =>
      contentType !== undefined && acceptedContentTypes.includes(normalizeDidCommMediaType(contentType))

    const parseBody = text({ type: (req) => isAccepted(req.headers['content-type']), limit: '5mb' })
    this.app.post(this.path, parseBody, async (req, res) => {
      if (!isAccepted(req.headers['content-type'])) {
        return res
          .status(415)
          .send(`Unsupported content-type. Supported content-types are: ${acceptedContentTypes.join(', ')}`)
      }

      const session = new HttpTransportSession(utils.uuid(), req, res, {
        respondAfterProcessing: this.respondAfterProcessing,
      })
      // We want to make sure the session is removed if the connection is closed, as it
      // can't be used anymore then. This could happen if the client abruptly closes the connection.
      req.once('close', () => transportService.removeSession(session))

      const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)
      let encryptedMessage: DidCommEncryptedMessage | undefined
      let processingError: Error | undefined
      const onProcessingFailed = (e: DidCommMessageProcessingFailedEvent) => {
        if (e.payload.message === encryptedMessage) processingError = e.payload.error
      }
      eventEmitter.on(DidCommEventTypes.DidCommMessageProcessingFailed, onProcessingFailed)

      try {
        const message = req.body as string
        encryptedMessage = JSON.parse(message) as DidCommEncryptedMessage

        const processing = eventEmitter.emit<DidCommMessageReceivedEvent>(agentContext, {
          type: DidCommEventTypes.DidCommMessageReceived,
          payload: {
            message: encryptedMessage,
            session: session,
          },
        })

        // Wait for message to be processed
        await firstValueFrom(
          from(processing).pipe(
            timeout({ first: this.processedMessageListenerTimeoutMs, meta: 'DidCommHttpInboundTransport.start' })
          )
        )
        if (processingError) throw processingError

        // If agent did not use session when processing message we need to send response here.
        // 202 Accepted, as no response travels back on this connection: https://identity.foundation/didcomm-messaging/spec/v2.1/#https
        if (!res.headersSent) {
          res.status(202).end()
        }
      } catch (error) {
        agentContext.config.logger.error(`Error processing inbound message: ${error.message}`, error)

        if (!res.headersSent) {
          res.status(500).send('Error processing message')
        }
      } finally {
        eventEmitter.off(DidCommEventTypes.DidCommMessageProcessingFailed, onProcessingFailed)
        transportService.removeSession(session)
      }
    })
  }
}

export class HttpTransportSession implements DidCommTransportSession {
  public id: string
  public readonly type = 'http'
  public req: Request
  public res: Response
  private respondAfterProcessing: boolean

  public constructor(id: string, req: Request, res: Response, options: { respondAfterProcessing?: boolean } = {}) {
    this.id = id
    this.req = req
    this.res = res
    this.respondAfterProcessing = options.respondAfterProcessing ?? false
  }

  public async close(): Promise<void> {
    // The route responds once processing is done
    if (this.respondAfterProcessing) return

    if (!this.res.headersSent) {
      this.res.status(202).end()
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
    const requestMimeType = this.req.headers['content-type']
    const normalized = requestMimeType ? normalizeDidCommMediaType(requestMimeType) : undefined
    if (isDidCommV2EncryptedMessage(encryptedMessage)) {
      responseMimeType = DIDCOMM_V2_ENCRYPTED_MIME_TYPE
    } else if (normalized && supportedContentTypes.includes(normalized)) {
      responseMimeType = normalized
    }

    this.res.status(200).contentType(responseMimeType).json(encryptedMessage).end()
  }
}
