import type {
  OpenId4VcSiopCreateAuthorizationRequestOptions,
  OpenId4VcSiopVerifyAuthorizationResponseOptions,
  OpenId4VcSiopCreateAuthorizationRequestReturn,
  OpenId4VcSiopVerifiedAuthorizationResponse,
} from './OpenId4VcSiopVerifierServiceOptions'

import { injectable, AgentContext } from '@credo-ts/core'

import { OpenId4VcSiopVerifierService } from './OpenId4VcSiopVerifierService'
import { OpenId4VcVerifierModuleConfig } from './OpenId4VcVerifierModuleConfig'

/**
 * @public
 */
@injectable()
export class OpenId4VcVerifierApi {
  public constructor(
    public readonly config: OpenId4VcVerifierModuleConfig,
    private agentContext: AgentContext,
    private openId4VcSiopVerifierService: OpenId4VcSiopVerifierService
  ) {}

  /**
   * Retrieve all verifier records from storage
   */
  public async getAllVerifiers() {
    return this.openId4VcSiopVerifierService.getAllVerifiers(this.agentContext)
  }

  /**
   * Retrieve a verifier record from storage by its verified id
   */
  public async getByVerifierId(verifierId: string) {
    return this.openId4VcSiopVerifierService.getByVerifierId(this.agentContext, verifierId)
  }

  /**
   * Create a new verifier and store the new verifier record.
   */
  public async createVerifier() {
    return this.openId4VcSiopVerifierService.createVerifier(this.agentContext)
  }

  /**
   * Create an authorization request, acting as a Relying Party (RP).
   *
   * Currently two types of requests are supported:
   *  - SIOP Self-Issued ID Token request: request to a Self-Issued OP from an RP
   *  - SIOP Verifiable Presentation Request: request to a Self-Issued OP from an RP, requesting a Verifiable Presentation using OpenID4VP
   *
   * Other flows (non-SIOP) are not supported at the moment, but can be added in the future.
   *
   * See {@link OpenId4VcSiopCreateAuthorizationRequestOptions} for detailed documentation on the options.
   */
  public async createAuthorizationRequest({
    verifierId,
    ...otherOptions
  }: OpenId4VcSiopCreateAuthorizationRequestOptions & {
    verifierId: string
  }): Promise<OpenId4VcSiopCreateAuthorizationRequestReturn> {
    const verifier = await this.getByVerifierId(verifierId)
    return await this.openId4VcSiopVerifierService.createAuthorizationRequest(this.agentContext, {
      ...otherOptions,
      verifier,
    })
  }

  /**
   * Verifies an authorization response, acting as a Relying Party (RP).
   *
   * It validates the ID Token, VP Token and the signature(s) of the received Verifiable Presentation(s)
   * as well as that the structure of the Verifiable Presentation matches the provided presentation definition.
   */
  public async verifyAuthorizationResponse({
    verifierId,
    ...otherOptions
  }: OpenId4VcSiopVerifyAuthorizationResponseOptions & {
    verifierId: string
  }): Promise<OpenId4VcSiopVerifiedAuthorizationResponse> {
    const verifier = await this.getByVerifierId(verifierId)
    return await this.openId4VcSiopVerifierService.verifyAuthorizationResponse(this.agentContext, {
      ...otherOptions,
      verifier,
    })
  }
}
