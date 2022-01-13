import type { CredentialRecordProps } from '../repository/CredentialRecord'
import type { V2CredentialPreview } from './V2CredentialPreview'
import type { CredentialFormatService } from './formats/CredentialFormatService'
import type {
  AcceptProposalOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
  V2CredOfferFormat,
  V2CredRequestFormat,
} from './interfaces'
import type { V2ProposeCredentialMessageOptions } from './messages/V2ProposeCredentialMessage'
import type { V2RequestCredentialMessageOptions } from './messages/V2RequestCredentialMessage'
import type { AgentMessage } from 'packages/core/src/agent/AgentMessage'

import { CredentialState } from '..'
import { AriesFrameworkError } from '../../../error'
import { isLinkedAttachment } from '../../../utils/attachment'
import { CredentialRecord } from '../repository/CredentialRecord'

import { V2OfferCredentialMessage } from './messages/V2OfferCredentialMessage'
import { V2ProposeCredentialMessage } from './messages/V2ProposeCredentialMessage'
import { V2RequestCredentialMessage } from './messages/V2RequestCredentialMessage'

export interface CredentialProtocolMsgReturnType<MessageType extends AgentMessage> {
  message: MessageType
  credentialRecord: CredentialRecord
}

export class CredentialMessageBuilder {
  /**
   * Create a v2 credential proposal message according to the logic contained in the format service. The format services
   * contain specific logic related to indy, jsonld etc. with others to come.
   *
   * @param formatService {@link CredentialFormatService} the format service object containing format-specific logic
   * @param proposal {@link ProposeCredentialOptions} object containing (optionally) the linked attachments
   * @param _threadId optional thread id for this message service
   * @return a version 2.0 credential propose message see {@link V2ProposeCredentialMessage}
   */
  public createProposal(
    formatService: CredentialFormatService,
    proposal: ProposeCredentialOptions
  ): CredentialProtocolMsgReturnType<V2ProposeCredentialMessage> {
    // create message
    const { formats, filtersAttach } = formatService.getCredentialProposeAttachFormats(proposal, 'CRED_20_PROPOSAL')

    const credentialDefinitionId: string | undefined = formatService.getCredentialDefinitionId(proposal)

    const { previewWithAttachments: previewWithAttachments } = formatService.getCredentialLinkedAttachments(proposal)

    if (!filtersAttach) {
      throw Error('filtersAttach not initialized for credential proposal')
    }

    const options: V2ProposeCredentialMessageOptions = {
      id: formatService.generateId(),
      formats,
      filtersAttach: filtersAttach,
      comment: proposal.comment,
      credentialDefinitionId,
      credentialProposal: previewWithAttachments,
    }

    const message: V2ProposeCredentialMessage = new V2ProposeCredentialMessage(options)

    const props: CredentialRecordProps = {
      connectionId: proposal.connectionId,
      threadId: message.threadId,
      state: CredentialState.ProposalSent,
      autoAcceptCredential: proposal?.autoAcceptCredential,
    }

    // Create the v2 record
    const credentialRecord = new CredentialRecord(props)
    credentialRecord.proposalMessage = message // new V2 field

    return { message, credentialRecord }
  }

  /**
   * accept a v2 credential proposal message according to the logic contained in the format service. The format services
   * contain specific logic related to indy, jsonld etc. with others to come.
   *
   * @param formatService {@link CredentialFormatService} the format service object containing format-specific logic
   * @param message {@link V2ProposeCredentialMessage} object containing (optionally) the linked attachments
   * @param connectionId optional connection id for the agent to agent connection
   * @return a version 2.0 credential record object see {@link CredentialRecord}
   */
  public acceptProposal(
    formatService: CredentialFormatService,
    message: V2ProposeCredentialMessage,
    connectionId?: string
  ): CredentialRecord {
    const props: CredentialRecordProps = {
      connectionId: connectionId,
      threadId: message.threadId,
      proposalMessage: message,
      state: CredentialState.ProposalReceived,
      credentialAttributes: message.credentialProposal?.attributes,
    }
    return new CredentialRecord(props)
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
    formatService: CredentialFormatService,
    credentialRecord: CredentialRecord,
    proposal: AcceptProposalOptions
  ): Promise<V2OfferCredentialMessage> {
    // Create the offer message for the correct format

    const credOffer: V2CredOfferFormat = await formatService.createCredentialOffer(proposal)

    const { preview, formats, offersAttach } = formatService.getCredentialOfferAttachFormats(
      proposal,
      credOffer,
      'CRED_20_OFFER'
    )

    const comment: string = proposal.comment ? proposal.comment : ''

    if (offersAttach === undefined) {
      throw Error('offersAttach not initialized for credential offer')
    }

    if (preview === undefined) {
      throw Error('credential missing for credential offer')
    }
    const credentialOfferMessage: V2OfferCredentialMessage = new V2OfferCredentialMessage(
      formatService.generateId(),
      formats,
      comment,
      offersAttach,
      '', // replacementId
      preview
    )

    credentialOfferMessage.setThread({
      threadId: credentialRecord.threadId,
    })

    credentialRecord.offerMessage = credentialOfferMessage

    formatService.setMetaDataForOffer(credOffer, credentialRecord)

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
   * Validate the existence of a credential definition id in a proposal record, and return the id
   * or throw and error if absent
   * @param formatService correct service for format, indy, w3c etc.
   * @param proposal the proposal object needed for acceptance processing
   * @return credential definition id for this proposal record
   */
  public getCredentialDefinitionId(formatService: CredentialFormatService, proposal: ProposeCredentialOptions): string {
    const credentialDefinitionId = formatService.getCredentialDefinitionId(proposal)
    if (!credentialDefinitionId) {
      throw new AriesFrameworkError(
        'Missing required credential definition id. If credential proposal message contains no credential definition id it must be passed to config.'
      )
    }
    return credentialDefinitionId
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
    formatService: CredentialFormatService,
    credentialRecord: CredentialRecord,
    requestOptions: RequestCredentialOptions
  ): Promise<CredentialProtocolMsgReturnType<V2RequestCredentialMessage>> {
    // Assert credential
    credentialRecord.assertState(CredentialState.OfferReceived)

    requestOptions.offer = formatService.getCredentialOffer(credentialRecord)

    // For W3C we will need to be able to create a request when there is no offer
    // whereas for Indy there must be an offer according to the v2 protocol

    if (requestOptions.offer) {
      // format service -> get the credential definition and create the [indy] credential request

      requestOptions.credentialDefinition = await formatService.getCredentialDefinition(requestOptions.offer)

      const credentialRequest = await formatService.createCredentialRequest(requestOptions)

      // format service -> create the request~attach component for the v2 request message
      const { formats, requestAttach } = formatService.getCredentialRequestAttachFormats(
        credentialRequest,
        'CRED_20_REQUEST'
      )

      if (!requestAttach) {
        throw Error('No request attachment found for Credential Request')
      }

      const options: V2RequestCredentialMessageOptions = {
        id: formatService.generateId(),
        formats,
        requestsAttach: requestAttach,
        comment: requestOptions.comment,
        attachments: credentialRecord.offerMessage?.attachments?.filter((attachment) => isLinkedAttachment(attachment)),
      }

      const credentialRequestMessage = new V2RequestCredentialMessage(options)

      credentialRequestMessage.setThread({ threadId: credentialRecord.threadId })

      formatService.setMetaDataForRequest(credentialRequest, credentialRecord)

      credentialRecord.requestMessage = credentialRequestMessage
      credentialRecord.autoAcceptCredential =
        requestOptions.autoAcceptCredential ?? credentialRecord.autoAcceptCredential

      credentialRecord.linkedAttachments = credentialRecord.offerMessage?.attachments?.filter((attachment) =>
        isLinkedAttachment(attachment)
      )
      return { message: credentialRequestMessage, credentialRecord }
    }

    throw Error('Missing offer. Beginning Credential Exchange with Request not supported in Indy')
  }

  /**
   * Extract the payload from the message and turn that into a V2CredRequestFormat object. For
   * Indy this will be a CredReq object embedded threrein.
   * @param formatService the format service for handling this message, indy or w3c
   * @param message the {@link V2RequestCredentialMessage}
   * @return V2CredRequestFormat object containing the payload for this message
   */
  public getCredentialRequestFromMessage(
    formatService: CredentialFormatService,
    message: V2RequestCredentialMessage
  ): V2CredRequestFormat | undefined {
    return formatService.getCredentialRequest(message)
  }
}
