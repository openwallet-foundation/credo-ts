import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ProofRecord } from '../repository'
import type { ProofService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { AutoAcceptProof } from '../../../types'
import { ProofUtils } from '../ProofUtils'
import { RequestPresentationMessage } from '../messages'

export class RequestPresentationHandler implements Handler {
  private proofService: ProofService
  private agentConfig: AgentConfig
  public supportedMessages = [RequestPresentationMessage]

  public constructor(proofService: ProofService, agentConfig: AgentConfig) {
    this.proofService = proofService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<RequestPresentationHandler>) {
    const proofRecord = await this.proofService.processRequest(messageContext)

    const autoAccept = ProofUtils.composeAutoAccept(proofRecord.autoAcceptProof, this.agentConfig.autoAcceptProofs)

    if (autoAccept === AutoAcceptProof.always) {
      return await this.nextStep(proofRecord, messageContext)
    }
  }

  private async nextStep(proofRecord: ProofRecord, messageContext: HandlerInboundMessage<RequestPresentationHandler>) {
    const indyProofRequest = proofRecord.requestMessage?.indyProofRequest
    //TODO: how can I get the credentials without access to the agent
    // const retrievedCredentials = await aliceAgent.proofs.getRequestedCredentialsForProofRequest(
    //   indyProofRequest!,
    //   presentationPreview
    // )
    // const requestedCredentials = aliceAgent.proofs.autoSelectCredentialsForProofRequest(retrievedCredentials)

    const { message } = await this.proofService.createPresentation(proofRecord, requestedCredentials)

    return createOutboundMessage(messageContext.connection!, message)
  }
}
