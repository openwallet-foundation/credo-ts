import type {
  OpenId4VcCreateAuthorizationRequestOptions,
  OpenId4VcVerifyAuthorizationResponseOptions,
  OpenId4VcAuthorizationRequestWithMetadata,
  VerifiedOpenId4VcAuthorizationResponse,
} from './OpenId4VcVerifierServiceOptions'

import { injectable, AgentContext } from '@aries-framework/core'

import { OpenId4VcVerifierModuleConfig } from './OpenId4VcVerifierModuleConfig'
import { OpenId4VcVerifierService } from './OpenId4VcVerifierService'

/**
 * @public
 */
@injectable()
export class OpenId4VcVerifierApi {
  public constructor(
    public readonly config: OpenId4VcVerifierModuleConfig,
    private agentContext: AgentContext,
    private openId4VcVerifierService: OpenId4VcVerifierService
  ) {}

  /**
   * Retrieve all verifier records from storage
   */
  public async getAllVerifiers() {
    return this.openId4VcVerifierService.getAllVerifiers(this.agentContext)
  }

  /**
   * Retrieve a verifier record from storage by its verified id
   */
  public async getByVerifierId(verifierId: string) {
    return this.openId4VcVerifierService.getByVerifierId(this.agentContext, verifierId)
  }

  /**
   * Create a new verifier and store the new verifier record.
   */
  public async createVerifier() {
    return this.openId4VcVerifierService.createVerifier(this.agentContext)
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
   * See {@link OpenId4VcCreateAuthorizationRequestOptions} for detailed documentation on the options.
   */
  public async createAuthorizationRequest({
    verifiedId,
    ...otherOptions
  }: OpenId4VcCreateAuthorizationRequestOptions & {
    verifiedId: string
  }): Promise<OpenId4VcAuthorizationRequestWithMetadata> {
    const verifier = await this.getByVerifierId(verifiedId)
    return await this.openId4VcVerifierService.createAuthorizationRequest(this.agentContext, {
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
  }: OpenId4VcVerifyAuthorizationResponseOptions & {
    verifierId: string
  }): Promise<VerifiedOpenId4VcAuthorizationResponse> {
    const verifier = await this.getByVerifierId(verifierId)
    return await this.openId4VcVerifierService.verifyProofResponse(this.agentContext, {
      ...otherOptions,
      verifier,
    })
  }
}
