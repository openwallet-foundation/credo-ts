import { AcceptProposalOptions, ProposeCredentialOptions, V2CredOfferFormat } from "./interfaces";
import { V2ProposeCredentialMessage } from './messages/V2ProposeCredentialMessage'
import { CredentialRecord, CredentialRecordProps } from '../repository/CredentialRecord'
import { AgentMessage } from 'packages/core/src/agent/AgentMessage';
import { CredentialFormatService } from './formats/CredentialFormatService';
import { CredentialOfferTemplate, CredentialState, CredentialUtils } from '..';
import { V2OfferCredentialMessage } from "./messages/V2OfferCredentialMessage";
import { unitTestLogger } from '../../../logger'
import { Attachment } from "packages/core/src/decorators/attachment/Attachment";


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
    const { preview, formats, filtersAttach } = formatService.getCredentialProposeAttachFormats(proposal, 'CRED_20_PROPOSAL')

    const credentialDefinitionId: string | undefined = formatService.getCredentialDefinitionId(proposal)

    let attachments: Attachment[] | undefined = formatService.getCredentialLinkedAttachments(proposal)

    
    if (filtersAttach === undefined) {
      throw Error("filtersAttach not initialized for credential proposal")
    }
    const message: V2ProposeCredentialMessage = new V2ProposeCredentialMessage(formatService.generateId(), formats, filtersAttach, proposal.comment, credentialDefinitionId, preview)

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

    //  const { credentialDefinitionId, comment, preview, attachments } = credentialTemplate
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

    //  credentialRecord.linkedAttachments = attachments?.filter((attachment) => isLinkedAttachment(attachment))
    //  credentialRecord.autoAcceptCredential =
    //    credentialTemplate.autoAcceptCredential ?? credentialRecord.autoAcceptCredential

    //  await this.updateState(credentialRecord, CredentialState.OfferSent)

    //  return { message: credentialOfferMessage, credentialRecord }

    return credentialOfferMessage
  }
}

