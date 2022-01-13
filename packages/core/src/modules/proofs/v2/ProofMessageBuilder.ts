import type { AgentMessage } from '../../../agent/AgentMessage'
import type { ProofRecordProps } from '../repository'
import type { ProofFormatService } from './formats/ProofFormatService'
import type { ProposeProofOptions } from './interface'
import type { V2ProposePresentationMessageOptions } from './messages/V2ProposalPresentationMessage'

import { ProofState } from '../ProofState'
import { ProofRecord } from '../repository'

import { V2ProposalPresentationMessage } from './messages/V2ProposalPresentationMessage'

export interface ProofProtocolMsgReturnType<MessageType extends AgentMessage> {
  message: MessageType
  proofRecord: ProofRecord
}

export class ProofMessageBuilder {
  public createProposal(
    formatService: ProofFormatService,
    proposal: ProposeProofOptions,
    threadId?: string
  ): ProofProtocolMsgReturnType<V2ProposalPresentationMessage> {
    // create message
    const { preview, formats, filtersAttach } = formatService.getProofProposeAttachFormats(proposal, 'PRES_20_PROPOSAL')

    const v2ProposePresentationMessageOptions: V2ProposePresentationMessageOptions = {
      id: formatService.generateId(),
      formats,
      filtersAttach,
      comment: proposal.comment,
      presentationProposal: preview,
    }

    const message: V2ProposalPresentationMessage = new V2ProposalPresentationMessage(
      v2ProposePresentationMessageOptions
    )

    const props: ProofRecordProps = {
      connectionId: proposal.connectionId,
      threadId: threadId ? threadId : '',
      state: ProofState.ProposalSent,
      autoAcceptProof: proposal?.autoAcceptProof,
    }

    // Create record

    const proofRecord = new ProofRecord(props)
    proofRecord.proposalMessage = message // new V2 field

    return { message, proofRecord: proofRecord }
  }
}
