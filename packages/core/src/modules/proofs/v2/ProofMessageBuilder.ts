import type { AgentMessage } from '../../../agent/AgentMessage'
import type { ProofRecordProps } from '../repository'
import type { ProofFormatService } from './formats/ProofFormatService'
import type { ProposeProofOptions } from './interface'

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

    const message: V2ProposalPresentationMessage = new V2ProposalPresentationMessage(
      formatService.generateId(),
      formats,
      filtersAttach,
      proposal.comment,
      preview
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
