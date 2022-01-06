import { AcceptProposalOptions, FormatType, ProposeCredentialOptions, V2CredOfferFormat } from "./interfaces";
import { V2ProposeCredentialMessage } from './messages/V2ProposeCredentialMessage'
import { CredentialRecord, CredentialRecordProps } from '../repository/CredentialRecord'
import { AgentMessage } from 'packages/core/src/agent/AgentMessage';
import { CredentialFormatService } from './formats/CredentialFormatService';
import { V1CredentialPreview, CredentialState } from '..';
import { V2OfferCredentialMessage } from "./messages/V2OfferCredentialMessage";
import { AriesFrameworkError } from "@aries-framework/core";


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
   * @param threadId optional thread id for this message service
   * @return a version 2.0 credential propose message see {@link V2ProposeCredentialMessage}
   */
  public createProposal(
    formatService: CredentialFormatService,
    proposal: ProposeCredentialOptions,
    threadId?: string
  ): CredentialProtocolMsgReturnType<V2ProposeCredentialMessage> {

    // create message
    const { formats, filtersAttach } = formatService.getCredentialProposeAttachFormats(proposal, 'CRED_20_PROPOSAL')

    const credentialDefinitionId: string | undefined = formatService.getCredentialDefinitionId(proposal)

    let { previewWithAttachments: previewWithAttachments } = formatService.getCredentialLinkedAttachments(proposal)

    if (filtersAttach === undefined) {
      throw Error("filtersAttach not initialized for credential proposal")
    }
    const message: V2ProposeCredentialMessage = new V2ProposeCredentialMessage(formatService.generateId(), formats, filtersAttach, proposal.comment, credentialDefinitionId, previewWithAttachments)

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
  public acceptProposal(formatService: CredentialFormatService, message: V2ProposeCredentialMessage, connectionId?: string): CredentialRecord {
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
  public async createOfferAsResponse(formatService: CredentialFormatService,
    credentialRecord: CredentialRecord,
    proposal: AcceptProposalOptions): Promise<V2OfferCredentialMessage> {

    // Create the offer message for the correct format

    const credOffer: V2CredOfferFormat = await formatService.createCredentialOffer(proposal)

    const { preview, formats, offersAttach } = formatService.getCredentialOfferAttachFormats(proposal, 'CRED_20_OFFER')

    const comment: string = proposal.comment ? proposal.comment : ""

    if (offersAttach === undefined) {
      throw Error("offersAttach not initialized for credential offer")
    }

    if (preview === undefined) {
      throw Error("credential missing for credential offer")
    }
    const credentialOfferMessage: V2OfferCredentialMessage = new V2OfferCredentialMessage(
      formatService.generateId(),
      formats,
      comment,
      offersAttach,
      "", // MJR-TODO what is replacement-id ?? (Issuer unique id)
      preview)


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
  public setPreview(formatService: CredentialFormatService, proposal: AcceptProposalOptions, preview?: V1CredentialPreview): AcceptProposalOptions {
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
  public getCredentialDefinitionId(formatService: CredentialFormatService, proposal: FormatType): string {

    const credentialDefinitionId = formatService.getCredentialDefinitionId(proposal)
    if (!credentialDefinitionId) {
      throw new AriesFrameworkError(
        'Missing required credential definition id. If credential proposal message contains no credential definition id it must be passed to config.'
      )
    }
    return credentialDefinitionId
  }
}

