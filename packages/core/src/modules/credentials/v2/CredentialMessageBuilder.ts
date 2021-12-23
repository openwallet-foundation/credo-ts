import { ProposeCredentialOptions } from "./interfaces";
import { V2ProposeCredentialMessage } from './messages/V2ProposeCredentialMessage'
import { CredentialRecord, CredentialRecordProps } from '../repository/CredentialRecord'
import { AgentMessage } from 'packages/core/src/agent/AgentMessage';
import { CredentialFormatService } from './formats/CredentialFormatService';
import { CredentialPreviewAttribute } from '../';
import { CredentialState } from '..';
import { LinkedAttachment } from '../../../utils/LinkedAttachment';

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

    let credentialAttributes: CredentialPreviewAttribute[] | undefined = formatService.getCredentialAttributes(proposal)
    let linkedAttachments: LinkedAttachment[] | undefined = formatService.getCredentialLinkedAttachments(proposal)

    const message: V2ProposeCredentialMessage = new V2ProposeCredentialMessage(formatService.generateId(), formats, filtersAttach, proposal.comment, credentialDefinitionId, preview)

    const props: CredentialRecordProps = {
      connectionId: proposal.connectionId,
      threadId: message.threadId,
      state: CredentialState.ProposalSent,
      linkedAttachments: linkedAttachments?.map((lkattachment) => lkattachment.attachment),
      credentialAttributes: credentialAttributes,
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

    // might need this one day
    // let options: ProposeCredentialOptions | undefined
    // if (message.filtersAttach.data.base64) {
    //   options = JsonEncoder.fromBase64(message.filtersAttach.data.base64)
    // }
    const props: CredentialRecordProps = {
      connectionId: connectionId,
      threadId: message.threadId,
      proposalMessage: message,
      state: CredentialState.ProposalReceived,
      credentialAttributes: message.credentialProposal?.attributes,
    }
    return new CredentialRecord(props)
  }
}

