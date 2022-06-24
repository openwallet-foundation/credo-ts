import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { DidCommMessageRepository } from '../../../../storage'
import type { CredentialFormat, CredentialFormatPayload, CredentialFormatService } from '../../formats'
import type { CredentialFormatSpec } from '../../models'
import type { CredentialExchangeRecord } from '../../repository/CredentialExchangeRecord'

import { AriesFrameworkError } from '../../../../error/AriesFrameworkError'
import { DidCommMessageRole } from '../../../../storage'

import {
  V2IssueCredentialMessage,
  V2OfferCredentialMessage,
  V2ProposeCredentialMessage,
  V2RequestCredentialMessage,
  V2CredentialPreview,
} from './messages'

export class CredentialFormatCoordinator<CFs extends CredentialFormat[]> {
  private didCommMessageRepository: DidCommMessageRepository
  public constructor(didCommMessageRepository: DidCommMessageRepository) {
    this.didCommMessageRepository = didCommMessageRepository
  }

  /**
   * Create a {@link V2ProposeCredentialMessage}.
   *
   * @param options
   * @returns The created {@link V2ProposeCredentialMessage}
   *
   */
  public async createProposal({
    credentialFormats,
    formatServices,
    credentialRecord,
    comment,
  }: {
    formatServices: CredentialFormatService[]
    credentialFormats: CredentialFormatPayload<CFs, 'createProposal'>
    credentialRecord: CredentialExchangeRecord
    comment?: string
  }): Promise<V2ProposeCredentialMessage> {
    // create message. there are two arrays in each message, one for formats the other for attachments
    const formats: CredentialFormatSpec[] = []
    const proposalAttachments: Attachment[] = []
    let credentialPreview: V2CredentialPreview | undefined

    for (const formatService of formatServices) {
      const { format, attachment, previewAttributes } = await formatService.createProposal({
        credentialFormats,
        credentialRecord,
      })

      if (previewAttributes) {
        credentialPreview = new V2CredentialPreview({
          attributes: previewAttributes,
        })
      }

      proposalAttachments.push(attachment)
      formats.push(format)
    }

    credentialRecord.credentialAttributes = credentialPreview?.attributes

    const message = new V2ProposeCredentialMessage({
      id: credentialRecord.threadId,
      formats,
      proposalAttachments,
      comment: comment,
      credentialPreview,
    })

    message.setThread({ threadId: credentialRecord.threadId })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    return message
  }

  public async processProposal({
    credentialRecord,
    message,
    formatServices,
  }: {
    credentialRecord: CredentialExchangeRecord
    message: V2ProposeCredentialMessage
    formatServices: CredentialFormatService[]
  }) {
    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.formats, message.proposalAttachments)

      await formatService.processProposal({
        attachment,
        credentialRecord,
      })
    }

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
  }

  public async acceptProposal({
    credentialRecord,
    credentialFormats,
    formatServices,
    comment,
  }: {
    credentialRecord: CredentialExchangeRecord
    credentialFormats?: CredentialFormatPayload<CFs, 'acceptProposal'>
    formatServices: CredentialFormatService[]
    comment?: string
  }) {
    // create message. there are two arrays in each message, one for formats the other for attachments
    const formats: CredentialFormatSpec[] = []
    const offerAttachments: Attachment[] = []
    let credentialPreview: V2CredentialPreview | undefined

    const proposalMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2ProposeCredentialMessage,
    })

    // NOTE: We set the credential attributes from the proposal on the record as we've 'accepted' them
    // and can now use them to create the offer in the format services. It may be overwritten later on
    // if the user provided other attributes in the credentialFormats array.
    credentialRecord.credentialAttributes = proposalMessage.credentialPreview?.attributes

    for (const formatService of formatServices) {
      const proposalAttachment = this.getAttachmentForService(
        formatService,
        proposalMessage.formats,
        proposalMessage.proposalAttachments
      )

      const { attachment, format, previewAttributes } = await formatService.acceptProposal({
        credentialRecord,
        credentialFormats,
        proposalAttachment,
      })

      if (previewAttributes) {
        credentialPreview = new V2CredentialPreview({
          attributes: previewAttributes,
        })
      }

      offerAttachments.push(attachment)
      formats.push(format)
    }

    credentialRecord.credentialAttributes = credentialPreview?.attributes

    if (!credentialPreview) {
      // If no preview attributes were provided, use a blank preview. Not all formats use this object
      // but it is required by the protocol
      credentialPreview = new V2CredentialPreview({
        attributes: [],
      })
    }

    const message = new V2OfferCredentialMessage({
      formats,
      credentialPreview,
      offerAttachments,
      comment,
    })

    message.setThread({ threadId: credentialRecord.threadId })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: message,
      associatedRecordId: credentialRecord.id,
      role: DidCommMessageRole.Sender,
    })

    return message
  }

  /**
   * Create a {@link V2OfferCredentialMessage}.
   *
   * @param options
   * @returns The created {@link V2OfferCredentialMessage}
   *
   */
  public async createOffer({
    credentialFormats,
    formatServices,
    credentialRecord,
    comment,
  }: {
    formatServices: CredentialFormatService[]
    credentialFormats: CredentialFormatPayload<CFs, 'createOffer'>
    credentialRecord: CredentialExchangeRecord
    comment?: string
  }): Promise<V2OfferCredentialMessage> {
    // create message. there are two arrays in each message, one for formats the other for attachments
    const formats: CredentialFormatSpec[] = []
    const offerAttachments: Attachment[] = []
    let credentialPreview: V2CredentialPreview | undefined

    for (const formatService of formatServices) {
      const { format, attachment, previewAttributes } = await formatService.createOffer({
        credentialFormats,
        credentialRecord,
      })

      if (previewAttributes) {
        credentialPreview = new V2CredentialPreview({
          attributes: previewAttributes,
        })
      }

      offerAttachments.push(attachment)
      formats.push(format)
    }

    credentialRecord.credentialAttributes = credentialPreview?.attributes

    if (!credentialPreview) {
      // If no preview attributes were provided, use a blank preview. Not all formats use this object
      // but it is required by the protocol
      credentialPreview = new V2CredentialPreview({
        attributes: [],
      })
    }

    const message = new V2OfferCredentialMessage({
      formats,
      comment,
      offerAttachments,
      credentialPreview,
    })

    message.setThread({ threadId: credentialRecord.threadId })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    return message
  }

  public async processOffer({
    credentialRecord,
    message,
    formatServices,
  }: {
    credentialRecord: CredentialExchangeRecord
    message: V2OfferCredentialMessage
    formatServices: CredentialFormatService[]
  }) {
    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.formats, message.offerAttachments)

      await formatService.processOffer({
        attachment,
        credentialRecord,
      })
    }

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
  }

  public async acceptOffer({
    credentialRecord,
    credentialFormats,
    formatServices,
    comment,
  }: {
    credentialRecord: CredentialExchangeRecord
    credentialFormats?: CredentialFormatPayload<CFs, 'acceptOffer'>
    formatServices: CredentialFormatService[]
    comment?: string
  }) {
    const offerMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2OfferCredentialMessage,
    })

    // create message. there are two arrays in each message, one for formats the other for attachments
    const formats: CredentialFormatSpec[] = []
    const requestAttachments: Attachment[] = []

    for (const formatService of formatServices) {
      const offerAttachment = this.getAttachmentForService(
        formatService,
        offerMessage.formats,
        offerMessage.offerAttachments
      )

      const { attachment, format } = await formatService.acceptOffer({
        offerAttachment,
        credentialRecord,
        credentialFormats,
      })

      requestAttachments.push(attachment)
      formats.push(format)
    }

    credentialRecord.credentialAttributes = offerMessage.credentialPreview?.attributes

    const message = new V2RequestCredentialMessage({
      formats,
      requestAttachments: requestAttachments,
      comment,
    })

    message.setThread({ threadId: credentialRecord.threadId })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: message,
      associatedRecordId: credentialRecord.id,
      role: DidCommMessageRole.Sender,
    })

    return message
  }

  /**
   * Create a {@link V2RequestCredentialMessage}.
   *
   * @param options
   * @returns The created {@link V2RequestCredentialMessage}
   *
   */
  public async createRequest({
    credentialFormats,
    formatServices,
    credentialRecord,
    comment,
  }: {
    formatServices: CredentialFormatService[]
    credentialFormats: CredentialFormatPayload<CFs, 'createRequest'>
    credentialRecord: CredentialExchangeRecord
    comment?: string
  }): Promise<V2RequestCredentialMessage> {
    // create message. there are two arrays in each message, one for formats the other for attachments
    const formats: CredentialFormatSpec[] = []
    const requestAttachments: Attachment[] = []

    for (const formatService of formatServices) {
      const { format, attachment } = await formatService.createRequest({
        credentialFormats,
        credentialRecord,
      })

      requestAttachments.push(attachment)
      formats.push(format)
    }

    const message = new V2RequestCredentialMessage({
      formats,
      comment,
      requestAttachments: requestAttachments,
    })

    message.setThread({ threadId: credentialRecord.threadId })

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    return message
  }

  public async processRequest({
    credentialRecord,
    message,
    formatServices,
  }: {
    credentialRecord: CredentialExchangeRecord
    message: V2RequestCredentialMessage
    formatServices: CredentialFormatService[]
  }) {
    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.formats, message.requestAttachments)

      await formatService.processRequest({
        attachment,
        credentialRecord,
      })
    }

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
  }

  public async acceptRequest({
    credentialRecord,
    credentialFormats,
    formatServices,
    comment,
  }: {
    credentialRecord: CredentialExchangeRecord
    credentialFormats?: CredentialFormatPayload<CFs, 'acceptRequest'>
    formatServices: CredentialFormatService[]
    comment?: string
  }) {
    const requestMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2RequestCredentialMessage,
    })

    const offerMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2OfferCredentialMessage,
    })

    // create message. there are two arrays in each message, one for formats the other for attachments
    const formats: CredentialFormatSpec[] = []
    const credentialAttachments: Attachment[] = []

    for (const formatService of formatServices) {
      const requestAttachment = this.getAttachmentForService(
        formatService,
        requestMessage.formats,
        requestMessage.requestAttachments
      )

      const offerAttachment = offerMessage
        ? this.getAttachmentForService(formatService, offerMessage.formats, offerMessage.offerAttachments)
        : undefined

      const { attachment, format } = await formatService.acceptRequest({
        requestAttachment,
        offerAttachment,
        credentialRecord,
        credentialFormats,
      })

      credentialAttachments.push(attachment)
      formats.push(format)
    }

    const message = new V2IssueCredentialMessage({
      formats,
      credentialAttachments: credentialAttachments,
      comment,
    })

    message.setThread({ threadId: credentialRecord.threadId })
    message.setPleaseAck()

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: message,
      associatedRecordId: credentialRecord.id,
      role: DidCommMessageRole.Sender,
    })

    return message
  }

  public async processCredential({
    credentialRecord,
    message,
    formatServices,
  }: {
    credentialRecord: CredentialExchangeRecord
    message: V2IssueCredentialMessage
    formatServices: CredentialFormatService[]
  }) {
    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.formats, message.credentialAttachments)

      await formatService.processCredential({
        attachment,
        credentialRecord,
      })
    }

    await this.didCommMessageRepository.saveOrUpdateAgentMessage({
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
  }

  public getAttachmentForService(
    credentialFormatService: CredentialFormatService,
    formats: CredentialFormatSpec[],
    attachments: Attachment[]
  ) {
    const attachmentId = this.getAttachmentIdForService(credentialFormatService, formats)
    const attachment = attachments.find((attachment) => attachment.id === attachmentId)

    if (!attachment) {
      throw new AriesFrameworkError(`Attachment with id ${attachmentId} not found in attachments.`)
    }

    return attachment
  }

  private getAttachmentIdForService(credentialFormatService: CredentialFormatService, formats: CredentialFormatSpec[]) {
    const format = formats.find((format) => credentialFormatService.supportsFormat(format.format))

    if (!format) throw new AriesFrameworkError(`No attachment found for service ${credentialFormatService.formatKey}`)

    return format.attachId
  }
}
