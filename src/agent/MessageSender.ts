import type { ConnectionRecord, DidCommService } from '../modules/connections'
import type { OutboundTransporter } from '../transport/OutboundTransporter'
import type { OutboundMessage, OutboundPackage } from '../types'
import type { AgentMessage } from './AgentMessage'
import type { EnvelopeKeys } from './EnvelopeService'
import type { TransportSession } from './TransportService'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { InjectionSymbols } from '../constants'
import { AriesFrameworkError } from '../error'
import { Logger } from '../logger'

import { EnvelopeService } from './EnvelopeService'
import { TransportService } from './TransportService'

@scoped(Lifecycle.ContainerScoped)
export class MessageSender {
  private envelopeService: EnvelopeService
  private transportService: TransportService
  private logger: Logger
  private _outboundTransporter?: OutboundTransporter

  public constructor(
    envelopeService: EnvelopeService,
    transportService: TransportService,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.envelopeService = envelopeService
    this.transportService = transportService
    this.logger = logger
  }

  public setOutboundTransporter(outboundTransporter: OutboundTransporter) {
    this._outboundTransporter = outboundTransporter
  }

  public get outboundTransporter() {
    return this._outboundTransporter
  }

  public async packMessage(message: AgentMessage, keys: EnvelopeKeys): Promise<JsonWebKey> {
    return this.envelopeService.packMessage(message, keys)
  }

  public async sendMessage(outboundMessage: OutboundMessage): Promise<void> {
    const { connection, payload } = outboundMessage
    const { id, verkey, theirKey } = connection

    this.logger.debug(`Sending outbound message to connection '${connection.id}'`, {
      messageId: payload.id,
      connection: { id, verkey, theirKey },
    })

    const services = this.transportService.findDidCommServices(connection)
    if (services.length === 0) {
      throw new AriesFrameworkError(`Connection with id ${connection.id} has no service!`)
    }

    const session = this.transportService.findSession(connection.id)

    for await (const service of services) {
      const success = await this.sendMessageToService({
        message: payload,
        senderKey: connection.verkey,
        service,
        session,
        connection,
      })

      if (success) break
    }
  }

  public async sendMessageToService({
    message,
    service,
    senderKey,
    session,
    connection,
  }: {
    message: AgentMessage
    service: DidCommService
    senderKey: string
    session?: TransportSession
    connection?: ConnectionRecord
  }): Promise<boolean> {
    if (!this.outboundTransporter) {
      throw new AriesFrameworkError('Agent has no outbound transporter!')
    }

    this.logger.debug(`Sending outbound message to service:`, { messageId: message.id, service })
    try {
      const keys = {
        recipientKeys: service.recipientKeys,
        routingKeys: service.routingKeys || [],
        senderKey,
      }

      const packedMessage = await this.packMessage(message, keys)
      const outboundPackage: OutboundPackage = {
        connection,
        payload: packedMessage,
        endpoint: service.serviceEndpoint,
        responseRequested: message.hasReturnRouting(),
        session,
      }

      await this.outboundTransporter.sendMessage(outboundPackage)
      return true
    } catch (error) {
      this.logger.debug(`Sending outbound message to service with id ${service.id} failed with the following error:`, {
        message: error.message,
        error: error,
      })
      return false
    }
  }
}
