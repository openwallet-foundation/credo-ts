import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type {
  AcceptProposalOptions,
  AcceptRequestOptions,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../../interfaces'
import type { CredentialRecordProps } from '../../repository/CredentialRecord'
import type { V2CredentialPreview } from './V2CredentialPreview'
import type {
  CredentialFormatService,
  V2CredentialFormatSpec,
  V2CredProposeOfferRequestFormat,
} from './formats/CredentialFormatService'
import type { V2IssueCredentialMessageProps } from './messages/V2IssueCredentialMessage'
import type { V2OfferCredentialMessageOptions } from './messages/V2OfferCredentialMessage'
import type { V2ProposeCredentialMessageProps } from './messages/V2ProposeCredentialMessage'
import type { V2RequestCredentialMessageOptions } from './messages/V2RequestCredentialMessage'

import { assert } from 'console'

import { CredentialState } from '../..'
import { uuid } from '../../../../utils/uuid'
import { CredentialExchangeRecord } from '../../repository/CredentialRecord'

import { V2IssueCredentialMessage } from './messages/V2IssueCredentialMessage'
import { V2OfferCredentialMessage } from './messages/V2OfferCredentialMessage'
import { V2ProposeCredentialMessage } from './messages/V2ProposeCredentialMessage'
import { V2RequestCredentialMessage } from './messages/V2RequestCredentialMessage'

export interface CredentialProtocolMsgReturnType<MessageType extends AgentMessage> {
  message: MessageType
  credentialRecord: CredentialExchangeRecord
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
  public createProposal(
    formatServices: CredentialFormatService[],
    proposal: ProposeCredentialOptions
  ): CredentialProtocolMsgReturnType<V2ProposeCredentialMessage> {
    assert(formatServices.length > 0)

    // create message
    // there are two arrays in each message, one for formats the other for attachments
    const formatsArray: V2CredentialFormatSpec[] = []
    const filtersAttachArray: Attachment[] | undefined = []
    let previewAttachments: V2CredentialPreview | undefined
    for (const formatService of formatServices) {
      const { formats, filtersAttach, previewWithAttachments } = formatService.createProposalAttachFormats(proposal)
      if (filtersAttach) {
        filtersAttachArray.push(filtersAttach)
      } else {
        throw Error('filtersAttach not initialized for credential proposal')
      }
      if (previewWithAttachments) {
        previewAttachments = previewWithAttachments
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

    const props: CredentialRecordProps = {
      connectionId: proposal.connectionId,
      threadId: message.threadId,
      state: CredentialState.ProposalSent,
      autoAcceptCredential: proposal?.autoAcceptCredential,
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
    const props: CredentialRecordProps = {
      connectionId: connectionId,
      threadId: message.threadId,
      state: CredentialState.ProposalReceived,
      credentialAttributes: message.credentialProposal?.attributes,
    }
    return new CredentialExchangeRecord(props)
  }

  /**
   * Create a {@link V2OfferCredentialMessage} as response to a received credential proposal.
   * To create an offer not bound to an existing credential exchange, use {@link CredentialService#createOffer}.
   *
   * @param formatService {@link CredentialFormatService} the format service object containing format-specific logic
   * @param credentialRecord The credential record for which to create the credential offer
   * @param proposal other attributes of the original proposal
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOfferAsResponse(
    formatServices: CredentialFormatService[],
    credentialRecord: CredentialExchangeRecord,
    proposal: AcceptProposalOptions | NegotiateProposalOptions
  ): Promise<V2OfferCredentialMessage> {
    assert(formatServices.length > 0)

    // create message
    // there are two arrays in each message, one for formats the other for attachments
    const formatsArray: V2CredentialFormatSpec[] = []
    const offersAttachArray: Attachment[] | undefined = []
    let previewAttachments: V2CredentialPreview | undefined
    let credOffer: V2CredProposeOfferRequestFormat | undefined
    for (const service of formatServices) {
      // Create the offer message for the correct format

      credOffer = await service.createOffer(proposal)

      const { preview, formats, offersAttach } = service.createOfferAttachFormats(proposal, credOffer)
      if (offersAttach === undefined) {
        throw Error('offersAttach not initialized for credential offer')
      }
      if (offersAttach) {
        offersAttachArray.push(offersAttach)
      } else {
        throw Error('offersAttach not initialized for credential proposal')
      }
      if (preview) {
        previewAttachments = preview
      }
      formatsArray.push(formats)
    }
    const comment: string = proposal.comment ? proposal.comment : ''

    const messageProps: V2OfferCredentialMessageOptions = {
      id: this.generateId(),
      formats: formatsArray,
      comment,
      offerAttachments: offersAttachArray,
      replacementId: '', // replacementId
      credentialPreview: previewAttachments,
    }
    const credentialOfferMessage: V2OfferCredentialMessage = new V2OfferCredentialMessage(messageProps)

    credentialOfferMessage.setThread({
      threadId: credentialRecord.threadId,
    })

    credentialRecord.credentialAttributes = previewAttachments?.attributes

    if (credOffer) {
      // MJR-TODO is it sufficient to call this once assuming at least one format?
      formatServices[0].getMetaDataService().setMetaDataForOffer(credOffer, credentialRecord)
    }

    return credentialOfferMessage
  }

  /**
   * Method to insert a preview object into a proposal. This can occur when we retrieve a
   * preview object as part of the stored credential record and need to add it to the
   * proposal object used for processing credential proposals
   * @param formatService correct service for format, indy, w3c etc.
   * @param proposal the proposal object needed for acceptance processing
   * @param preview the preview containing stored attributes
   * @returns proposal object with extra preview attached
   */
  public setPreview(
    formatService: CredentialFormatService,
    proposal: AcceptProposalOptions,
    preview?: V2CredentialPreview
  ): AcceptProposalOptions {
    if (preview) {
      formatService.setPreview(proposal, preview)
    }
    return proposal
  }

  /**
   * Create a {@link V2RequestCredentialMessage}
   *
   * @param formatService correct service for format, indy, w3c etc.
   * @param credentialRecord The credential record for which to create the credential request
   * @param offer Additional configuration for the offer if present (might not be for W3C)
   * @returns Object containing request message and associated credential record
   *
   */
  public async createRequest(
    formatServices: CredentialFormatService[],
    credentialRecord: CredentialExchangeRecord,
    requestOptions: RequestCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<V2RequestCredentialMessage>> {
    // Assert credential
    credentialRecord.assertState(CredentialState.OfferReceived)
    const formatsArray: V2CredentialFormatSpec[] = []
    const requestAttachArray: Attachment[] | undefined = []
    for (const service of formatServices) {
      const { formats, requestAttach, credOfferRequest } = await service.createRequestAttachFormats(
        requestOptions,
        credentialRecord
      )

      if (formats && requestAttach) {
        formatsArray.push(formats)
        requestAttachArray.push(requestAttach)
      }

      if (!credOfferRequest) {
        throw Error('Error creating credential request')
      }
      service.getMetaDataService().setMetaDataForRequest(credOfferRequest, credentialRecord)
    }
    const options: V2RequestCredentialMessageOptions = {
      id: this.generateId(),
      formats: formatsArray,
      requestsAttach: requestAttachArray,
      comment: requestOptions.comment,
    }
    const credentialRequestMessage = new V2RequestCredentialMessage(options)
    credentialRequestMessage.setThread({ threadId: credentialRecord.threadId })

    credentialRecord.autoAcceptCredential = requestOptions.autoAcceptCredential ?? credentialRecord.autoAcceptCredential

    return { message: credentialRequestMessage, credentialRecord }
    throw Error('Error: No formats specified in message')
  }

  /**
   * Create a {@link V2OfferCredentialMessage} as begonning of protocol process.
   *
   * @param formatService {@link CredentialFormatService} the format service object containing format-specific logic
   * @param options attributes of the original offer
   * @returns Object containing offer message and associated credential record
   *
   */
  public async createOffer(
    formatServices: CredentialFormatService[],
    options: OfferCredentialOptions
  ): Promise<{ credentialRecord: CredentialExchangeRecord; message: V2OfferCredentialMessage }> {
    const formatsArray: V2CredentialFormatSpec[] = []
    const offersAttachArray: Attachment[] | undefined = []
    let previewAttachments: V2CredentialPreview | undefined
    let credOffer: V2CredProposeOfferRequestFormat = {}

    for (const service of formatServices) {
      // Create the offer message for the correct format
      credOffer = await service.createOffer(options)
      const { preview, formats, offersAttach } = service.createOfferAttachFormats(options, credOffer)
      if (offersAttach) {
        offersAttachArray.push(offersAttach)
      } else {
        throw Error('offersAttach not initialized for credential proposal')
      }
      if (preview) {
        previewAttachments = preview
      }
      formatsArray.push(formats)
    }

    const comment: string = options.comment ? options.comment : ''

    const messageProps: V2OfferCredentialMessageOptions = {
      id: this.generateId(),
      formats: formatsArray,
      comment,
      offerAttachments: offersAttachArray,
      replacementId: '', // replacementId
      credentialPreview: previewAttachments,
    }

    // Construct v2 offer message
    const credentialOfferMessage: V2OfferCredentialMessage = new V2OfferCredentialMessage(messageProps)

    const recordProps: CredentialRecordProps = {
      connectionId: options.connectionId,
      threadId: credentialOfferMessage.threadId,
      autoAcceptCredential: options?.autoAcceptCredential,
      state: CredentialState.OfferSent,
      credentialAttributes: previewAttachments?.attributes,
    }

    // Create the v2 record
    const credentialRecord = new CredentialExchangeRecord(recordProps)

    // set meta data and emit event - MJR-TODO how do we do this for multiple formats?
    formatServices[0].getMetaDataService().setMetaDataForOffer(credOffer, credentialRecord)

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
    credentialRecord: CredentialExchangeRecord,
    options: AcceptRequestOptions
  ): Promise<CredentialProtocolMsgReturnType<V2IssueCredentialMessage>> {
    const formatsArray: V2CredentialFormatSpec[] = []
    const credAttachArray: Attachment[] | undefined = []

    for (const formatService of credentialFormats) {
      const { formats, credentialsAttach } = await formatService.createIssueAttachFormats(credentialRecord)

      if (!formats) {
        throw Error('formats not initialized for credential')
      }
      formatsArray.push(formats)
      if (!credentialsAttach) {
        throw Error('credentialsAttach not initialized for credential')
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

    return { message, credentialRecord }
  }

  public generateId(): string {
    return uuid()
  }
}
