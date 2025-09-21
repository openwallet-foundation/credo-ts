import type { AgentContext } from '@credo-ts/core'
import type { DidCommAttachment } from '../../../../decorators/attachment/DidCommAttachment'
import type { DidCommCredentialFormatPayload, DidCommCredentialFormatService, ExtractCredentialFormats } from '../../formats'
import type { DidCommCredentialFormatSpec } from '../../models'
import type { DidCommCredentialExchangeRecord } from '../../repository/DidCommCredentialExchangeRecord'

import { CredoError } from '@credo-ts/core'

import { DidCommMessageRepository, DidCommMessageRole } from '../../../../repository'

import {
  DidCommCredentialV2Preview,
  DidCommIssueCredentialV2Message,
  DidCommOfferCredentialV2Message,
  DidCommProposeCredentialV2Message,
  DidCommRequestCredentialV2Message,
} from './messages'

export class DidCommCredentialFormatCoordinator<CFs extends DidCommCredentialFormatService[]> {
  /**
   * Create a {@link DidCommProposeCredentialV2Message}.
   *
   * @param options
   * @returns The created {@link DidCommProposeCredentialV2Message}
   *
   */
  public async createProposal(
    agentContext: AgentContext,
    {
      credentialFormats,
      formatServices,
      credentialExchangeRecord,
      comment,
      goalCode,
      goal,
    }: {
      formatServices: DidCommCredentialFormatService[]
      credentialFormats: DidCommCredentialFormatPayload<ExtractCredentialFormats<CFs>, 'createProposal'>
      credentialExchangeRecord: DidCommCredentialExchangeRecord
      comment?: string
      goalCode?: string
      goal?: string
    }
  ): Promise<DidCommProposeCredentialV2Message> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // create message. there are two arrays in each message, one for formats the other for attachments
    const formats: DidCommCredentialFormatSpec[] = []
    const proposalAttachments: DidCommAttachment[] = []
    let credentialPreview: DidCommCredentialV2Preview | undefined

    for (const formatService of formatServices) {
      const { format, attachment, previewAttributes } = await formatService.createProposal(agentContext, {
        credentialFormats,
        credentialExchangeRecord,
      })

      if (previewAttributes) {
        credentialPreview = new DidCommCredentialV2Preview({
          attributes: previewAttributes,
        })
      }

      proposalAttachments.push(attachment)
      formats.push(format)
    }

    credentialExchangeRecord.credentialAttributes = credentialPreview?.attributes

    const message = new DidCommProposeCredentialV2Message({
      id: credentialExchangeRecord.threadId,
      formats,
      proposalAttachments,
      comment,
      credentialPreview,
      goalCode,
      goal,
    })

    message.setThread({
      threadId: credentialExchangeRecord.threadId,
      parentThreadId: credentialExchangeRecord.parentThreadId,
    })

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialExchangeRecord.id,
    })

    return message
  }

  public async processProposal(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      message,
      formatServices,
    }: {
      credentialExchangeRecord: DidCommCredentialExchangeRecord
      message: DidCommProposeCredentialV2Message
      formatServices: DidCommCredentialFormatService[]
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.formats, message.proposalAttachments)

      await formatService.processProposal(agentContext, {
        attachment,
        credentialExchangeRecord,
      })
    }

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialExchangeRecord.id,
    })
  }

  public async acceptProposal(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      credentialFormats,
      formatServices,
      comment,
      goalCode,
      goal,
    }: {
      credentialExchangeRecord: DidCommCredentialExchangeRecord
      credentialFormats?: DidCommCredentialFormatPayload<ExtractCredentialFormats<CFs>, 'acceptProposal'>
      formatServices: DidCommCredentialFormatService[]
      comment?: string
      goalCode?: string
      goal?: string
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // create message. there are two arrays in each message, one for formats the other for attachments
    const formats: DidCommCredentialFormatSpec[] = []
    const offerAttachments: DidCommAttachment[] = []
    let credentialPreview: DidCommCredentialV2Preview | undefined

    const proposalMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeRecord.id,
      messageClass: DidCommProposeCredentialV2Message,
      role: DidCommMessageRole.Receiver,
    })

    // NOTE: We set the credential attributes from the proposal on the record as we've 'accepted' them
    // and can now use them to create the offer in the format services. It may be overwritten later on
    // if the user provided other attributes in the credentialFormats array.
    credentialExchangeRecord.credentialAttributes = proposalMessage.credentialPreview?.attributes

    for (const formatService of formatServices) {
      const proposalAttachment = this.getAttachmentForService(
        formatService,
        proposalMessage.formats,
        proposalMessage.proposalAttachments
      )

      const { attachment, format, previewAttributes } = await formatService.acceptProposal(agentContext, {
        credentialExchangeRecord,
        credentialFormats,
        proposalAttachment,
      })

      if (previewAttributes) {
        credentialPreview = new DidCommCredentialV2Preview({
          attributes: previewAttributes,
        })
      }

      offerAttachments.push(attachment)
      formats.push(format)
    }

    credentialExchangeRecord.credentialAttributes = credentialPreview?.attributes

    if (!credentialPreview) {
      // If no preview attributes were provided, use a blank preview. Not all formats use this object
      // but it is required by the protocol
      credentialPreview = new DidCommCredentialV2Preview({
        attributes: [],
      })
    }

    const message = new DidCommOfferCredentialV2Message({
      formats,
      credentialPreview,
      offerAttachments,
      comment,
      goalCode,
      goal,
    })

    message.setThread({
      threadId: credentialExchangeRecord.threadId,
      parentThreadId: credentialExchangeRecord.parentThreadId,
    })

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      associatedRecordId: credentialExchangeRecord.id,
      role: DidCommMessageRole.Sender,
    })

    return message
  }

  /**
   * Create a {@link DidCommOfferCredentialV2Message}.
   *
   * @param options
   * @returns The created {@link DidCommOfferCredentialV2Message}
   *
   */
  public async createOffer(
    agentContext: AgentContext,
    {
      credentialFormats,
      formatServices,
      credentialExchangeRecord,
      comment,
      goalCode,
      goal,
    }: {
      formatServices: DidCommCredentialFormatService[]
      credentialFormats: DidCommCredentialFormatPayload<ExtractCredentialFormats<CFs>, 'createOffer'>
      credentialExchangeRecord: DidCommCredentialExchangeRecord
      comment?: string
      goalCode?: string
      goal?: string
    }
  ): Promise<DidCommOfferCredentialV2Message> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // create message. there are two arrays in each message, one for formats the other for attachments
    const formats: DidCommCredentialFormatSpec[] = []
    const offerAttachments: DidCommAttachment[] = []
    let credentialPreview: DidCommCredentialV2Preview | undefined

    for (const formatService of formatServices) {
      const { format, attachment, previewAttributes } = await formatService.createOffer(agentContext, {
        credentialFormats,
        credentialExchangeRecord,
      })

      if (previewAttributes) {
        credentialPreview = new DidCommCredentialV2Preview({
          attributes: previewAttributes,
        })
      }

      offerAttachments.push(attachment)
      formats.push(format)
    }

    credentialExchangeRecord.credentialAttributes = credentialPreview?.attributes

    if (!credentialPreview) {
      // If no preview attributes were provided, use a blank preview. Not all formats use this object
      // but it is required by the protocol
      credentialPreview = new DidCommCredentialV2Preview({
        attributes: [],
      })
    }

    const message = new DidCommOfferCredentialV2Message({
      formats,
      comment,
      goalCode,
      goal,
      offerAttachments,
      credentialPreview,
    })

    message.setThread({
      threadId: credentialExchangeRecord.threadId,
      parentThreadId: credentialExchangeRecord.parentThreadId,
    })

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialExchangeRecord.id,
    })

    return message
  }

  public async processOffer(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      message,
      formatServices,
    }: {
      credentialExchangeRecord: DidCommCredentialExchangeRecord
      message: DidCommOfferCredentialV2Message
      formatServices: DidCommCredentialFormatService[]
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.formats, message.offerAttachments)

      await formatService.processOffer(agentContext, {
        attachment,
        credentialExchangeRecord,
      })
    }

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialExchangeRecord.id,
    })
  }

  public async acceptOffer(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      credentialFormats,
      formatServices,
      comment,
      goalCode,
      goal,
    }: {
      credentialExchangeRecord: DidCommCredentialExchangeRecord
      credentialFormats?: DidCommCredentialFormatPayload<ExtractCredentialFormats<CFs>, 'acceptOffer'>
      formatServices: DidCommCredentialFormatService[]
      comment?: string
      goalCode?: string
      goal?: string
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const offerMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeRecord.id,
      messageClass: DidCommOfferCredentialV2Message,
      role: DidCommMessageRole.Receiver,
    })

    // create message. there are two arrays in each message, one for formats the other for attachments
    const formats: DidCommCredentialFormatSpec[] = []
    const requestAttachments: DidCommAttachment[] = []
    const requestAppendAttachments: DidCommAttachment[] = []

    for (const formatService of formatServices) {
      const offerAttachment = this.getAttachmentForService(
        formatService,
        offerMessage.formats,
        offerMessage.offerAttachments
      )

      const { attachment, format, appendAttachments } = await formatService.acceptOffer(agentContext, {
        offerAttachment,
        credentialExchangeRecord,
        credentialFormats,
      })

      requestAttachments.push(attachment)
      formats.push(format)
      if (appendAttachments) requestAppendAttachments.push(...appendAttachments)
    }

    credentialExchangeRecord.credentialAttributes = offerMessage.credentialPreview?.attributes

    const message = new DidCommRequestCredentialV2Message({
      formats,
      attachments: requestAppendAttachments,
      requestAttachments: requestAttachments,
      comment,
      goalCode,
      goal,
    })

    message.setThread({
      threadId: credentialExchangeRecord.threadId,
      parentThreadId: credentialExchangeRecord.parentThreadId,
    })

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      associatedRecordId: credentialExchangeRecord.id,
      role: DidCommMessageRole.Sender,
    })

    return message
  }

  /**
   * Create a {@link DidCommRequestCredentialV2Message}.
   *
   * @param options
   * @returns The created {@link DidCommRequestCredentialV2Message}
   *
   */
  public async createRequest(
    agentContext: AgentContext,
    {
      credentialFormats,
      formatServices,
      credentialExchangeRecord,
      comment,
      goalCode,
      goal,
    }: {
      formatServices: DidCommCredentialFormatService[]
      credentialFormats: DidCommCredentialFormatPayload<ExtractCredentialFormats<CFs>, 'createRequest'>
      credentialExchangeRecord: DidCommCredentialExchangeRecord
      comment?: string
      goalCode?: string
      goal?: string
    }
  ): Promise<DidCommRequestCredentialV2Message> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // create message. there are two arrays in each message, one for formats the other for attachments
    const formats: DidCommCredentialFormatSpec[] = []
    const requestAttachments: DidCommAttachment[] = []

    for (const formatService of formatServices) {
      const { format, attachment } = await formatService.createRequest(agentContext, {
        credentialFormats,
        credentialExchangeRecord,
      })

      requestAttachments.push(attachment)
      formats.push(format)
    }

    const message = new DidCommRequestCredentialV2Message({
      formats,
      comment,
      goalCode,
      goal,
      requestAttachments: requestAttachments,
    })

    message.setThread({
      threadId: credentialExchangeRecord.threadId,
      parentThreadId: credentialExchangeRecord.parentThreadId,
    })

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialExchangeRecord.id,
    })

    return message
  }

  public async processRequest(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      message,
      formatServices,
    }: {
      credentialExchangeRecord: DidCommCredentialExchangeRecord
      message: DidCommRequestCredentialV2Message
      formatServices: DidCommCredentialFormatService[]
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.formats, message.requestAttachments)

      await formatService.processRequest(agentContext, {
        attachment,
        credentialExchangeRecord,
      })
    }

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialExchangeRecord.id,
    })
  }

  public async acceptRequest(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      credentialFormats,
      formatServices,
      comment,
      goalCode,
      goal,
    }: {
      credentialExchangeRecord: DidCommCredentialExchangeRecord
      credentialFormats?: DidCommCredentialFormatPayload<ExtractCredentialFormats<CFs>, 'acceptRequest'>
      formatServices: DidCommCredentialFormatService[]
      comment?: string
      goalCode?: string
      goal?: string
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeRecord.id,
      messageClass: DidCommRequestCredentialV2Message,
      role: DidCommMessageRole.Receiver,
    })

    const offerMessage = await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeRecord.id,
      messageClass: DidCommOfferCredentialV2Message,
      role: DidCommMessageRole.Sender,
    })

    // create message. there are two arrays in each message, one for formats the other for attachments
    const formats: DidCommCredentialFormatSpec[] = []
    const credentialAttachments: DidCommAttachment[] = []

    for (const formatService of formatServices) {
      const requestAttachment = this.getAttachmentForService(
        formatService,
        requestMessage.formats,
        requestMessage.requestAttachments
      )

      const offerAttachment = offerMessage
        ? this.getAttachmentForService(formatService, offerMessage.formats, offerMessage.offerAttachments)
        : undefined

      const { attachment, format } = await formatService.acceptRequest(agentContext, {
        requestAttachment,
        offerAttachment,
        credentialExchangeRecord,
        credentialFormats,
        requestAppendAttachments: requestMessage.appendedAttachments,
      })

      credentialAttachments.push(attachment)
      formats.push(format)
    }

    const message = new DidCommIssueCredentialV2Message({
      formats,
      credentialAttachments: credentialAttachments,
      comment,
      goalCode,
      goal,
    })

    message.setThread({
      threadId: credentialExchangeRecord.threadId,
      parentThreadId: credentialExchangeRecord.parentThreadId,
    })
    message.setPleaseAck()

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      associatedRecordId: credentialExchangeRecord.id,
      role: DidCommMessageRole.Sender,
    })

    return message
  }

  public async processCredential(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      message,
      requestMessage,
      formatServices,
    }: {
      credentialExchangeRecord: DidCommCredentialExchangeRecord
      message: DidCommIssueCredentialV2Message
      requestMessage: DidCommRequestCredentialV2Message
      formatServices: DidCommCredentialFormatService[]
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const offerMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: credentialExchangeRecord.id,
      messageClass: DidCommOfferCredentialV2Message,
      role: DidCommMessageRole.Receiver,
    })

    for (const formatService of formatServices) {
      const offerAttachment = this.getAttachmentForService(
        formatService,
        offerMessage.formats,
        offerMessage.offerAttachments
      )

      const attachment = this.getAttachmentForService(formatService, message.formats, message.credentialAttachments)
      const requestAttachment = this.getAttachmentForService(
        formatService,
        requestMessage.formats,
        requestMessage.requestAttachments
      )

      await formatService.processCredential(agentContext, {
        attachment,
        offerAttachment,
        requestAttachment,
        credentialExchangeRecord,
        requestAppendAttachments: requestMessage.appendedAttachments,
      })
    }

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialExchangeRecord.id,
    })
  }

  public getAttachmentForService(
    credentialFormatService: DidCommCredentialFormatService,
    formats: DidCommCredentialFormatSpec[],
    attachments: DidCommAttachment[]
  ) {
    const attachmentId = this.getAttachmentIdForService(credentialFormatService, formats)
    const attachment = attachments.find((attachment) => attachment.id === attachmentId)

    if (!attachment) {
      throw new CredoError(`DidCommAttachment with id ${attachmentId} not found in attachments.`)
    }

    return attachment
  }

  private getAttachmentIdForService(
    credentialFormatService: DidCommCredentialFormatService,
    formats: DidCommCredentialFormatSpec[]
  ) {
    const format = formats.find((format) => credentialFormatService.supportsFormat(format.format))

    if (!format) throw new CredoError(`No attachment found for service ${credentialFormatService.formatKey}`)

    return format.attachmentId
  }
}
