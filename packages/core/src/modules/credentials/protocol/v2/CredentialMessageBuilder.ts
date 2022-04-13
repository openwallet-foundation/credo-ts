import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type {
  CredentialProtocolMsgReturnType,
  ServiceAcceptProposalOptions,
  ServiceAcceptRequestOptions,
  ServiceNegotiateProposalOptions,
  ServiceOfferCredentialOptions,
  ServiceRequestCredentialOptions,
} from '../../CredentialServiceOptions'
import type { AcceptProposalOptions, ProposeCredentialOptions } from '../../CredentialsModuleOptions'
import type { CredentialFormatService } from '../../formats/CredentialFormatService'
import type { CredentialFormatSpec } from '../../formats/models/CredentialFormatServiceOptions'
import type { CredentialExchangeRecordProps } from '../../repository/CredentialExchangeRecord'
import type { V2CredentialPreview } from './V2CredentialPreview'
import type { V2IssueCredentialMessageProps } from './messages/V2IssueCredentialMessage'
import type { V2OfferCredentialMessageOptions } from './messages/V2OfferCredentialMessage'
import type { V2ProposeCredentialMessageProps } from './messages/V2ProposeCredentialMessage'
import type { V2RequestCredentialMessageOptions } from './messages/V2RequestCredentialMessage'

import { assert } from 'console'

import { AriesFrameworkError } from '../../../../../src/error/AriesFrameworkError'
import { uuid } from '../../../../utils/uuid'
import { CredentialProtocolVersion } from '../../CredentialProtocolVersion'
import { CredentialState } from '../../CredentialState'
import { CredentialExchangeRecord } from '../../repository/CredentialExchangeRecord'

import { V2IssueCredentialMessage } from './messages/V2IssueCredentialMessage'
import { V2OfferCredentialMessage } from './messages/V2OfferCredentialMessage'
import { V2ProposeCredentialMessage } from './messages/V2ProposeCredentialMessage'
import { V2RequestCredentialMessage } from './messages/V2RequestCredentialMessage'

export class CredentialMessageBuilder {
  /**
   * Create a v2 credential proposal message according to the logic contained in the format service. The format services
   * contain specific logic related to indy, jsonld etc. with others to come.
   *
   * @param formats {@link CredentialFormatService} array of format service objects each containing format-specific logic
   * @param proposal {@link ProposeCredentialOptions} object containing (optionally) the linked attachments
   * @param _threadId optional thread id for this message service
   * @return a version 2.0 credential propose message see {@link V2ProposeCredentialMessage}
   */
  public createProposal(
    formatServices: CredentialFormatService[],
    proposal: ProposeCredentialOptions
  ): CredentialProtocolMsgReturnType<V2ProposeCredentialMessage> {
    assert(formatServices.length > 0)

    // create message
    // there are two arrays in each message, one for formats the other for attachments
    const formatsArray: CredentialFormatSpec[] = []
    const filtersAttachArray: Attachment[] | undefined = []
    let previewAttachments: V2CredentialPreview | undefined
    for (const formatService of formatServices) {
      const { format: formats, attachment, preview } = formatService.createProposal(proposal)
      if (attachment) {
        filtersAttachArray.push(attachment)
      } else {
        throw new AriesFrameworkError('attachment not initialized for credential proposal')
      }
      if (preview) {
        previewAttachments = preview
      }
      formatsArray.push(formats)
    }
    const options: V2ProposeCredentialMessageProps = {
      id: this.generateId(),
      formats: formatsArray,
      filtersAttach: filtersAttachArray,
      comment: proposal.comment,
      credentialProposal: previewAttachments,
    }

    const message: V2ProposeCredentialMessage = new V2ProposeCredentialMessage(options)

    const props: CredentialExchangeRecordProps = {
      connectionId: proposal.connectionId,
      threadId: message.threadId,
      state: CredentialState.ProposalSent,
      autoAcceptCredential: proposal?.autoAcceptCredential,
      protocolVersion: CredentialProtocolVersion.V2,
      credentials: [],
    }

    // Create the v2 record
    const credentialRecord = new CredentialExchangeRecord(props)

    return { message, credentialRecord }
  }

  /**
   * accept a v2 credential proposal message according to the logic contained in the format service. The format services
   * contain specific logic related to indy, jsonld etc. with others to come.
   *
   * @param message {@link V2ProposeCredentialMessage} object containing (optionally) the linked attachments
   * @param connectionId optional connection id for the agent to agent connection
   * @return a version 2.0 credential record object see {@link CredentialRecord}
   */
  public acceptProposal(message: V2ProposeCredentialMessage, connectionId?: string): CredentialExchangeRecord {
    const props: CredentialExchangeRecordProps = {
      connectionId: connectionId,
      threadId: message.threadId,
      state: CredentialState.ProposalReceived,
      credentialAttributes: message.credentialProposal?.attributes,
      protocolVersion: CredentialProtocolVersion.V2,
      credentials: [],
    }
    return new CredentialExchangeRecord(props)
  }

  public async createOfferAsResponse(
    formatServices: CredentialFormatService[],
    credentialRecord: CredentialExchangeRecord,
    proposal: ServiceAcceptProposalOptions | ServiceNegotiateProposalOptions
  ): Promise<V2OfferCredentialMessage> {
    assert(formatServices.length > 0)

    // create message
    // there are two arrays in each message, one for formats the other for attachments
    const formatsArray: CredentialFormatSpec[] = []
    const offersAttachArray: Attachment[] | undefined = []
    let previewAttachments: V2CredentialPreview | undefined

    for (const formatService of formatServices) {
      const { attachment: offersAttach, preview, format } = await formatService.createOffer(proposal)
      proposal.offerAttachment = offersAttach
      if (offersAttach === undefined) {
        throw new AriesFrameworkError('offersAttach not initialized for credential offer')
      }
      if (offersAttach) {
        offersAttachArray.push(offersAttach)
      } else {
        throw new AriesFrameworkError('offersAttach not initialized for credential proposal')
      }
      if (preview) {
        previewAttachments = preview
        await formatService.checkPreviewAttributesMatchSchemaAttributes(offersAttach, preview)
      }
      formatsArray.push(format)

      if (proposal.offerAttachment) {
        formatService.processOffer(proposal.offerAttachment, credentialRecord)
      }
    }

    const messageProps: V2OfferCredentialMessageOptions = {
      id: this.generateId(),
      formats: formatsArray,
      comment: proposal.comment,
      offerAttachments: offersAttachArray,
      credentialPreview: previewAttachments,
    }
    const credentialOfferMessage: V2OfferCredentialMessage = new V2OfferCredentialMessage(messageProps)

    credentialOfferMessage.setThread({
      threadId: credentialRecord.threadId,
    })

    credentialRecord.credentialAttributes = previewAttachments?.attributes

    return credentialOfferMessage
  }

  /**
   * Create a {@link V2RequestCredentialMessage}
   *
   * @param formatService correct service for format, indy, w3c etc.
   * @param record The credential record for which to create the credential request
   * @param offer Additional configuration for the offer if present (might not be for W3C)
   * @returns Object containing request message and associated credential record
   *
   */
  public async createRequest(
    formatServices: CredentialFormatService[],
    record: CredentialExchangeRecord,
    requestOptions: ServiceRequestCredentialOptions,
    offerMessage: V2OfferCredentialMessage,
    holderDid?: string
  ): Promise<CredentialProtocolMsgReturnType<V2RequestCredentialMessage>> {
    // Assert credential
    record.assertState(CredentialState.OfferReceived)
    if (!offerMessage) {
      throw new AriesFrameworkError(`Missing message for credential Record ${record.id}`)
    }
    const formatsArray: CredentialFormatSpec[] = []
    const requestAttachArray: Attachment[] | undefined = []
    for (const format of formatServices) {
      // use the attach id in the formats object to find the correct attachment
      const attachment = format.getAttachment(offerMessage.formats, offerMessage.messageAttachment)

      if (attachment) {
        requestOptions.offerAttachment = attachment
      } else {
        throw new AriesFrameworkError(`Missing data payload in attachment in credential Record ${record.id}`)
      }
      const { format: formats, attachment: requestAttach } = await format.createRequest(
        requestOptions,
        record,
        holderDid
      )

      requestOptions.requestAttachment = requestAttach
      if (formats && requestAttach) {
        formatsArray.push(formats)
        requestAttachArray.push(requestAttach)
      }
    }
    const options: V2RequestCredentialMessageOptions = {
      id: this.generateId(),
      formats: formatsArray,
      requestsAttach: requestAttachArray,
      comment: requestOptions.comment,
    }
    const credentialRequestMessage = new V2RequestCredentialMessage(options)
    credentialRequestMessage.setThread({ threadId: record.threadId })

    record.autoAcceptCredential = requestOptions.autoAcceptCredential ?? record.autoAcceptCredential

    return { message: credentialRequestMessage, credentialRecord: record }
  }

  /**
   * Create a {@link V2OfferCredentialMessage} as beginning of protocol process.
   *
   * @param formatService {@link CredentialFormatService} the format service object containing format-specific logic
   * @param options attributes of the original offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOffer(
    formatServices: CredentialFormatService[],
    options: ServiceOfferCredentialOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: V2OfferCredentialMessage }> {
    const formatsArray: CredentialFormatSpec[] = []
    const offersAttachArray: Attachment[] | undefined = []
    let previewAttachments: V2CredentialPreview | undefined

    for (const formatService of formatServices) {
      const offerOptions = options as unknown as AcceptProposalOptions
      const { attachment: offersAttach, preview, format } = await formatService.createOffer(offerOptions)

      if (offersAttach) {
        offersAttachArray.push(offersAttach)
        options.offerAttachment = offersAttach
      } else {
        throw new AriesFrameworkError('offersAttach not initialized for credential proposal')
      }
      if (preview) {
        previewAttachments = preview
        await formatService.checkPreviewAttributesMatchSchemaAttributes(offersAttach, preview)
      }
      formatsArray.push(format)
    }

    const messageProps: V2OfferCredentialMessageOptions = {
      id: this.generateId(),
      formats: formatsArray,
      comment: options.comment,
      offerAttachments: offersAttachArray,
      replacementId: '', // replacementId
      credentialPreview: previewAttachments,
    }

    // Construct v2 offer message
    const credentialOfferMessage: V2OfferCredentialMessage = new V2OfferCredentialMessage(messageProps)

    const recordProps: CredentialExchangeRecordProps = {
      connectionId: options.connectionId,
      threadId: credentialOfferMessage.threadId,
      autoAcceptCredential: options?.autoAcceptCredential,
      state: CredentialState.OfferSent,
      credentialAttributes: previewAttachments?.attributes,
      protocolVersion: CredentialProtocolVersion.V2,
      credentials: [],
    }

    const credentialRecord = new CredentialExchangeRecord(recordProps)

    for (const service of formatServices) {
      if (options.offerAttachment) {
        service.processOffer(options.offerAttachment, credentialRecord)
      }
    }
    return { credentialRecord, message: credentialOfferMessage }
  }

  /**
   * Create a {@link V2IssueCredentialMessage} - we issue the credentials to the holder with this message
   *
   * @param formatService {@link CredentialFormatService} the format service object containing format-specific logic
   * @param offerMessage the original offer message
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createCredential(
    credentialFormats: CredentialFormatService[],
    record: CredentialExchangeRecord,
    options: ServiceAcceptRequestOptions,
    requestMessage: V2RequestCredentialMessage,
    offerMessage?: V2OfferCredentialMessage
  ): Promise<CredentialProtocolMsgReturnType<V2IssueCredentialMessage>> {
    const formatsArray: CredentialFormatSpec[] = []
    const credAttachArray: Attachment[] | undefined = []

    for (const formatService of credentialFormats) {
      if (offerMessage) {
        options.offerAttachment = formatService.getAttachment(offerMessage.formats, offerMessage.messageAttachment)
      } else {
        throw new AriesFrameworkError(`Missing data payload in attachment in credential Record ${record.id}`)
      }
      options.requestAttachment = formatService.getAttachment(requestMessage.formats, requestMessage.messageAttachment)

      const { format: formats, attachment: credentialsAttach } = await formatService.createCredential(options, record)

      if (!formats) {
        throw new AriesFrameworkError('formats not initialized for credential')
      }
      formatsArray.push(formats)
      if (!credentialsAttach) {
        throw new AriesFrameworkError('credentialsAttach not initialized for credential')
      }
      credAttachArray.push(credentialsAttach)
    }
    const messageOptions: V2IssueCredentialMessageProps = {
      id: this.generateId(),
      formats: formatsArray,
      credentialsAttach: credAttachArray,
      comment: options.comment,
    }

    const message: V2IssueCredentialMessage = new V2IssueCredentialMessage(messageOptions)

    return { message, credentialRecord: record }
  }
  public generateId(): string {
    return uuid()
  }
}
