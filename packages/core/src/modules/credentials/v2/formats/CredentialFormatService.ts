import type { EventEmitter } from '../../../../agent/EventEmitter'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { CredentialStateChangedEvent } from '../../CredentialEvents'
import type { CredentialPreviewAttribute } from '../../CredentialPreviewAttributes'
import type { CredentialRecord, CredentialRepository } from '../../repository'
import type { V1CredentialPreview } from '../../v1/V1CredentialPreview'
import type { V2CredentialPreview } from '../V2CredentialPreview'
import type { V2CredentialFormatSpec } from '../formats/V2CredentialFormat'
import type {
  AcceptProposalOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
  V2CredDefinitionFormat,
  V2CredOfferFormat,
  V2CredProposalFormat,
  V2CredRequestFormat,
} from '../interfaces'
import type { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'
import type { V2RequestCredentialMessage } from '../messages/V2RequestCredentialMessage'

import { uuid } from '../../../../utils/uuid'
import { CredentialEventTypes } from '../../CredentialEvents'

export interface V2AttachmentFormats {
  preview?: V2CredentialPreview
  formats: V2CredentialFormatSpec
  filtersAttach?: Attachment[]
  offersAttach?: Attachment[]
  requestAttach?: Attachment[]
}

export abstract class CredentialFormatService {
  protected credentialRepository: CredentialRepository
  private eventEmitter: EventEmitter

  public constructor(credentialRepository: CredentialRepository, eventEmitter: EventEmitter) {
    this.credentialRepository = credentialRepository
    this.eventEmitter = eventEmitter
  }

  abstract getCredentialProposeAttachFormats(
    proposal: ProposeCredentialOptions,
    messageType: string
  ): V2AttachmentFormats
  abstract getFormatIdentifier(messageType: string): V2CredentialFormatSpec
  abstract getFormatData(data: unknown): Attachment[]
  abstract setMetaDataAndEmitEventForProposal(
    proposal: V2CredProposalFormat,
    credentialRecord: CredentialRecord
  ): Promise<void>
  abstract setMetaDataForOffer(offer: V2CredOfferFormat, credentialRecord: CredentialRecord): void
  abstract setMetaDataForRequest(request: V2CredRequestFormat, credentialRecord: CredentialRecord): void

  abstract getCredentialLinkedAttachments(proposal: ProposeCredentialOptions): {
    attachments: Attachment[] | undefined
    previewWithAttachments: V2CredentialPreview
  }
  abstract getCredentialAttributes(proposal: ProposeCredentialOptions): CredentialPreviewAttribute[] | undefined
  abstract getCredentialDefinitionId(proposal: ProposeCredentialOptions): string | undefined
  abstract setPreview(proposal: AcceptProposalOptions, preview: V1CredentialPreview): AcceptProposalOptions

  // other message formats here...eg issue, request formats etc.
  abstract createCredentialOffer(proposal: AcceptProposalOptions): Promise<V2CredOfferFormat>
  abstract getCredentialOfferAttachFormats(
    proposal: AcceptProposalOptions,
    offer: V2CredOfferFormat,
    messageType: string
  ): V2AttachmentFormats
  abstract getCredentialOfferMessage(credentialOfferMessage: V2OfferCredentialMessage): V2CredOfferFormat
  abstract getCredentialOffer(record: CredentialRecord): V2CredOfferFormat | undefined
  abstract getCredentialDefinition(offer: V2CredOfferFormat): Promise<V2CredDefinitionFormat | undefined>

  abstract createCredentialRequest(options: RequestCredentialOptions): Promise<V2CredRequestFormat>
  abstract getCredentialRequest(message: V2RequestCredentialMessage): V2CredRequestFormat | undefined

  abstract getCredentialRequestAttachFormats(request: V2CredRequestFormat, messageType: string): V2AttachmentFormats

  public generateId(): string {
    return uuid()
  }

  public getType(): string {
    return this.constructor.name
  }

  protected async emitEvent(credentialRecord: CredentialRecord) {
    this.eventEmitter.emit<CredentialStateChangedEvent>({
      type: CredentialEventTypes.CredentialStateChanged,
      payload: {
        credentialRecord,
        previousState: null,
      },
    })
  }
}
