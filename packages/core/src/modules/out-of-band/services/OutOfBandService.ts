import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { Transports } from '../../routing'
import type { OutOfBandEvent } from '../OutOfBandEvents'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageSender } from '../../../agent/MessageSender'
import { SendingMessageType } from '../../../agent/didcomm/types'
import { AriesFrameworkError } from '../../../error'
import { injectable } from '../../../plugins'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { TellDidService, TellDidState } from '../../connections'
import { DidService } from '../../dids'
import { DidResolverService } from '../../dids/services/DidResolverService'
import { ValueTransferGetterService } from '../../value-transfer/services/ValueTransferGetterService'
import { ValueTransferGiverService } from '../../value-transfer/services/ValueTransferGiverService'
import { OutOfBandEventTypes } from '../OutOfBandEvents'
import { AndroidNearbyHandshakeAttachment, OutOfBandGoalCode, OutOfBandInvitationMessage } from '../messages'

@injectable()
export class OutOfBandService {
  private agentConfig: AgentConfig
  private didService: DidService
  private didResolverService: DidResolverService
  private eventEmitter: EventEmitter
  private valueTransferGetterService: ValueTransferGetterService
  private valueTransferGiverService: ValueTransferGiverService
  private tellDidService: TellDidService
  private messageSender: MessageSender

  public constructor(
    agentConfig: AgentConfig,
    didService: DidService,
    didResolverService: DidResolverService,
    eventEmitter: EventEmitter,
    valueTransferGetterService: ValueTransferGetterService,
    valueTransferGiverService: ValueTransferGiverService,
    tellDidService: TellDidService,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig
    this.didService = didService
    this.didResolverService = didResolverService
    this.eventEmitter = eventEmitter
    this.valueTransferGetterService = valueTransferGetterService
    this.valueTransferGiverService = valueTransferGiverService
    this.tellDidService = tellDidService
    this.messageSender = messageSender
  }

  public async createOutOfBandInvitation({
    to,
    goal,
    goalCode,
    attachments,
    usePublicDid,
  }: {
    to?: string
    goalCode: string
    goal?: string
    attachments?: Record<string, unknown>[]
    usePublicDid?: boolean
  }) {
    const did = await this.didService.getPublicDidOrCreateNew(usePublicDid)
    const body = {
      goal,
      goalCode,
    }

    if (goalCode === OutOfBandGoalCode.AndroidNearbyHandshake) {
      if (!attachments || !attachments.length) {
        throw new AriesFrameworkError(`Attachment must be passed for 'AndroidNearbyHandshake' goal code`)
      }
      const handshakeAttachment = JsonTransformer.fromJSON(attachments[0], AndroidNearbyHandshakeAttachment)
      const message = new OutOfBandInvitationMessage({
        from: did.did,
        to,
        body,
        attachments: [OutOfBandInvitationMessage.createAndroidNearbyHandshakeJSONAttachment(handshakeAttachment)],
      })
      return message
    }

    return new OutOfBandInvitationMessage({
      from: did.did,
      body,
      to,
      attachments: attachments?.map((attachment) =>
        OutOfBandInvitationMessage.createOutOfBandJSONAttachment(attachment)
      ),
    })
  }

  public async acceptOutOfBandInvitation(message: OutOfBandInvitationMessage) {
    const { goalCode, goal } = message.body

    if (goalCode === OutOfBandGoalCode.DidExchange || goalCode === OutOfBandGoalCode.TellDid) {
      const did = await this.didResolverService.resolve(message.from)

      if (!did || !did.didDocument) {
        throw new AriesFrameworkError(`Unable to resolve info for the DID: ${message.from}`)
      }

      if (goalCode === OutOfBandGoalCode.TellDid) {
        const tellDidMessage = await this.tellDidService.sendTellDidMessage(did.didDocument.id, message.id)
        const completionEvent = await this.tellDidService.awaitTellDidCompleted(tellDidMessage.id, 60000)
        if (completionEvent.payload.state === TellDidState.Declined) return
      }

      await this.didService.storeRemoteDid({
        did: did.didDocument.id,
        label: did.didMeta?.label ?? goal,
        logoUrl: did.didMeta?.logoUrl,
      })
    }
  }

  public async receiveOutOfBandInvitation(message: OutOfBandInvitationMessage) {
    const senderInfo = await this.didService.getDidInfo(message.from)
    this.eventEmitter.emit<OutOfBandEvent>({
      type: OutOfBandEventTypes.OutOfBandInvitationReceived,
      payload: {
        message,
        senderInfo,
      },
    })
  }

  public async sendMessage(message: DIDCommV2Message, transport?: Transports) {
    this.agentConfig.logger.info(`Sending oob message with type '${message.type}' to DID ${message?.to}`)
    const sendingMessageType = message.to ? SendingMessageType.Encrypted : SendingMessageType.Signed
    const transports = transport ? [transport] : undefined
    await this.messageSender.sendDIDCommV2Message(message, sendingMessageType, transports)
  }
}
