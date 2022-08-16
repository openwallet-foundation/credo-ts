import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { Transports } from '../../routing'
import type { OutOfBandEvent } from '../OutOfBandEvents'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageSender } from '../../../agent/MessageSender'
import { SendingMessageType } from '../../../agent/didcomm/types'
import { AriesFrameworkError } from '../../../error'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { DidService } from '../../dids'
import { ValueTransferGetterService } from '../../value-transfer/services/ValueTransferGetterService'
import { ValueTransferGiverService } from '../../value-transfer/services/ValueTransferGiverService'
import { WellKnownService } from '../../well-known'
import { OutOfBandEventTypes } from '../OutOfBandEvents'
import {
  AndroidNearbyHandshakeAttachment,
  PaymentOfferAttachment,
  OutOfBandGoalCode,
  OutOfBandInvitationMessage,
} from '../messages'

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandService {
  private agentConfig: AgentConfig
  private didService: DidService
  private wellKnownService: WellKnownService
  private eventEmitter: EventEmitter
  private valueTransferGetterService: ValueTransferGetterService
  private valueTransferGiverService: ValueTransferGiverService
  private messageSender: MessageSender

  public constructor(
    agentConfig: AgentConfig,
    didService: DidService,
    wellKnownService: WellKnownService,
    eventEmitter: EventEmitter,
    valueTransferGetterService: ValueTransferGetterService,
    valueTransferGiverService: ValueTransferGiverService,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig
    this.didService = didService
    this.wellKnownService = wellKnownService
    this.eventEmitter = eventEmitter
    this.valueTransferGetterService = valueTransferGetterService
    this.valueTransferGiverService = valueTransferGiverService
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

    if (goalCode === OutOfBandGoalCode.PaymentOffer) {
      if (!attachments || !attachments.length) {
        throw new AriesFrameworkError(`Attachment must be passed for 'OfferPayment' goal code`)
      }
      const messageAttachments = []

      const offerAttachment = JsonTransformer.fromJSON(attachments[0], PaymentOfferAttachment)
      messageAttachments.push(OutOfBandInvitationMessage.createPaymentOfferJSONAttachment(offerAttachment))

      if (attachments[1]) {
        const handshakeAttachment = JsonTransformer.fromJSON(attachments[1], AndroidNearbyHandshakeAttachment)
        messageAttachments.push(
          OutOfBandInvitationMessage.createAndroidNearbyHandshakeJSONAttachment(handshakeAttachment)
        )
      }

      return new OutOfBandInvitationMessage({
        from: did.did,
        to,
        body,
        attachments: messageAttachments,
      })
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
    if (message.body.goalCode === OutOfBandGoalCode.DidExchange) {
      const didInfo = await this.wellKnownService.resolve(message.from)
      if (!didInfo) {
        throw new AriesFrameworkError(`Unable to resolve info for the DID: ${message.from}`)
      }
      await this.didService.storeRemoteDid(didInfo)
    }
  }

  public async receiveOutOfBandInvitation(message: OutOfBandInvitationMessage) {
    const senderInfo = await this.wellKnownService.resolve(message.from)
    if (!senderInfo) {
      throw new AriesFrameworkError(`Unable to resolve info for the DID: ${message.from}`)
    }
    this.eventEmitter.emit<OutOfBandEvent>({
      type: OutOfBandEventTypes.OutOfBandInvitationReceived,
      payload: {
        message,
        senderInfo,
      },
    })
  }

  public async sendMessage(message: DIDCommV2Message, transport?: Transports) {
    this.agentConfig.logger.info(`Sending VTP message with type '${message.type}' to DID ${message?.to}`)
    const sendingMessageType = message.to ? SendingMessageType.Encrypted : SendingMessageType.Signed
    await this.messageSender.sendDIDCommV2Message(message, sendingMessageType, transport)
  }
}
