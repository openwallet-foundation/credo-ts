import type { AgentContext } from '../../../../agent'
import type { V2Attachment } from '../../../../decorators/attachment'
import type { CredentialFormatPayload, CredentialFormatService, ExtractCredentialFormats } from '../../formats'
import type { CredentialExchangeRecord } from '../../repository/CredentialExchangeRecord'

import { toV1Attachment, toV2Attachment } from '../../../../didcomm'
import { AriesFrameworkError } from '../../../../error/AriesFrameworkError'
import { DidCommMessageRepository, DidCommMessageRole } from '../../../../storage'

import {
  V3IssueCredentialMessage,
  V3OfferCredentialMessage,
  V3ProposeCredentialMessage,
  V3RequestCredentialMessage,
  V3CredentialPreview,
} from './messages'

export class CredentialFormatCoordinator<CFs extends CredentialFormatService[]> {
  /**
   * Create a {@link V3ProposeCredentialMessage}.
   *
   * @param options
   * @returns The created {@link V3ProposeCredentialMessage}
   *
   */
  public async createProposal(
    agentContext: AgentContext,
    {
      credentialFormats,
      formatServices,
      credentialRecord,
      comment,
    }: {
      formatServices: CredentialFormatService[]
      credentialFormats: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'createProposal'>
      credentialRecord: CredentialExchangeRecord
      comment?: string
    }
  ): Promise<V3ProposeCredentialMessage> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const proposalAttachments: V2Attachment[] = []
    let credentialPreview: V3CredentialPreview | undefined

    for (const formatService of formatServices) {
      const { format, attachment, previewAttributes } = await formatService.createProposal(agentContext, {
        credentialFormats,
        credentialRecord,
      })

      if (previewAttributes) {
        credentialPreview = new V3CredentialPreview({
          attributes: previewAttributes,
        })
      }

      const v2Attachment = toV2Attachment(attachment)
      v2Attachment.format = format.format
      proposalAttachments.push(v2Attachment)
    }

    credentialRecord.credentialAttributes = credentialPreview?.attributes

    const message = new V3ProposeCredentialMessage({
      id: credentialRecord.threadId,
      attachments: proposalAttachments,
      comment: comment,
      credentialPreview,
    })

    message.thid = credentialRecord.threadId

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    return message
  }

  public async processProposal(
    agentContext: AgentContext,
    {
      credentialRecord,
      message,
      formatServices,
    }: {
      credentialRecord: CredentialExchangeRecord
      message: V3ProposeCredentialMessage
      formatServices: CredentialFormatService[]
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.attachments)

      await formatService.processProposal(agentContext, {
        attachment,
        credentialRecord,
      })
    }

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
  }

  public async acceptProposal(
    agentContext: AgentContext,
    {
      credentialRecord,
      credentialFormats,
      formatServices,
      comment,
    }: {
      credentialRecord: CredentialExchangeRecord
      credentialFormats?: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'acceptProposal'>
      formatServices: CredentialFormatService[]
      comment?: string
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const offerAttachments: V2Attachment[] = []
    let credentialPreview: V3CredentialPreview | undefined

    const proposalMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: credentialRecord.id,
      messageClass: V3ProposeCredentialMessage,
    })

    // NOTE: We set the credential attributes from the proposal on the record as we've 'accepted' them
    // and can now use them to create the offer in the format services. It may be overwritten later on
    // if the user provided other attributes in the credentialFormats array.
    credentialRecord.credentialAttributes = proposalMessage.body.credentialPreview?.attributes

    for (const formatService of formatServices) {
      const proposalAttachment = this.getAttachmentForService(formatService, proposalMessage.attachments)

      const { attachment, format, previewAttributes } = await formatService.acceptProposal(agentContext, {
        credentialRecord,
        credentialFormats,
        proposalAttachment,
      })

      if (previewAttributes) {
        credentialPreview = new V3CredentialPreview({
          attributes: previewAttributes,
        })
      }

      const v2Attachment = toV2Attachment(attachment)
      v2Attachment.format = format.format
      offerAttachments.push(v2Attachment)
    }

    credentialRecord.credentialAttributes = credentialPreview?.attributes

    if (!credentialPreview) {
      // If no preview attributes were provided, use a blank preview. Not all formats use this object
      // but it is required by the protocol
      credentialPreview = new V3CredentialPreview({
        attributes: [],
      })
    }

    const message = new V3OfferCredentialMessage({
      credentialPreview,
      attachments: offerAttachments,
      comment,
    })

    message.thid = credentialRecord.threadId

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      associatedRecordId: credentialRecord.id,
      role: DidCommMessageRole.Sender,
    })

    return message
  }

  /**
   * Create a {@link V3OfferCredentialMessage}.
   *
   * @param options
   * @returns The created {@link V3OfferCredentialMessage}
   *
   */
  public async createOffer(
    agentContext: AgentContext,
    {
      credentialFormats,
      formatServices,
      credentialRecord,
      comment,
    }: {
      formatServices: CredentialFormatService[]
      credentialFormats: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'createOffer'>
      credentialRecord: CredentialExchangeRecord
      comment?: string
    }
  ): Promise<V3OfferCredentialMessage> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const offerAttachments: V2Attachment[] = []
    let credentialPreview: V3CredentialPreview | undefined

    for (const formatService of formatServices) {
      const { format, attachment, previewAttributes } = await formatService.createOffer(agentContext, {
        credentialFormats,
        credentialRecord,
      })

      if (previewAttributes) {
        credentialPreview = new V3CredentialPreview({
          attributes: previewAttributes,
        })
      }

      const v2Attachment = toV2Attachment(attachment)
      v2Attachment.format = format.format
      offerAttachments.push(v2Attachment)
    }

    credentialRecord.credentialAttributes = credentialPreview?.attributes

    if (!credentialPreview) {
      // If no preview attributes were provided, use a blank preview. Not all formats use this object
      // but it is required by the protocol
      credentialPreview = new V3CredentialPreview({
        attributes: [],
      })
    }

    const message = new V3OfferCredentialMessage({
      comment,
      attachments: offerAttachments,
      credentialPreview,
    })

    message.thid = credentialRecord.threadId

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    return message
  }

  public async processOffer(
    agentContext: AgentContext,
    {
      credentialRecord,
      message,
      formatServices,
    }: {
      credentialRecord: CredentialExchangeRecord
      message: V3OfferCredentialMessage
      formatServices: CredentialFormatService[]
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.attachments)

      await formatService.processOffer(agentContext, {
        attachment,
        credentialRecord,
      })
    }

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
  }

  public async acceptOffer(
    agentContext: AgentContext,
    {
      credentialRecord,
      credentialFormats,
      formatServices,
      comment,
    }: {
      credentialRecord: CredentialExchangeRecord
      credentialFormats?: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'acceptOffer'>
      formatServices: CredentialFormatService[]
      comment?: string
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const offerMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: credentialRecord.id,
      messageClass: V3OfferCredentialMessage,
    })

    const requestAttachments: V2Attachment[] = []

    for (const formatService of formatServices) {
      const offerAttachment = this.getAttachmentForService(formatService, offerMessage.attachments)

      const { attachment, format } = await formatService.acceptOffer(agentContext, {
        offerAttachment,
        credentialRecord,
        credentialFormats,
      })

      const v2Attachment = toV2Attachment(attachment)
      v2Attachment.format = format.format
      requestAttachments.push(v2Attachment)
    }

    credentialRecord.credentialAttributes = offerMessage.body.credentialPreview?.attributes

    const message = new V3RequestCredentialMessage({
      attachments: requestAttachments,
      comment,
    })

    message.thid = credentialRecord.threadId

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      associatedRecordId: credentialRecord.id,
      role: DidCommMessageRole.Sender,
    })

    return message
  }

  /**
   * Create a {@link V3RequestCredentialMessage}.
   *
   * @param options
   * @returns The created {@link V3RequestCredentialMessage}
   *
   */
  public async createRequest(
    agentContext: AgentContext,
    {
      credentialFormats,
      formatServices,
      credentialRecord,
      comment,
    }: {
      formatServices: CredentialFormatService[]
      credentialFormats: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'createRequest'>
      credentialRecord: CredentialExchangeRecord
      comment?: string
    }
  ): Promise<V3RequestCredentialMessage> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const requestAttachments: V2Attachment[] = []

    for (const formatService of formatServices) {
      const { format, attachment } = await formatService.createRequest(agentContext, {
        credentialFormats,
        credentialRecord,
      })

      const v2Attachment = toV2Attachment(attachment)
      v2Attachment.format = format.format
      requestAttachments.push(v2Attachment)
    }

    const message = new V3RequestCredentialMessage({
      comment,
      attachments: requestAttachments,
    })

    message.thid = credentialRecord.threadId

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: credentialRecord.id,
    })

    return message
  }

  public async processRequest(
    agentContext: AgentContext,
    {
      credentialRecord,
      message,
      formatServices,
    }: {
      credentialRecord: CredentialExchangeRecord
      message: V3RequestCredentialMessage
      formatServices: CredentialFormatService[]
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.attachments)

      await formatService.processRequest(agentContext, {
        attachment,
        credentialRecord,
      })
    }

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
  }

  public async acceptRequest(
    agentContext: AgentContext,
    {
      credentialRecord,
      credentialFormats,
      formatServices,
      comment,
    }: {
      credentialRecord: CredentialExchangeRecord
      credentialFormats?: CredentialFormatPayload<ExtractCredentialFormats<CFs>, 'acceptRequest'>
      formatServices: CredentialFormatService[]
      comment?: string
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: credentialRecord.id,
      messageClass: V3RequestCredentialMessage,
    })

    const offerMessage = await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: credentialRecord.id,
      messageClass: V3OfferCredentialMessage,
    })

    const credentialAttachments: V2Attachment[] = []

    for (const formatService of formatServices) {
      const requestAttachment = this.getAttachmentForService(formatService, requestMessage.attachments)

      const offerAttachment = offerMessage
        ? this.getAttachmentForService(formatService, offerMessage.attachments)
        : undefined

      const { attachment, format } = await formatService.acceptRequest(agentContext, {
        requestAttachment,
        offerAttachment,
        credentialRecord,
        credentialFormats,
      })

      const v2Attachment = toV2Attachment(attachment)
      v2Attachment.format = format.format
      credentialAttachments.push(v2Attachment)
    }

    const message = new V3IssueCredentialMessage({
      attachments: credentialAttachments,
      comment,
    })

    message.thid = credentialRecord.threadId
    // TODO: message.setPleaseAck()

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      associatedRecordId: credentialRecord.id,
      role: DidCommMessageRole.Sender,
    })

    return message
  }

  public async processCredential(
    agentContext: AgentContext,
    {
      credentialRecord,
      message,
      requestMessage,
      formatServices,
    }: {
      credentialRecord: CredentialExchangeRecord
      message: V3IssueCredentialMessage
      requestMessage: V3RequestCredentialMessage
      formatServices: CredentialFormatService[]
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.attachments)
      const requestAttachment = this.getAttachmentForService(formatService, requestMessage.attachments)

      await formatService.processCredential(agentContext, {
        attachment,
        requestAttachment,
        credentialRecord,
      })
    }

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: credentialRecord.id,
    })
  }

  public getAttachmentForService(credentialFormatService: CredentialFormatService, attachments: V2Attachment[]) {
    const attachment = attachments.find(
      (attachment) => attachment.format && credentialFormatService.supportsFormat(attachment.format)
    )

    if (!attachment) {
      throw new AriesFrameworkError(
        `Attachment with format ${credentialFormatService.formatKey} not found in attachments.`
      )
    }

    return toV1Attachment(attachment)
  }
}
