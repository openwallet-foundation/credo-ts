import type { AgentContext } from '../../../../agent'
import type { V2Attachment } from '../../../../decorators/attachment'
import type {
  ExtractProofFormats,
  ProofFormatCredentialForRequestPayload,
  ProofFormatPayload,
  ProofFormatService,
} from '../../formats'
import type { ProofExchangeRecord } from '../../repository'

import { toV1Attachment, toV2Attachment } from '../../../../didcomm'
import { AriesFrameworkError } from '../../../../error'
import { DidCommMessageRepository, DidCommMessageRole } from '../../../../storage'

import { V3PresentationMessage, V3ProposePresentationMessage, V3RequestPresentationMessage } from './messages'

export class ProofFormatCoordinator<PFs extends ProofFormatService[]> {
  /**
   * Create a {@link V3ProposePresentationMessage}.
   *
   * @param options
   * @returns The created {@link V3ProposePresentationMessage}
   *
   */
  public async createProposal(
    agentContext: AgentContext,
    {
      proofFormats,
      formatServices,
      proofRecord,
      comment,
      goalCode,
    }: {
      formatServices: ProofFormatService[]
      proofFormats: ProofFormatPayload<ExtractProofFormats<PFs>, 'createProposal'>
      proofRecord: ProofExchangeRecord
      comment?: string
      goalCode?: string
    }
  ): Promise<V3ProposePresentationMessage> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const proposalAttachments: V2Attachment[] = []

    for (const formatService of formatServices) {
      const { format, attachment } = await formatService.createProposal(agentContext, {
        proofFormats,
        proofRecord,
      })

      const v2Attachment = toV2Attachment(attachment)
      v2Attachment.format = format.format
      proposalAttachments.push(v2Attachment)
    }

    const message = new V3ProposePresentationMessage({
      id: proofRecord.threadId,
      attachments: proposalAttachments,
      comment: comment,
      goalCode,
    })

    message.setThread({ threadId: proofRecord.threadId, parentThreadId: proofRecord.parentThreadId })

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: proofRecord.id,
    })

    return message
  }

  public async processProposal(
    agentContext: AgentContext,
    {
      proofRecord,
      message,
      formatServices,
    }: {
      proofRecord: ProofExchangeRecord
      message: V3ProposePresentationMessage
      formatServices: ProofFormatService[]
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.attachments)

      await formatService.processProposal(agentContext, {
        attachment,
        proofRecord,
      })
    }

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: proofRecord.id,
    })
  }

  public async acceptProposal(
    agentContext: AgentContext,
    {
      proofRecord,
      proofFormats,
      formatServices,
      comment,
      goalCode,
      willConfirm,
    }: {
      proofRecord: ProofExchangeRecord
      proofFormats?: ProofFormatPayload<ExtractProofFormats<PFs>, 'acceptProposal'>
      formatServices: ProofFormatService[]
      comment?: string
      goalCode?: string
      willConfirm?: boolean
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const requestAttachments: V2Attachment[] = []

    const proposalMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V3ProposePresentationMessage,
    })

    for (const formatService of formatServices) {
      const proposalAttachment = this.getAttachmentForService(formatService, proposalMessage.attachments)

      const { attachment, format } = await formatService.acceptProposal(agentContext, {
        proofRecord,
        proofFormats,
        proposalAttachment,
      })
      const v2Attachment = toV2Attachment(attachment)
      v2Attachment.format = format.format
      requestAttachments.push(v2Attachment)
    }

    const message = new V3RequestPresentationMessage({
      attachments: requestAttachments,
      comment,
      goalCode,
      willConfirm,
    })

    message.setThread({ threadId: proofRecord.threadId, parentThreadId: proofRecord.parentThreadId })

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    return message
  }

  /**
   * Create a {@link V3RequestPresentationMessage}.
   *
   * @param options
   * @returns The created {@link V3RequestPresentationMessage}
   *
   */
  public async createRequest(
    agentContext: AgentContext,
    {
      proofFormats,
      formatServices,
      proofRecord,
      comment,
      goalCode,
      willConfirm,
    }: {
      formatServices: ProofFormatService[]
      proofFormats: ProofFormatPayload<ExtractProofFormats<PFs>, 'createRequest'>
      proofRecord: ProofExchangeRecord
      comment?: string
      goalCode?: string
      willConfirm?: boolean
    }
  ): Promise<V3RequestPresentationMessage> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const requestAttachments: V2Attachment[] = []

    for (const formatService of formatServices) {
      const { format, attachment } = await formatService.createRequest(agentContext, {
        proofFormats,
        proofRecord,
      })

      const v2Attachment = toV2Attachment(attachment)
      v2Attachment.format = format.format
      requestAttachments.push(v2Attachment)
    }

    const message = new V3RequestPresentationMessage({
      comment,
      attachments: requestAttachments,
      goalCode,
      willConfirm,
    })

    message.setThread({ threadId: proofRecord.threadId, parentThreadId: proofRecord.parentThreadId })

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Sender,
      associatedRecordId: proofRecord.id,
    })

    return message
  }

  public async processRequest(
    agentContext: AgentContext,
    {
      proofRecord,
      message,
      formatServices,
    }: {
      proofRecord: ProofExchangeRecord
      message: V3RequestPresentationMessage
      formatServices: ProofFormatService[]
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.attachments)

      await formatService.processRequest(agentContext, {
        attachment,
        proofRecord,
      })
    }

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: proofRecord.id,
    })
  }

  public async acceptRequest(
    agentContext: AgentContext,
    {
      proofRecord,
      proofFormats,
      formatServices,
      comment,
      goalCode,
    }: {
      proofRecord: ProofExchangeRecord
      proofFormats?: ProofFormatPayload<ExtractProofFormats<PFs>, 'acceptRequest'>
      formatServices: ProofFormatService[]
      comment?: string
      goalCode?: string
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V3RequestPresentationMessage,
    })

    const proposalMessage = await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V3ProposePresentationMessage,
    })

    const presentationAttachments: V2Attachment[] = []

    for (const formatService of formatServices) {
      const requestAttachment = this.getAttachmentForService(formatService, requestMessage.attachments)

      const proposalAttachment = proposalMessage
        ? this.getAttachmentForService(formatService, proposalMessage.attachments)
        : undefined

      const { attachment, format } = await formatService.acceptRequest(agentContext, {
        requestAttachment,
        proposalAttachment,
        proofRecord,
        proofFormats,
      })

      const v2Attachment = toV2Attachment(attachment)
      v2Attachment.format = format.format
      presentationAttachments.push(v2Attachment)
    }

    const message = new V3PresentationMessage({
      attachments: presentationAttachments,
      comment,
      goalCode,
    })

    message.setThread({ threadId: proofRecord.threadId })
    //TODO: message.setPleaseAck()

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      associatedRecordId: proofRecord.id,
      role: DidCommMessageRole.Sender,
    })

    return message
  }

  public async getCredentialsForRequest(
    agentContext: AgentContext,
    {
      proofRecord,
      proofFormats,
      formatServices,
    }: {
      proofRecord: ProofExchangeRecord
      proofFormats?: ProofFormatCredentialForRequestPayload<
        ExtractProofFormats<PFs>,
        'getCredentialsForRequest',
        'input'
      >
      formatServices: ProofFormatService[]
    }
  ): Promise<ProofFormatCredentialForRequestPayload<ExtractProofFormats<PFs>, 'getCredentialsForRequest', 'output'>> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V3RequestPresentationMessage,
    })

    const proposalMessage = await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V3ProposePresentationMessage,
    })

    const credentialsForRequest: Record<string, unknown> = {}

    for (const formatService of formatServices) {
      const requestAttachment = this.getAttachmentForService(formatService, requestMessage.attachments)

      const proposalAttachment = proposalMessage
        ? this.getAttachmentForService(formatService, proposalMessage.attachments)
        : undefined

      const credentialsForFormat = await formatService.getCredentialsForRequest(agentContext, {
        requestAttachment,
        proposalAttachment,
        proofRecord,
        proofFormats,
      })

      credentialsForRequest[formatService.formatKey] = credentialsForFormat
    }

    return credentialsForRequest
  }

  public async selectCredentialsForRequest(
    agentContext: AgentContext,
    {
      proofRecord,
      proofFormats,
      formatServices,
    }: {
      proofRecord: ProofExchangeRecord
      proofFormats?: ProofFormatCredentialForRequestPayload<
        ExtractProofFormats<PFs>,
        'selectCredentialsForRequest',
        'input'
      >
      formatServices: ProofFormatService[]
    }
  ): Promise<
    ProofFormatCredentialForRequestPayload<ExtractProofFormats<PFs>, 'selectCredentialsForRequest', 'output'>
  > {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V3RequestPresentationMessage,
    })

    const proposalMessage = await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: V3ProposePresentationMessage,
    })

    const credentialsForRequest: Record<string, unknown> = {}

    for (const formatService of formatServices) {
      const requestAttachment = this.getAttachmentForService(formatService, requestMessage.attachments)

      const proposalAttachment = proposalMessage
        ? this.getAttachmentForService(formatService, proposalMessage.attachments)
        : undefined

      const credentialsForFormat = await formatService.selectCredentialsForRequest(agentContext, {
        requestAttachment,
        proposalAttachment,
        proofRecord,
        proofFormats,
      })

      credentialsForRequest[formatService.formatKey] = credentialsForFormat
    }

    return credentialsForRequest
  }

  public async processPresentation(
    agentContext: AgentContext,
    {
      proofRecord,
      message,
      requestMessage,
      formatServices,
    }: {
      proofRecord: ProofExchangeRecord
      message: V3PresentationMessage
      requestMessage: V3RequestPresentationMessage
      formatServices: ProofFormatService[]
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const formatVerificationResults: boolean[] = []

    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.attachments)
      const requestAttachment = this.getAttachmentForService(formatService, requestMessage.attachments)

      const isValid = await formatService.processPresentation(agentContext, {
        attachment,
        requestAttachment,
        proofRecord,
      })

      formatVerificationResults.push(isValid)
    }

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: proofRecord.id,
    })

    return formatVerificationResults.every((isValid) => isValid === true)
  }

  public getAttachmentForService(proofFormatService: ProofFormatService, attachments: V2Attachment[]) {
    const attachment = attachments.find(
      (attachment) => attachment.format && proofFormatService.supportsFormat(attachment.format)
    )

    if (!attachment) {
      throw new AriesFrameworkError(`Attachment with format ${proofFormatService.formatKey} not found in attachments.`)
    }

    return toV1Attachment(attachment)
  }
}
