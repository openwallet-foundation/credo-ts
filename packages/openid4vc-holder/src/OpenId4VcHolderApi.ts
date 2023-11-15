import type {
  ResolvedCredentialOffer,
  AuthCodeFlowOptions,
  AcceptCredentialOfferOptions,
  ResolvedAuthorizationRequest,
  AuthenticationRequest,
  PresentationRequest,
} from './OpenId4VcHolderServiceOptions'
import type { PresentationSubmission } from './presentations'
import type { VerificationMethod, W3cCredentialRecord } from '@aries-framework/core'
import type { CredentialOfferPayloadV1_0_11 } from '@sphereon/oid4vci-common'

import { injectable, AgentContext } from '@aries-framework/core'

import { OpenId4VcHolderService } from './issuance/OpenId4VciHolderService'
import { OpenId4VpHolderService } from './presentations'

/**
 * @public
 */
@injectable()
export class OpenId4VcHolderApi {
  private agentContext: AgentContext
  private openId4VcHolderService: OpenId4VcHolderService
  private openId4VpHolderService: OpenId4VpHolderService

  public constructor(
    agentContext: AgentContext,
    openId4VcHolderService: OpenId4VcHolderService,
    openId4VpHolderService: OpenId4VpHolderService
  ) {
    this.agentContext = agentContext
    this.openId4VcHolderService = openId4VcHolderService
    this.openId4VpHolderService = openId4VpHolderService
  }

  /**
   * Resolves the authentication request given as URI or JWT to a unified format, and
   * verifies the validity of the request.
   * The resolved request can be accepted with either @see acceptAuthenticationRequest if it is a
   * authentication request or with @see acceptPresentationRequest if it is a proofRequest.
   *
   * @param requestJwtOrUri JWT or an openid:// URI
   * @returns the resolved and verified authentication request or presentation request alongside the data required to fulfill the presentation request.
   */
  public async resolveProofRequest(requestJwtOrUri: string) {
    return await this.openId4VpHolderService.resolveProofRequest(this.agentContext, requestJwtOrUri)
  }

  /**
   * Accepts the authentication request after it has been resolved and verified with @see resolveProofRequest.
   *
   * @param authenticationRequest - The verified authorization request object.
   * @param verificationMethod - The method used for creating the authentication proof.
   * @returns @see ProofSubmissionResponse containing the status of the submission.
   */
  public async acceptAuthenticationRequest(
    authenticationRequest: AuthenticationRequest,
    verificationMethod: VerificationMethod
  ) {
    return await this.openId4VpHolderService.acceptAuthenticationRequest(
      this.agentContext,
      verificationMethod,
      authenticationRequest
    )
  }

  /**
   * Accepts the proof request with a presentation after it has been resolved and verified @see resolveProofRequest.
   *
   * @param presentationRequest - The verified authorization request object containing the presentation definition.
   * @param presentation.submission - The presentation submission object obtained from @see resolveProofRequest
   * @param presentation.submissionEntryIndexes - The indexes of the credentials in the presentation submission that should be send to the verifier.
   * @returns @see ProofSubmissionResponse containing the status of the submission.
   */
  public async acceptPresentationRequest(
    presentationRequest: PresentationRequest,
    presentation: {
      submission: PresentationSubmission
      submissionEntryIndexes: number[]
    }
  ) {
    const { submission, submissionEntryIndexes } = presentation
    return await this.openId4VpHolderService.acceptProofRequest(this.agentContext, presentationRequest, {
      submission,
      submissionEntryIndexes: submissionEntryIndexes,
    })
  }

  /**
   * Resolves a credential offer given as payload, credential offer URL, or issuance initiation URL,
   * into a unified format.
   *
   * @param credentialOffer the credential offer to resolve
   * @returns The uniform credential offer payload, the issuer metadata, protocol version, and credentials that can be requested.
   */
  public async resolveCredentialOffer(credentialOffer: string | CredentialOfferPayloadV1_0_11) {
    return await this.openId4VcHolderService.resolveCredentialOffer(credentialOffer)
  }

  /**
   * This function is to be used with the Authorization Code Flow.
   * It will generate the authorization request URI based on the provided options.
   * The authorization request URI is used to obtain the authorization code. Currently this needs to be done manually.
   *
   * Authorization to request credentials can be requested via authorization_details or scopes.
   * This function automatically generates the authorization_details for all offered credentials.
   * If scopes are provided, the provided scopes are send alongside the authorization_details.
   *
   * @param resolvedCredentialOffer Obtained through @see resolveCredentialOffer
   * @param authCodeFlowOptions
   * @returns The authorization request URI alongside the code verifier and original @param authCodeFlowOptions
   */
  public async resolveAuthorizationRequest(
    resolvedCredentialOffer: ResolvedCredentialOffer,
    authCodeFlowOptions: AuthCodeFlowOptions
  ) {
    return await this.openId4VcHolderService.resolveAuthorizationRequest(
      this.agentContext,
      resolvedCredentialOffer,
      authCodeFlowOptions
    )
  }

  /**
   * Accepts a credential offer using the pre-authorized code flow.
   * @param resolvedCredentialOffer Obtained through @see resolveCredentialOffer
   * @param acceptCredentialOfferOptions
   * @returns W3cCredentialRecord[]
   */
  public async acceptCredentialOfferUsingPreAuthorizedCode(
    resolvedCredentialOffer: ResolvedCredentialOffer,
    acceptCredentialOfferOptions: AcceptCredentialOfferOptions
  ): Promise<W3cCredentialRecord[]> {
    return this.openId4VcHolderService.acceptCredentialOffer(this.agentContext, {
      resolvedCredentialOffer,
      acceptCredentialOfferOptions,
    })
  }

  /**
   * Accepts a credential offer using the authorization code flow.
   * @param resolvedCredentialOffer Obtained through @see resolveCredentialOffer
   * @param resolvedAuthorizationRequest Obtained through @see resolveAuthorizationRequest
   * @param code The authorization code obtained via the authorization request URI
   * @param acceptCredentialOfferOptions
   * @returns W3cCredentialRecord[]
   */
  public async acceptCredentialOfferUsingAuthorizationCode(
    resolvedCredentialOffer: ResolvedCredentialOffer,
    resolvedAuthorizationRequest: ResolvedAuthorizationRequest,
    code: string,
    acceptCredentialOfferOptions: AcceptCredentialOfferOptions
  ): Promise<W3cCredentialRecord[]> {
    return this.openId4VcHolderService.acceptCredentialOffer(this.agentContext, {
      resolvedCredentialOffer,
      resolvedAuthorizationRequest: { ...resolvedAuthorizationRequest, code },
      acceptCredentialOfferOptions,
    })
  }
}
