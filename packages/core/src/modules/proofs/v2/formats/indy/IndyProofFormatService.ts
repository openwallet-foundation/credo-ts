import type { ProofRecord, ProofRepository } from '../../..'
import type { EventEmitter } from '../../../../../agent/EventEmitter'
import type { ProposeProofOptions, V2ProposeProofFormat } from '../../interface'
import type { V2AttachmentFormats } from '../ProofFormatService'
import type { V2ProofFormatSpec } from '../V2ProofFormat'

import { Attachment, AttachmentData } from '../../../../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../../../../utils/JsonEncoder'
import { PresentationPreview } from '../../../PresentationPreview'
import { ProofFormatService } from '../ProofFormatService'
import { ATTACHMENT_FORMAT } from '../V2ProofFormat'

export class IndyProofFormatService extends ProofFormatService {
  protected proofRepository: ProofRepository

  public constructor(proofRepository: ProofRepository, eventEmitter: EventEmitter) {
    super(proofRepository, eventEmitter)
    this.proofRepository = proofRepository
  }

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param proposal The object containing all the options for the proposed credential
   * @param messageType the type of message which can be Indy, JsonLd etc eg "CRED_20_PROPOSAL"
   * @returns object containing associated attachment and formats elements
   *
   */
  public getProofProposeAttachFormats(proposal: ProposeProofOptions, messageType: string): V2AttachmentFormats {
    let preview: PresentationPreview

    if (proposal?.proofFormats?.indy?.attributes) {
      preview = new PresentationPreview({
        attributes: proposal?.proofFormats.indy?.attributes,
        predicates: proposal?.proofFormats.indy?.predicates,
      })
    } else {
      preview = new PresentationPreview({ attributes: [], predicates: [] })
    }

    const formats: V2ProofFormatSpec = this.getFormatIdentifier(messageType)
    const filtersAttach: Attachment[] = this.getFormatData(proposal.proofFormats)

    return { preview, formats, filtersAttach }
  }

  /**
   * Save the meta data and emit event
   */
  public async setMetaDataAndEmitEventForProposal(
    proposal: V2ProposeProofFormat,
    proofRecord: ProofRecord
  ): Promise<void> {
    console.log('IndyProofFormat [metdata] proofRecord:', proofRecord)
    await this.proofRepository.save(proofRecord)
    return await super.emitEvent(proofRecord)
  }

  /**
   * Get attachment format identifier for format and message combination
   *
   * @param messageType Message type for which to return the format identifier
   * @return V2CredentialFormatSpec - Issue credential attachment format identifier
   */
  public getFormatIdentifier(messageType: string): V2ProofFormatSpec {
    return ATTACHMENT_FORMAT[messageType].indy
  }

  public getFormatData(data: V2ProposeProofFormat): Attachment[] {
    const offersAttach: Attachment[] = []

    offersAttach.push(
      new Attachment({
        id: 'indy',
        mimeType: 'application/json',
        data: new AttachmentData({
          base64: JsonEncoder.toBase64(data.indy),
        }),
      })
    )

    return offersAttach
  }
}
