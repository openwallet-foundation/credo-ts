import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type {
  CredentialProtocolMsgReturnType,
  ServiceAcceptRequestOptions,
  ServiceOfferCredentialOptions,
  ServiceRequestCredentialOptions,
} from '../../CredentialServiceOptions'
import type { NegotiateProposalOptions, ProposeCredentialOptions } from '../../CredentialsModuleOptions'
import type { CredentialFormatService } from '../../formats/CredentialFormatService'
import type { CredentialFormatSpec } from '../../formats/models/CredentialFormatServiceOptions'
import type { CredentialExchangeRecordProps } from '../../repository/CredentialExchangeRecord'
import type { V2IssueCredentialMessageProps } from './messages/V2IssueCredentialMessage'
import type { V2OfferCredentialMessageOptions } from './messages/V2OfferCredentialMessage'
import type { V2ProposeCredentialMessageProps } from './messages/V2ProposeCredentialMessage'
import type { V2RequestCredentialMessageOptions } from './messages/V2RequestCredentialMessage'

import { AriesFrameworkError } from '../../../../error/AriesFrameworkError'
import { uuid } from '../../../../utils/uuid'
import { CredentialProtocolVersion } from '../../CredentialProtocolVersion'
import { CredentialState } from '../../CredentialState'
import { CredentialExchangeRecord } from '../../repository/CredentialExchangeRecord'

import { V2CredentialPreview } from './V2CredentialPreview'
import { V2IssueCredentialMessage } from './messages/V2IssueCredentialMessage'
import { V2OfferCredentialMessage } from './messages/V2OfferCredentialMessage'
import { V2ProposeCredentialMessage } from './messages/V2ProposeCredentialMessage'
import { V2RequestCredentialMessage } from './messages/V2RequestCredentialMessage'

export interface CreateRequestOptions {
  formatServices: CredentialFormatService[]
  record: CredentialExchangeRecord
  requestOptions: ServiceRequestCredentialOptions
  offerMessage: V2OfferCredentialMessage
  holderDid?: string
}

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
  public async createProposal(
    formatServices: CredentialFormatService[],
    proposal: ProposeCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<V2ProposeCredentialMessage>> {
    if (formatServices.length === 0) throw new AriesFrameworkError('no format services provided to createProposal')

    // create message
    // there are two arrays in each message, one for formats the other for attachments
    const formats: CredentialFormatSpec[] = []
    const filterAttachments: Attachment[] = []
    let credentialPreview: V2CredentialPreview | undefined

    for (const formatService of formatServices) {
      const { format, attachment, preview } = await formatService.createProposal(proposal)
      credentialPreview ??= preview

      filterAttachments.push(attachment)
      formats.push(format)
    }

    const options: V2ProposeCredentialMessageProps = {
      id: this.generateId(),
      formats,
      filtersAttach: filterAttachments,
      comment: proposal.comment,
      credentialProposal: credentialPreview,
    }

    const message = new V2ProposeCredentialMessage(options)

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
  public processProposal(message: V2ProposeCredentialMessage, connectionId?: string): CredentialExchangeRecord {
    const props: CredentialExchangeRecordProps = {
      connectionId,
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
    options: ServiceOfferCredentialOptions | NegotiateProposalOptions
  ): Promise<V2OfferCredentialMessage> {
    if (formatServices.length === 0)
      throw new AriesFrameworkError('no format services provided to createOfferAsResponse')

    // create message
    // there are two arrays in each message, one for formats the other for attachments
    const formats: CredentialFormatSpec[] = []
    const offerAttachments: Attachment[] = []
    const credentialPreview = new V2CredentialPreview({ attributes: [] })

    for (const formatService of formatServices) {
      const { attachment, preview, format } = await formatService.createOffer(options)

      if (preview && preview.attributes.length > 0) credentialPreview.attributes = preview.attributes

      formats.push(format)
      offerAttachments.push(attachment)

      await formatService.processOffer(attachment, credentialRecord)
    }

    const messageProps: V2OfferCredentialMessageOptions = {
      id: this.generateId(),
      formats,
      comment: options.comment,
      offerAttachments,
      credentialPreview,
    }
    const credentialOfferMessage = new V2OfferCredentialMessage(messageProps)

    credentialOfferMessage.setThread({ threadId: credentialRecord.threadId })

    credentialRecord.credentialAttributes = credentialPreview.attributes

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
    options: CreateRequestOptions
  ): Promise<CredentialProtocolMsgReturnType<V2RequestCredentialMessage>> {
    if (options.formatServices.length === 0)
      throw new AriesFrameworkError('no format services provided to createRequest')

    const { formatServices, offerMessage, record, requestOptions, holderDid } = options

    const formats: CredentialFormatSpec[] = []
    const requestAttachments: Attachment[] = []
    for (const formatService of formatServices) {
      // use the attach id in the formats object to find the correct attachment
      const offerAttachment = formatService.getAttachment(offerMessage.formats, offerMessage.messageAttachment)

      if (offerAttachment) {
        requestOptions.offerAttachment = offerAttachment
      } else {
        throw new AriesFrameworkError(`Missing data payload in attachment in credential Record ${record.id}`)
      }
      const { format, attachment } = await formatService.createRequest(requestOptions, record, holderDid)

      requestOptions.requestAttachment = attachment
      formats.push(format)
      requestAttachments.push(attachment)
    }

    const messageOptions: V2RequestCredentialMessageOptions = {
      id: this.generateId(),
      formats: formats,
      requestsAttach: requestAttachments,
      comment: requestOptions.comment,
    }

    const message = new V2RequestCredentialMessage(messageOptions)
    message.setThread(record)

    record.autoAcceptCredential ??= requestOptions.autoAcceptCredential

    return { message, credentialRecord: record }
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
    if (formatServices.length === 0) throw new AriesFrameworkError('no format services provided to createOffer')

    const { autoAcceptCredential, comment, connection } = options

    const formats: CredentialFormatSpec[] = []
    const offerAttachments: Attachment[] = []
    const credentialPreview: V2CredentialPreview = new V2CredentialPreview({ attributes: [] })

    const offerMap = new Map<Attachment, CredentialFormatService>()

    for (const formatService of formatServices) {
      const { attachment, preview, format } = await formatService.createOffer(options)

      if (preview && preview.attributes.length > 0) credentialPreview.attributes = preview.attributes

      offerMap.set(attachment, formatService)
      offerAttachments.push(attachment)
      formats.push(format)
    }

    const messageProps: V2OfferCredentialMessageOptions = {
      id: this.generateId(),
      formats,
      comment: comment,
      offerAttachments,
      replacementId: undefined,
      credentialPreview,
    }

    // Construct v2 offer message
    const message = new V2OfferCredentialMessage(messageProps)

    const recordProps: CredentialExchangeRecordProps = {
      connectionId: connection?.id,
      threadId: message.threadId,
      autoAcceptCredential,
      state: CredentialState.OfferSent,
      credentialAttributes: credentialPreview?.attributes,
      protocolVersion: CredentialProtocolVersion.V2,
      credentials: [],
    }

    const credentialRecord = new CredentialExchangeRecord(recordProps)

    for (const offersAttach of offerMap.keys()) {
      const service = offerMap.get(offersAttach)
      // service MUST be defined here as we extract the key of the key-value pair and get the value
      await service?.processOffer(offersAttach, credentialRecord)
    }

    return { credentialRecord, message }
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
    serviceOptions: ServiceAcceptRequestOptions,
    requestMessage: V2RequestCredentialMessage,
    offerMessage: V2OfferCredentialMessage
  ): Promise<CredentialProtocolMsgReturnType<V2IssueCredentialMessage>> {
    const formats: CredentialFormatSpec[] = []
    const credentialAttachments: Attachment[] = []

    for (const formatService of credentialFormats) {
      const requestAttachment = formatService.getAttachment(requestMessage.formats, requestMessage.messageAttachment)
      if (!requestAttachment) throw new Error(`Missing request attachment in createCredential`)

      const offerAttachment = formatService.getAttachment(offerMessage.formats, offerMessage.messageAttachment)

      const { format, attachment } = await formatService.createCredential(
        serviceOptions,
        record,
        requestAttachment,
        offerAttachment
      )

      formats.push(format)
      credentialAttachments.push(attachment)
    }
    const messageOptions: V2IssueCredentialMessageProps = {
      id: this.generateId(),
      formats: formats,
      credentialsAttach: credentialAttachments,
      comment: serviceOptions.comment,
    }

    const message = new V2IssueCredentialMessage(messageOptions)

    return { message, credentialRecord: record }
  }

  public generateId(): string {
    return uuid()
  }
}
