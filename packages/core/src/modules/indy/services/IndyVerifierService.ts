import type * as Indy from 'indy-sdk'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { IndyWallet } from '../../../wallet/IndyWallet'

@scoped(Lifecycle.ContainerScoped)
export class IndyVerifierService {
  private indy: typeof Indy
  private indyWallet: IndyWallet

  public constructor(agentConfig: AgentConfig, indyWallet: IndyWallet) {
    this.indy = agentConfig.agentDependencies.indy
    this.indyWallet = indyWallet
  }

  public verifyProof({
    proofRequest,
    proof,
    schemas,
    credentialDefinitions,
    revocationRegistryDefinitions = {},
    revocationStates = {},
  }: VerifyProofOptions): Promise<boolean> {
    return this.indy.verifierVerifyProof(
      proofRequest,
      proof,
      schemas,
      credentialDefinitions,
      revocationRegistryDefinitions,
      revocationStates
    )
  }
}

export interface VerifyProofOptions {
  proofRequest: Indy.IndyProofRequest
  proof: Indy.IndyProof
  schemas: Indy.Schemas
  credentialDefinitions: Indy.CredentialDefs
  revocationRegistryDefinitions?: Indy.RevRegsDefs
  revocationStates?: Indy.RevStates
}
