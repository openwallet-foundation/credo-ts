import type {
  CreateProofRequestOptions,
  ProofPayload,
  VerifyProofResponseOptions,
} from './OpenId4VcVerifierServiceOptions'

import { injectable, AgentContext } from '@aries-framework/core'

import { OpenId4VcVerifierService } from './OpenId4VcVerifierService'

/**
 * @public
 */
@injectable()
export class OpenId4VcVerifierApi {
  private agentContext: AgentContext
  private openId4VcVerifierService: OpenId4VcVerifierService

  public constructor(agentContext: AgentContext, openId4VcVerifierService: OpenId4VcVerifierService) {
    this.agentContext = agentContext
    this.openId4VcVerifierService = openId4VcVerifierService
  }

  /**
   * Creates a proof request with the provided options.
   * The proof request can be a SIOP request (authentication) or VP request querying verifiable credentials).
   * Metadata about the holder can be provided by either passing the @see HolderClientMetadata or by passing the issuer URL.
   * If the issuer URL is provided, the metadata will be retrieved from the issuer hosted OpenID configuration.
   * If neither the holder metadata nor the issuer URL is provided, a static configuration defined in @link https://openid.net/specs/openid-connect-self-issued-v2-1_0.html#name-static-configuration-values
   * If a presentation definition is provided, a VP request will be created, querying the holder verifiable credentials according to the specifics of the presentation definition.
   * @param options.verificationMethod - The method used for verification.
   * @param options.redirect_url - The URL to redirect to after verification.
   * @param options.holderClientMetadata - Optional metadata about the holder client.
   * @param options.issuer - Optional issuer of the proof request.
   * @param options.presentationDefinition - Optional presentation definition for the proof request.
   * @returns @see ProofRequestWithMetadata object containing the proof request and metadata for verifying the proof response.
   */
  public async createProofRequest(options: CreateProofRequestOptions) {
    return await this.openId4VcVerifierService.createProofRequest(this.agentContext, options)
  }

  /**
   * Verifies a proof response with the provided options.
   * The proof response validates the idToken, the signature of the received Verifiable Presentation,
   * as well as that the structure of the Verifiable Presentation matches the provided presentation definition.
   *
   * @param options.createProofRequestOptions - The options used to create the proof request.
   * @param options.proofRequestMetadata - Metadata about the proof request.
   * @returns @see VerifiedProofResponse object containing the idTokenPayload and the verified submission.
   */
  public async verifyProofResponse(proofPayload: ProofPayload, options: VerifyProofResponseOptions) {
    return await this.openId4VcVerifierService.verifyProofResponse(this.agentContext, proofPayload, options)
  }
}
