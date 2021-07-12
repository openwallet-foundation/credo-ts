import type { InboundTransporter, Agent, OutboundPackage } from '../../src'
import type { TransportSession } from '../../src/agent/TransportService'
import type { Express, Request, Response } from 'express'
import type { Server } from 'http'

import express from 'express'
import { URL } from 'url'

import { DidCommMimeType, AriesFrameworkError } from '../../src'
import { AgentConfig } from '../../src/agent/AgentConfig'
import { TransportService } from '../../src/agent/TransportService'
import { uuid } from '../../src/utils/uuid'

export class HttpInboundTransporter implements InboundTransporter {
  public readonly app: Express
  private server?: Server

  public constructor() {
    // Create Express App
    this.app = express()

    this.app.use(
      express.text({
        type: [DidCommMimeType.V0, DidCommMimeType.V1],
        limit: '5mb',
      })
    )
  }

  public async start(agent: Agent) {
    const transportService = agent.injectionContainer.resolve(TransportService)
    const config = agent.injectionContainer.resolve(AgentConfig)

    const url = new URL(config.getEndpoint())

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new AriesFrameworkError('Cannot start http inbound transport without HTTP endpoint')
    }

    const path = url.pathname
    const port = url.port

    config.logger.debug(`Starting HTTP inbound transporter`, {
      path,
      port,
      endpoint: config.getEndpoint(),
    })

    this.app.post(path, async (req, res) => {
      const session = new HttpTransportSession(uuid(), req, res)
      try {
        const message = req.body
        const packedMessage = JSON.parse(message)
        await agent.receiveMessage(packedMessage, session)

        // If agent did not use session when processing message we need to send response here.
        if (!res.headersSent) {
          res.status(200).end()
        }
      } catch (error) {
        config.logger.error(`Error processing inbound message: ${error.message}`, error)
        res.status(500).send('Error processing message')
      } finally {
        transportService.removeSession(session)
      }
    })

    this.server = this.app.listen(port)
  }

  public async stop(): Promise<void> {
    this.server?.close()
  }
}

export class HttpTransportSession implements TransportSession {
  public id: string
  public readonly type = 'http'
  public req: Request
  public res: Response

  public constructor(id: string, req: Request, res: Response) {
    this.id = id
    this.req = req
    this.res = res
  }

  public async send(outboundMessage: OutboundPackage): Promise<void> {
    if (this.res.headersSent) {
      throw new AriesFrameworkError(`${this.type} transport session has been closed.`)
    }

    this.res.status(200).json(outboundMessage.payload).end()
  }
}
