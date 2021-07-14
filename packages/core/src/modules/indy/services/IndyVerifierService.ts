import type * as Indy from 'indy-sdk'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'

@scoped(Lifecycle.ContainerScoped)
export class IndyVerifierService {
  private indy: typeof Indy

  public constructor(agentConfig: AgentConfig) {
    this.indy = agentConfig.agentDependencies.indy
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
