import type { EventEmitter } from '../../../../agent/EventEmitter'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { PresentationPreview } from '../../PresentationPreview'
import type { ProofStateChangedEvent } from '../../ProofEvents'
import type { ProofRecord, ProofRepository } from '../../repository'
import type { ProposeProofOptions, V2ProposeProofFormat } from '../interface'
import type { V2ProofFormatSpec } from './V2ProofFormat'

import { uuid } from '../../../../utils/uuid'
import { ProofEventTypes } from '../../ProofEvents'

export interface V2AttachmentFormats {
  preview?: PresentationPreview
  formats: V2ProofFormatSpec
  filtersAttach: Attachment[]
}

export abstract class ProofFormatService {
  private proofRepository: ProofRepository
  private eventEmitter: EventEmitter

  public constructor(proofRepository: ProofRepository, eventEmitter: EventEmitter) {
    this.proofRepository = proofRepository
    this.eventEmitter = eventEmitter
  }
  abstract getProofProposeAttachFormats(proposal: ProposeProofOptions, messageType: string): V2AttachmentFormats
  // abstract getFormatIdentifier(messageType: string): V2CredentialFormatSpec
  abstract getFormatData(data: V2ProposeProofFormat): Attachment[]
  abstract save(proposal: ProposeProofOptions, credentialRecord: ProofRecord): Promise<void>

  // other message formats here...eg issue, request formats etc.

  public generateId(): string {
    return uuid()
  }

  public getType(): string {
    return this.constructor.name
  }

  public async emitEvent(proofRecord: ProofRecord) {
    await this.proofRepository.save(proofRecord)
    this.eventEmitter.emit<ProofStateChangedEvent>({
      type: ProofEventTypes.ProofStateChanged,
      payload: {
        proofRecord,
        previousState: null,
      },
    })
  }
}
