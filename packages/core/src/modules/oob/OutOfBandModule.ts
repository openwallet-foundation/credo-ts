import type { ConnectionRecord } from '../../modules/connections'
import type { DidCommService } from '../connections/models/did/service/DidCommService'

import { Expose } from 'class-transformer'
import { Equals } from 'class-validator'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentMessage } from '../../agent/AgentMessage'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { ConnectionService, ConnectionInvitationMessage } from '../connections'
import { DiscoverFeaturesQueryMessage, DiscoverFeaturesService } from '../discover-features'
import { MediationRecipientService } from '../routing'

const VERSION = '1.1'

interface OutOfBandMessageOptions {
  id?: string
  label?: string
  goalCode?: string
  goal?: string
}

export class OutOfBandMessage extends AgentMessage {
  public constructor(options: OutOfBandMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.label = options.label
      this.goalCode = options.goalCode
      this.goal = options.goal
    }
  }

  @Equals(OutOfBandMessage.type)
  public readonly type = OutOfBandMessage.type
  public static readonly type = `https://didcomm.org/out-of-band/${VERSION}/invitation`

  public readonly label?: string

  @Expose({ name: 'goal_code' })
  public readonly goalCode?: string

  public readonly goal?: string

  // TODO what type is it, is there any enum or should we create a new one
  public readonly accept: string[] = []

  // TODO what type is it, should we create an enum
  @Expose({ name: 'handshake_protocols' })
  public readonly handshakeProtocols: string[] = []

  public readonly services: DidCommService[] = []
}

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandModule {
  private connectionService: ConnectionService
  private mediationRecipientService: MediationRecipientService
  private disoverFeaturesService: DiscoverFeaturesService
  private messageSender: MessageSender

  public constructor(
    connectionService: ConnectionService,
    mediationRecipientService: MediationRecipientService,
    disoverFeaturesService: DiscoverFeaturesService,
    messageSender: MessageSender
  ) {
    this.connectionService = connectionService
    this.mediationRecipientService = mediationRecipientService
    this.disoverFeaturesService = disoverFeaturesService
    this.messageSender = messageSender
  }

  public async createInvitation(): Promise<{ outOfBandMessage: OutOfBandMessage; connectionRecord: ConnectionRecord }> {
    // Discover what handshake protocols are supported by calling discover service.
    // Other option could be that connection service would say what protocols it supports.
    // However, that would expanded service responsibility.

    const queryMessage = new DiscoverFeaturesQueryMessage({
      query: `*`,
    })
    const featuresMessage = await this.disoverFeaturesService.createDisclose(queryMessage)
    const { protocols } = featuresMessage

    const handshakeProtocols = ['https://didcomm.org/didexchange', 'https://didcomm.org/connections']

    const supportedHandshakeProtocols = protocols
      .map((p) => p.protocolId.slice(0, -1))
      .filter((pId) => handshakeProtocols.find((hp) => pId.startsWith(hp)))

    // Create connection
    // It's a question if we need to create connection here. We could create just OutOfBand record.
    // The OOB record can be also used for connection-less communication in general.
    // Either way, we need to get routing
    const mediationRecord = await this.mediationRecipientService.discoverMediation()
    const routing = await this.mediationRecipientService.getRouting(mediationRecord)
    const { connectionRecord: connectionRecord, message: invitation } = await this.connectionService.createInvitation({
      routing,
    })

    const outOfBandMessage = new OutOfBandMessage({
      goal: 'To issue a Faber College Graduate credential',
      goalCode: 'issue-vc',
      label: 'Faber College',
    })

    outOfBandMessage.accept.push('didcomm/aip2;env=rfc587')
    outOfBandMessage.accept.push('didcomm/aip2;env=rfc19')

    connectionRecord.didDoc.didCommServices.forEach((s) => outOfBandMessage.services.push(s))
    supportedHandshakeProtocols.forEach((p) => outOfBandMessage.handshakeProtocols.push(p))

    return { outOfBandMessage, connectionRecord }
  }

  public async receiveInvitation(outOfBandMessage: OutOfBandMessage) {
    const mediationRecord = await this.mediationRecipientService.discoverMediation()
    const routing = await this.mediationRecipientService.getRouting(mediationRecord)
    const invitation = new ConnectionInvitationMessage({ label: 'connection label', ...outOfBandMessage.services[0] })
    const connectionRecord = await this.connectionService.processInvitation(invitation, { routing })
    // connectionRecord = await this.acceptInvitation(connectionRecord.id)
    return connectionRecord
  }

  // TODO This is copy-pasted from ConnectionModule because we can't call module from other module
  public async acceptInvitation(connectionId: string): Promise<ConnectionRecord> {
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createRequest(connectionId)
    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)
    return connectionRecord
  }
}
