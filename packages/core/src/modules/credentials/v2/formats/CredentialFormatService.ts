import { V2CredentialFormatSpec } from '../formats/V2CredentialFormat'
import { Attachment } from '../../../../decorators/attachment/Attachment'
import { AcceptProposalOptions, ProposeCredentialOptions, V2CredOfferFormat, V2CredProposalFormat } from '../interfaces'
import { uuid } from '../../../../utils/uuid'
import { V1CredentialPreview } from '../../v1/V1CredentialPreview'
import { CredentialRecord, CredentialRepository } from '../../repository'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { CredentialEventTypes, CredentialStateChangedEvent } from '../../CredentialEvents'
import { CredentialPreviewAttribute } from '../../v1/V1CredentialPreview'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'
import { V2CredentialPreview } from '../V2CredentialPreview'


export interface V2AttachmentFormats {
    preview?: V2CredentialPreview
    formats: V2CredentialFormatSpec,
    filtersAttach?: Attachment[]
    offersAttach?: Attachment[]

}



export abstract class CredentialFormatService {
    protected credentialRepository: CredentialRepository
    private eventEmitter: EventEmitter

    public constructor(
        credentialRepository: CredentialRepository,
        eventEmitter: EventEmitter
    ) {
        this.credentialRepository = credentialRepository
        this.eventEmitter = eventEmitter
    }

    abstract getCredentialProposeAttachFormats(proposal: ProposeCredentialOptions, messageType: string): V2AttachmentFormats
    abstract getFormatIdentifier(messageType: string): V2CredentialFormatSpec
    abstract getFormatData(data: V2CredProposalFormat | V2CredOfferFormat): Attachment[]
    abstract setMetaDataAndEmitEventForProposal(proposal: V2CredProposalFormat, credentialRecord: CredentialRecord): Promise<void>
    abstract setMetaDataForOffer(offer: V2CredOfferFormat, credentialRecord: CredentialRecord): void

    abstract getCredentialLinkedAttachments(proposal: ProposeCredentialOptions): { attachments: Attachment[] | undefined, previewWithAttachments: V1CredentialPreview } 
    abstract getCredentialAttributes(proposal: ProposeCredentialOptions): CredentialPreviewAttribute[] | undefined
    abstract getCredentialDefinitionId(proposal: ProposeCredentialOptions): string | undefined
    abstract setPreview(proposal: AcceptProposalOptions, preview: V1CredentialPreview): AcceptProposalOptions 

    // other message formats here...eg issue, request formats etc.
    abstract createCredentialOffer(proposal: AcceptProposalOptions): Promise<V2CredOfferFormat>
    abstract getCredentialOfferAttachFormats(proposal: AcceptProposalOptions, messageType: string): V2AttachmentFormats
    abstract getCredentialOfferMessage(credentialOfferMessage: V2OfferCredentialMessage): V2CredOfferFormat

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

