import type { IndyWallet } from '../../../wallet/IndyWallet'
import type Indy from 'indy-sdk'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'

@scoped(Lifecycle.ContainerScoped)
export class IndyVerifierService {
  private indy: typeof Indy
  private indyWallet: IndyWallet

  public constructor(@inject(InjectionSymbols.Indy) indy: typeof Indy, indyWallet: IndyWallet) {
    this.indy = indy
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
