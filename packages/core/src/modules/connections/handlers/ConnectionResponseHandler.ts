import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { OutOfBandService } from '../../oob/OutOfBandService'
import type { ConnectionService } from '../services/ConnectionService'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error'
import { ConnectionResponseMessage } from '../messages'

export class ConnectionResponseHandler implements Handler {
  private connectionService: ConnectionService
  private outOfBandService: OutOfBandService

  private agentConfig: AgentConfig
  public supportedMessages = [ConnectionResponseMessage]

  public constructor(
    connectionService: ConnectionService,
    outOfBandService: OutOfBandService,
    agentConfig: AgentConfig
  ) {
    this.connectionService = connectionService
    this.outOfBandService = outOfBandService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<ConnectionResponseHandler>) {
    if (!messageContext.recipientVerkey || !messageContext.senderVerkey) {
      throw new AriesFrameworkError('Unable to process connection request without senderVerkey or recipientVerkey')
    }

    const connectionRecord = await this.connectionService.findByVerkey(messageContext.recipientVerkey)
    if (!connectionRecord) {
      throw new AriesFrameworkError(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    const outOfBandRecord =
      connectionRecord.outOfBandId && (await this.outOfBandService.findById(connectionRecord.outOfBandId))

    if (!outOfBandRecord) {
      throw new AriesFrameworkError(`Out-of-band record ${connectionRecord.outOfBandId} was not found.`)
    }

    // The presence of outOfBandRecord is not mandatory when the old connection invitation is used
    const connection = await this.connectionService.processResponse(messageContext, outOfBandRecord)

    // TODO: should we only send ping message in case of autoAcceptConnection or always?
    // In AATH we have a separate step to send the ping. So for now we'll only do it
    // if auto accept is enable
    if (connection.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      const { message } = await this.connectionService.createTrustPing(connection, { responseRequested: false })
      return createOutboundMessage(connection, message)
    }
  }
}
