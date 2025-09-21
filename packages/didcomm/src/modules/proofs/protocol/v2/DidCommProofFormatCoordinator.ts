import type { AgentContext } from '@credo-ts/core'
import type { DidCommAttachment } from '../../../../decorators/attachment/DidCommAttachment'
import type {
  DidCommProofFormatCredentialForRequestPayload,
  DidCommProofFormatPayload,
  DidCommProofFormatService,
  ExtractProofFormats,
} from '../../formats'
import type { DidCommProofFormatSpec } from '../../models/DidCommProofFormatSpec'
import type { DidCommProofExchangeRecord } from '../../repository'

import { CredoError } from '@credo-ts/core'

import { DidCommMessageRepository, DidCommMessageRole } from '../../../../repository'

import {
  DidCommPresentationV2Message,
  DidCommProposePresentationV2Message,
  DidCommRequestPresentationV2Message,
} from './messages'

export class ProofFormatCoordinator<PFs extends DidCommProofFormatService[]> {
  /**
   * Create a {@link DidCommProposePresentationV2Message}.
   *
   * @param options
   * @returns The created {@link DidCommProposePresentationV2Message}
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
      goal,
    }: {
      formatServices: DidCommProofFormatService[]
      proofFormats: DidCommProofFormatPayload<ExtractProofFormats<PFs>, 'createProposal'>
      proofRecord: DidCommProofExchangeRecord
      comment?: string
      goalCode?: string
      goal?: string
    }
  ): Promise<DidCommProposePresentationV2Message> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // create message. there are two arrays in each message, one for formats the other for attachments
    const formats: DidCommProofFormatSpec[] = []
    const proposalAttachments: DidCommAttachment[] = []

    for (const formatService of formatServices) {
      const { format, attachment } = await formatService.createProposal(agentContext, {
        proofFormats,
        proofRecord,
      })

      proposalAttachments.push(attachment)
      formats.push(format)
    }

    const message = new DidCommProposePresentationV2Message({
      id: proofRecord.threadId,
      formats,
      proposalAttachments,
      comment: comment,
      goalCode,
      goal,
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
      proofRecord: DidCommProofExchangeRecord
      message: DidCommProposePresentationV2Message
      formatServices: DidCommProofFormatService[]
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.formats, message.proposalAttachments)

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
      goal,
      presentMultiple,
      willConfirm,
    }: {
      proofRecord: DidCommProofExchangeRecord
      proofFormats?: DidCommProofFormatPayload<ExtractProofFormats<PFs>, 'acceptProposal'>
      formatServices: DidCommProofFormatService[]
      comment?: string
      goalCode?: string
      goal?: string
      presentMultiple?: boolean
      willConfirm?: boolean
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // create message. there are two arrays in each message, one for formats the other for attachments
    const formats: DidCommProofFormatSpec[] = []
    const requestAttachments: DidCommAttachment[] = []

    const proposalMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommProposePresentationV2Message,
      role: DidCommMessageRole.Receiver,
    })

    for (const formatService of formatServices) {
      const proposalAttachment = this.getAttachmentForService(
        formatService,
        proposalMessage.formats,
        proposalMessage.proposalAttachments
      )

      const { attachment, format } = await formatService.acceptProposal(agentContext, {
        proofRecord,
        proofFormats,
        proposalAttachment,
      })

      requestAttachments.push(attachment)
      formats.push(format)
    }

    const message = new DidCommRequestPresentationV2Message({
      formats,
      requestAttachments,
      comment,
      goalCode,
      goal,
      presentMultiple,
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
   * Create a {@link DidCommRequestPresentationV2Message}.
   *
   * @param options
   * @returns The created {@link DidCommRequestPresentationV2Message}
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
      goal,
      presentMultiple,
      willConfirm,
    }: {
      formatServices: DidCommProofFormatService[]
      proofFormats: DidCommProofFormatPayload<ExtractProofFormats<PFs>, 'createRequest'>
      proofRecord: DidCommProofExchangeRecord
      comment?: string
      goalCode?: string
      goal?: string
      presentMultiple?: boolean
      willConfirm?: boolean
    }
  ): Promise<DidCommRequestPresentationV2Message> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    // create message. there are two arrays in each message, one for formats the other for attachments
    const formats: DidCommProofFormatSpec[] = []
    const requestAttachments: DidCommAttachment[] = []

    for (const formatService of formatServices) {
      const { format, attachment } = await formatService.createRequest(agentContext, {
        proofFormats,
        proofRecord,
      })

      requestAttachments.push(attachment)
      formats.push(format)
    }

    const message = new DidCommRequestPresentationV2Message({
      formats,
      comment,
      requestAttachments,
      goalCode,
      goal,
      presentMultiple,
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
      proofRecord: DidCommProofExchangeRecord
      message: DidCommRequestPresentationV2Message
      formatServices: DidCommProofFormatService[]
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.formats, message.requestAttachments)

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
      lastPresentation,
      goalCode,
      goal,
    }: {
      proofRecord: DidCommProofExchangeRecord
      proofFormats?: DidCommProofFormatPayload<ExtractProofFormats<PFs>, 'acceptRequest'>
      formatServices: DidCommProofFormatService[]
      comment?: string
      lastPresentation?: boolean
      goalCode?: string
      goal?: string
    }
  ) {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommRequestPresentationV2Message,
      role: DidCommMessageRole.Receiver,
    })

    const proposalMessage = await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommProposePresentationV2Message,
      role: DidCommMessageRole.Receiver,
    })

    // create message. there are two arrays in each message, one for formats the other for attachments
    const formats: DidCommProofFormatSpec[] = []
    const presentationAttachments: DidCommAttachment[] = []

    for (const formatService of formatServices) {
      const requestAttachment = this.getAttachmentForService(
        formatService,
        requestMessage.formats,
        requestMessage.requestAttachments
      )

      const proposalAttachment = proposalMessage
        ? this.getAttachmentForService(formatService, proposalMessage.formats, proposalMessage.proposalAttachments)
        : undefined

      const { attachment, format } = await formatService.acceptRequest(agentContext, {
        requestAttachment,
        proposalAttachment,
        proofRecord,
        proofFormats,
      })

      presentationAttachments.push(attachment)
      formats.push(format)
    }

    const message = new DidCommPresentationV2Message({
      formats,
      presentationAttachments,
      comment,
      lastPresentation,
      goalCode,
      goal,
    })

    message.setThread({ threadId: proofRecord.threadId, parentThreadId: proofRecord.parentThreadId })
    message.setPleaseAck()

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
      proofRecord: DidCommProofExchangeRecord
      proofFormats?: DidCommProofFormatCredentialForRequestPayload<
        ExtractProofFormats<PFs>,
        'getCredentialsForRequest',
        'input'
      >
      formatServices: DidCommProofFormatService[]
    }
  ): Promise<
    DidCommProofFormatCredentialForRequestPayload<ExtractProofFormats<PFs>, 'getCredentialsForRequest', 'output'>
  > {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommRequestPresentationV2Message,
      role: DidCommMessageRole.Receiver,
    })

    const proposalMessage = await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommProposePresentationV2Message,
      role: DidCommMessageRole.Receiver,
    })

    const credentialsForRequest: Record<string, unknown> = {}

    for (const formatService of formatServices) {
      const requestAttachment = this.getAttachmentForService(
        formatService,
        requestMessage.formats,
        requestMessage.requestAttachments
      )

      const proposalAttachment = proposalMessage
        ? this.getAttachmentForService(formatService, proposalMessage.formats, proposalMessage.proposalAttachments)
        : undefined

      const credentialsForFormat = await formatService.getCredentialsForRequest(agentContext, {
        requestAttachment,
        proposalAttachment,
        proofRecord,
        proofFormats,
      })

      credentialsForRequest[formatService.formatKey] = credentialsForFormat
    }

    return credentialsForRequest as DidCommProofFormatCredentialForRequestPayload<
      ExtractProofFormats<PFs>,
      'getCredentialsForRequest',
      'output'
    >
  }

  public async selectCredentialsForRequest(
    agentContext: AgentContext,
    {
      proofRecord,
      proofFormats,
      formatServices,
    }: {
      proofRecord: DidCommProofExchangeRecord
      proofFormats?: DidCommProofFormatCredentialForRequestPayload<
        ExtractProofFormats<PFs>,
        'selectCredentialsForRequest',
        'input'
      >
      formatServices: DidCommProofFormatService[]
    }
  ): Promise<
    DidCommProofFormatCredentialForRequestPayload<ExtractProofFormats<PFs>, 'selectCredentialsForRequest', 'output'>
  > {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const requestMessage = await didCommMessageRepository.getAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommRequestPresentationV2Message,
      role: DidCommMessageRole.Receiver,
    })

    const proposalMessage = await didCommMessageRepository.findAgentMessage(agentContext, {
      associatedRecordId: proofRecord.id,
      messageClass: DidCommProposePresentationV2Message,
      role: DidCommMessageRole.Receiver,
    })

    const credentialsForRequest: Record<string, unknown> = {}

    for (const formatService of formatServices) {
      const requestAttachment = this.getAttachmentForService(
        formatService,
        requestMessage.formats,
        requestMessage.requestAttachments
      )

      const proposalAttachment = proposalMessage
        ? this.getAttachmentForService(formatService, proposalMessage.formats, proposalMessage.proposalAttachments)
        : undefined

      const credentialsForFormat = await formatService.selectCredentialsForRequest(agentContext, {
        requestAttachment,
        proposalAttachment,
        proofRecord,
        proofFormats,
      })

      credentialsForRequest[formatService.formatKey] = credentialsForFormat
    }

    return credentialsForRequest as DidCommProofFormatCredentialForRequestPayload<
      ExtractProofFormats<PFs>,
      'selectCredentialsForRequest',
      'output'
    >
  }

  public async processPresentation(
    agentContext: AgentContext,
    {
      proofRecord,
      message,
      requestMessage,
      formatServices,
    }: {
      proofRecord: DidCommProofExchangeRecord
      message: DidCommPresentationV2Message
      requestMessage: DidCommRequestPresentationV2Message
      formatServices: DidCommProofFormatService[]
    }
  ): Promise<{ isValid: true; message: undefined } | { isValid: false; message: string }> {
    const didCommMessageRepository = agentContext.dependencyManager.resolve(DidCommMessageRepository)

    const formatVerificationResults: boolean[] = []

    for (const formatService of formatServices) {
      const attachment = this.getAttachmentForService(formatService, message.formats, message.presentationAttachments)
      const requestAttachment = this.getAttachmentForService(
        formatService,
        requestMessage.formats,
        requestMessage.requestAttachments
      )

      try {
        // TODO: this should return a more complex object explaining why it is invalid
        const isValid = await formatService.processPresentation(agentContext, {
          attachment,
          requestAttachment,
          proofRecord,
        })

        formatVerificationResults.push(isValid)
      } catch (error) {
        return {
          message: error.message,
          isValid: false,
        }
      }
    }

    await didCommMessageRepository.saveOrUpdateAgentMessage(agentContext, {
      agentMessage: message,
      role: DidCommMessageRole.Receiver,
      associatedRecordId: proofRecord.id,
    })

    const isValid = formatVerificationResults.every((isValid) => isValid === true)

    if (isValid) {
      return {
        isValid,
        message: undefined,
      }
    }
    return {
      isValid,
      message: 'Not all presentations are valid',
    }
  }

  public getAttachmentForService(
    credentialFormatService: DidCommProofFormatService,
    formats: DidCommProofFormatSpec[],
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
    credentialFormatService: DidCommProofFormatService,
    formats: DidCommProofFormatSpec[]
  ) {
    const format = formats.find((format) => credentialFormatService.supportsFormat(format.format))

    if (!format) throw new CredoError(`No attachment found for service ${credentialFormatService.formatKey}`)

    return format.attachmentId
  }
}
