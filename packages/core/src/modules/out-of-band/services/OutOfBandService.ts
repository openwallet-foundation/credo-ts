import type { OutOfBandEvent } from '../OutOfBandEvents'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { DidService } from '../../dids'
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

  public constructor(
    agentConfig: AgentConfig,
    didService: DidService,
    wellKnownService: WellKnownService,
    eventEmitter: EventEmitter
  ) {
    this.agentConfig = agentConfig
    this.didService = didService
    this.wellKnownService = wellKnownService
    this.eventEmitter = eventEmitter
  }

  public async createOutOfBandInvitation({
    goal,
    goalCode,
    attachment,
    usePublicDid,
  }: {
    goalCode: string
    goal?: string
    attachment?: Record<string, unknown>
    usePublicDid?: boolean
  }) {
    const did = await this.didService.getPublicDidOrCreateNew(usePublicDid)
    let attachmentObject: AndroidNearbyHandshakeAttachment | PaymentOfferAttachment | undefined = undefined

    if (goalCode === OutOfBandGoalCode.AndroidNearbyHandshake) {
      if (!attachment) {
        throw new AriesFrameworkError(`Attachment must be passed for 'AndroidNearbyHandshake' goal code`)
      }
      attachmentObject = JsonTransformer.fromJSON(attachment, AndroidNearbyHandshakeAttachment)
    }
    if (goalCode === OutOfBandGoalCode.PaymentOffer) {
      if (!attachment) {
        throw new AriesFrameworkError(`Attachment must be passed for 'OfferPayment' goal code`)
      }
      attachmentObject = JsonTransformer.fromJSON(attachment, PaymentOfferAttachment)
    }

    return new OutOfBandInvitationMessage({
      from: did.did,
      body: {
        goal,
        goal_code: goalCode,
      },
      attachments: attachmentObject
        ? [OutOfBandInvitationMessage.createOutOfBandJSONAttachment(attachmentObject)]
        : undefined,
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
    this.eventEmitter.emit<OutOfBandEvent>({
      type: OutOfBandEventTypes.OutOfBandInvitationReceived,
      payload: { message },
    })
  }
}
