import type { IInMemoryVerifierSessionManager } from './InMemoryVerifierSessionManager'
import type { VerifiedProofResponse } from './OpenId4VcVerifierServiceOptions'
import type { Express } from 'express'

export type ProofResponseHandlerReturn = { status: number }
export type ProofResponseHandler = (verifiedProofResponse: VerifiedProofResponse) => Promise<ProofResponseHandlerReturn>

export interface EndpointConfig {
  app: Express
  verificationEndpointPath: string
  proofResponseHandler?: ProofResponseHandler
}
export interface OpenId4VcVerifierModuleConfigOptions {
  sessionManager?: IInMemoryVerifierSessionManager
  endpointConfig?: EndpointConfig
}

export class OpenId4VcVerifierModuleConfig {
  private options: OpenId4VcVerifierModuleConfigOptions

  public constructor(options: OpenId4VcVerifierModuleConfigOptions) {
    this.options = options
  }

  public get endpointConfig() {
    return this.options.endpointConfig
  }

  public get sessionManager() {
    return this.options.sessionManager
  }
}
