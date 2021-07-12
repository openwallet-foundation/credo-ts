import type { InboundTransporter, Agent, OutboundPackage } from '../../src'
import type { TransportSession } from '../../src/agent/TransportService'
import type { Express, Request, Response } from 'express'
import type { Server } from 'http'

import { AriesFrameworkError } from '../../src'
import testLogger from '../../src/__tests__/logger'
import { AgentConfig } from '../../src/agent/AgentConfig'
import { TransportService } from '../../src/agent/TransportService'
import { uuid } from '../../src/utils/uuid'

const logger = testLogger

export class HttpInboundTransporter implements InboundTransporter {
  private app: Express
  private server?: Server
  private path: string

  public constructor(app: Express, path: string) {
    this.app = app
    this.path = path
  }

  public async start(agent: Agent) {
    const transportService = agent.injectionContainer.resolve(TransportService)
    const config = agent.injectionContainer.resolve(AgentConfig)
    this.server = this.app.listen(config.port)

    this.app.post(this.path, async (req, res) => {
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
        logger.error(`Error processing inbound message: ${error.message}`, error)
        res.status(500).send('Error processing message')
      } finally {
        transportService.removeSession(session)
      }
    })
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
    logger.debug(`Sending outbound message via ${this.type} transport session`)

    if (this.res.headersSent) {
      throw new AriesFrameworkError(`${this.type} transport session has been closed.`)
    }

    this.res.status(200).json(outboundMessage.payload).end()
  }
}
