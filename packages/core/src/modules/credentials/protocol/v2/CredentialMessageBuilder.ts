import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type {
  CredentialProtocolMsgReturnType,
  ServiceAcceptRequestOptions,
  ServiceOfferCredentialOptions,
  ServiceRequestCredentialOptions,
} from '../../CredentialServiceOptions'
import type { ProposeCredentialOptions } from '../../CredentialsModuleOptions'
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
    if (formatServices.length === 0) {
      throw new AriesFrameworkError('no format services provided to createProposal')
    }

    // create message
    // there are two arrays in each message, one for formats the other for attachments
    const formatsArray: CredentialFormatSpec[] = []
    const filtersAttachArray: Attachment[] | undefined = []
    let previewAttachments: V2CredentialPreview | undefined
    for (const formatService of formatServices) {
      const { format: formats, attachment, preview } = await formatService.createProposal(proposal)
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
  public processProposal(message: V2ProposeCredentialMessage, connectionId?: string): CredentialExchangeRecord {
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
    options: ServiceOfferCredentialOptions
  ): Promise<V2OfferCredentialMessage> {
    if (formatServices.length === 0) {
      throw new AriesFrameworkError('no format services provided to createProposal')
    }
    // create message
    // there are two arrays in each message, one for formats the other for attachments
    const formatsArray: CredentialFormatSpec[] = []
    const offersAttachArray: Attachment[] | undefined = []
    let previewAttachments: V2CredentialPreview = new V2CredentialPreview({
      attributes: [],
    })

    for (const formatService of formatServices) {
      const { attachment: offersAttach, preview, format } = await formatService.createOffer(options)
      if (offersAttach === undefined) {
        throw new AriesFrameworkError('offersAttach not initialized for credential offer')
      }
      if (offersAttach) {
        offersAttachArray.push(offersAttach)
      } else {
        throw new AriesFrameworkError('offersAttach not initialized for credential proposal')
      }
      if (preview && preview.attributes.length > 0) {
        previewAttachments = preview
      }
      formatsArray.push(format)

      await formatService.processOffer(offersAttach, credentialRecord)
    }

    const messageProps: V2OfferCredentialMessageOptions = {
      id: this.generateId(),
      formats: formatsArray,
      comment: options.comment,
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
    options: CreateRequestOptions
  ): Promise<CredentialProtocolMsgReturnType<V2RequestCredentialMessage>> {
    if (options.formatServices.length === 0) {
      throw new AriesFrameworkError('no format services provided to createProposal')
    }

    const formatsArray: CredentialFormatSpec[] = []
    const requestAttachArray: Attachment[] | undefined = []
    for (const format of options.formatServices) {
      // use the attach id in the formats object to find the correct attachment
      const attachment = format.getAttachment(options.offerMessage.formats, options.offerMessage.messageAttachment)

      if (attachment) {
        options.requestOptions.offerAttachment = attachment
      } else {
        throw new AriesFrameworkError(`Missing data payload in attachment in credential Record ${options.record.id}`)
      }
      const { format: formats, attachment: requestAttach } = await format.createRequest(
        options.requestOptions,
        options.record,
        options.holderDid
      )

      options.requestOptions.requestAttachment = requestAttach
      if (formats && requestAttach) {
        formatsArray.push(formats)
        requestAttachArray.push(requestAttach)
      }
    }
    const messageOptions: V2RequestCredentialMessageOptions = {
      id: this.generateId(),
      formats: formatsArray,
      requestsAttach: requestAttachArray,
      comment: options.requestOptions.comment,
    }
    const credentialRequestMessage = new V2RequestCredentialMessage(messageOptions)
    credentialRequestMessage.setThread({ threadId: options.record.threadId })

    options.record.autoAcceptCredential =
      options.requestOptions.autoAcceptCredential ?? options.record.autoAcceptCredential

    return { message: credentialRequestMessage, credentialRecord: options.record }
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
    if (formatServices.length === 0) {
      throw new AriesFrameworkError('no format services provided to createProposal')
    }
    const formatsArray: CredentialFormatSpec[] = []
    const offersAttachArray: Attachment[] | undefined = []
    let previewAttachments: V2CredentialPreview = new V2CredentialPreview({
      attributes: [],
    })

    const offerMap = new Map<Attachment, CredentialFormatService>()
    for (const formatService of formatServices) {
      const { attachment: offersAttach, preview, format } = await formatService.createOffer(options)

      if (offersAttach) {
        offersAttachArray.push(offersAttach)
        offerMap.set(offersAttach, formatService)
      } else {
        throw new AriesFrameworkError('offersAttach not initialized for credential proposal')
      }
      if (preview) {
        previewAttachments = preview
      }
      formatsArray.push(format)
    }

    const messageProps: V2OfferCredentialMessageOptions = {
      id: this.generateId(),
      formats: formatsArray,
      comment: options.comment,
      offerAttachments: offersAttachArray,
      replacementId: undefined,
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

    for (const offersAttach of offerMap.keys()) {
      const service = offerMap.get(offersAttach)
      if (!service) {
        throw new AriesFrameworkError(`No service found for attachment: ${offersAttach.id}`)
      }
      await service.processOffer(offersAttach, credentialRecord)
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
    serviceOptions: ServiceAcceptRequestOptions,
    requestMessage: V2RequestCredentialMessage,
    offerMessage: V2OfferCredentialMessage
  ): Promise<CredentialProtocolMsgReturnType<V2IssueCredentialMessage>> {
    const formatsArray: CredentialFormatSpec[] = []
    const credAttachArray: Attachment[] | undefined = []

    for (const formatService of credentialFormats) {
      const offerAttachment = formatService.getAttachment(offerMessage.formats, offerMessage.messageAttachment)
      const requestAttachment = formatService.getAttachment(requestMessage.formats, requestMessage.messageAttachment)

      if (!requestAttachment) {
        throw new Error(`Missing request attachment in createCredential`)
      }

      const { format: formats, attachment: credentialsAttach } = await formatService.createCredential(
        serviceOptions,
        record,
        requestAttachment,
        offerAttachment
      )

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
      comment: serviceOptions.comment,
    }

    const message: V2IssueCredentialMessage = new V2IssueCredentialMessage(messageOptions)

    return { message, credentialRecord: record }
  }
  public generateId(): string {
    return uuid()
  }
}
