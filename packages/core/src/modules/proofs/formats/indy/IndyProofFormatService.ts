import type { ProofAttributeInfo, ProofRequest, RequestedCredentials } from '../..'
import type { CredentialRepository } from '../../../credentials'
import type { CreateProposalOptions } from '../../models/ServiceOptions'
import type {
  CreatePresentationOptions,
  CreateRequestOptions,
  ProcessProposalOptions,
  ProofAttachmentFormat,
  ProofFormatSpec,
} from '../ProofFormatService'

import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../../../utils/JsonEncoder'
import { ProofFormatService } from '../ProofFormatService'
import { ATTACHMENT_FORMAT } from '../ProofFormats'

export class IndyProofFormatService extends ProofFormatService {
  private credentialRepository: CredentialRepository

  public constructor(credentialRepository: CredentialRepository) {
    super()
    this.credentialRepository = credentialRepository
  }

  public createProposal(options: CreateProposalOptions): ProofAttachmentFormat {
    // Handle format in service
    throw new Error('Method not implemented.')
  }

  public processProposal(options: ProcessProposalOptions): void {
    throw new Error('Method not implemented.')
  }

  public createRequest(options: CreateRequestOptions): ProofAttachmentFormat {
    const format: ProofFormatSpec = this.getFormatIdentifier(options.messageType)

    const { attachId, proofRequest } = options
    const attachment = new Attachment({
      id: attachId ? attachId : undefined,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(proofRequest),
      }),
    })
    return { format, attachment }
  }

  public processRequest(options: ProcessRequestOptions): void {
    throw new Error('Method not implemented.')
  }

  public createPresentation(options: CreatePresentationOptions): ProofAttachmentFormat {
    const format: ProofFormatSpec = this.getFormatIdentifier(options.messageType)

    const { attachId, attachData } = options
    const attachment = new Attachment({
      id: attachId ? attachId : undefined,
      mimeType: 'application/json',
      data: attachData,
    })
    return { format, attachment }
  }

  public processPresentation(options: ProcessPresentationOptions): void {
    throw new Error('Method not implemented.')
  }

  /**
   * Get attachment format identifier for format and message combination
   *
   * @param messageType Message type for which to return the format identifier
   * @return V2CredentialFormatSpec - Issue credential attachment format identifier
   */
  public getFormatIdentifier(messageType: string): ProofFormatSpec {
    return ATTACHMENT_FORMAT[messageType].indy
  }

  public async getRequestedAttachmentsForRequestedCredentials(
    indyProofRequest: ProofRequest,
    requestedCredentials: RequestedCredentials
  ): Promise<Attachment[] | undefined> {
    const attachments: Attachment[] = []
    const credentialIds = new Set<string>()
    const requestedAttributesNames: (string | undefined)[] = []

    // Get the credentialIds if it contains a hashlink
    for (const [referent, requestedAttribute] of Object.entries(requestedCredentials.requestedAttributes)) {
      // Find the requested Attributes
      const requestedAttributes = indyProofRequest.requestedAttributes.get(referent) as ProofAttributeInfo

      // List the requested attributes
      requestedAttributesNames.push(...(requestedAttributes.names ?? [requestedAttributes.name]))

      // Find the attributes that have a hashlink as a value
      for (const attribute of Object.values(requestedAttribute.credentialInfo.attributes)) {
        if (attribute.toLowerCase().startsWith('hl:')) {
          credentialIds.add(requestedAttribute.credentialId)
        }
      }
    }

    // Only continues if there is an attribute value that contains a hashlink
    for (const credentialId of credentialIds) {
      // Get the credentialRecord that matches the ID

      const credentialRecord = await this.credentialRepository.getSingleByQuery({ credentialId })

      if (credentialRecord.linkedAttachments) {
        // Get the credentials that have a hashlink as value and are requested
        const requestedCredentials = credentialRecord.credentialAttributes?.filter(
          (credential) =>
            credential.value.toLowerCase().startsWith('hl:') && requestedAttributesNames.includes(credential.name)
        )

        // Get the linked attachments that match the requestedCredentials
        const linkedAttachments = credentialRecord.linkedAttachments.filter((attachment) =>
          requestedCredentials?.map((credential) => credential.value.split(':')[1]).includes(attachment.id)
        )

        if (linkedAttachments) {
          attachments.push(...linkedAttachments)
        }
      }
    }

    return attachments.length ? attachments : undefined
  }

}
