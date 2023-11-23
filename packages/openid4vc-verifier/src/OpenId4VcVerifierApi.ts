import type { CreateProofRequestOptions, EndpointConfig, ProofPayload } from './OpenId4VcVerifierServiceOptions'
import type { Router } from 'express'

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
   * The proof request can be a SIOP request (authentication) or VP request (querying verifiable credentials).
   * Metadata about the holder can be provided statically @see HolderClientMetadata or dynamically by providing the issuer URL.
   * If the issuer URL is provided, the metadata will be retrieved from the issuer hosted OpenID configuration endpoint.
   * If neither the holder metadata nor the issuer URL is provided, a static configuration defined in @link https://openid.net/specs/openid-connect-self-issued-v2-1_0.html#name-static-configuration-values
   * If a presentation definition is provided, a VP request will be created, querying the holder verifiable credentials according to the specifics of the presentation definition.
   *
   * @param options.redirectUri - The URL to redirect to after verification.
   * @param options.holderMetadata - Optional metadata about the holder.
   * @param options.holderIdentifier - Optional the identifier of the holder (OpenId-Provider) provider for performing dynamic discovery. How to identifier is obtained is out of scope.
   * @param options.presentationDefinition - Optional presentation definition for requesting the presentation of verifiable credentials.
   * @param options.verificationMethod - The VerificationMethod to use for signing the proof request.
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
   * @param proofPayload - The payload of the proof response.
   * @param options.createProofRequestOptions - The options used to create the proof request.
   * @param options.proofRequestMetadata - Metadata about the proof request.
   * @returns @see VerifiedProofResponse object containing the idTokenPayload and the verified submission.
   */
  public async verifyProofResponse(proofPayload: ProofPayload) {
    return await this.openId4VcVerifierService.verifyProofResponse(this.agentContext, proofPayload)
  }

  /**
   * Configures the enabled endpoints for the given router, as specified in @link https://openid.net/specs/openid-4-verifiable-presentations-1_0.html
   *
   * @param router - The router to configure.
   * @param endpointConfig - The endpoint configuration.
   * @returns The configured router.
   */
  public async configureRouter(router: Router, endpointConfig: EndpointConfig) {
    return await this.openId4VcVerifierService.configureRouter(this.agentContext, router, endpointConfig)
  }
}
