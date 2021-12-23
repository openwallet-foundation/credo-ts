import { V2CredentialFormatSpec } from '../formats/V2CredentialFormat'
import { Attachment } from '../../../../decorators/attachment/Attachment'
import { ProposeCredentialOptions } from '../interfaces'
import { uuid } from '../../../../utils/uuid'
import { CredentialPreview } from '../../CredentialPreview'
import { CredentialRecord, CredentialRepository } from '../../repository'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { CredentialEventTypes, CredentialStateChangedEvent } from '../../CredentialEvents'
import { LinkedAttachment } from '../../../../utils/LinkedAttachment'
import { CredentialPreviewAttribute } from '../../CredentialPreviewV2'


export interface AttachmentFormats {
    preview?: CredentialPreview
    formats: V2CredentialFormatSpec,
    filtersAttach: Attachment
}

export abstract class CredentialFormatService {

    private credentialRepository: CredentialRepository
    private eventEmitter: EventEmitter

    public constructor(
        credentialRepository: CredentialRepository,
        eventEmitter: EventEmitter
    ) {
        this.credentialRepository = credentialRepository
        this.eventEmitter = eventEmitter
    }
    abstract getCredentialProposeAttachFormats(proposal: ProposeCredentialOptions, messageType: string): AttachmentFormats
    abstract getFormatIdentifier(messageType: string): V2CredentialFormatSpec
    abstract getFormatData(messageType: string, data: ProposeCredentialOptions): Attachment
    abstract setMetaDataAndEmitEvent(proposal: ProposeCredentialOptions, credentialRecord: CredentialRecord): Promise<void>
    abstract getCredentialLinkedAttachments(proposal: ProposeCredentialOptions) : LinkedAttachment[] | undefined
    abstract getCredentialAttributes(proposal: ProposeCredentialOptions): CredentialPreviewAttribute[] | undefined 
    abstract getCredentialDefinitionId(proposal: ProposeCredentialOptions): string | undefined

    // other message formats here...eg issue, request formats etc.


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

