import type {
  ResolvedCredentialOffer,
  AuthCodeFlowOptions,
  AcceptCredentialOfferOptions,
  ResolvedAuthorizationRequest,
} from './OpenId4VcHolderServiceOptions'
import type { VerificationMethod, W3cCredentialRecord } from '@aries-framework/core'
import type { ClientMetadataOpts, VerifiedAuthorizationRequest } from '@sphereon/did-auth-siop'
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

  public async createRequest(options: {
    verificationMethod: VerificationMethod
    redirect_url: string
    clientMetadata?: ClientMetadataOpts
    issuer?: string
  }) {
    const relyingParty = await this.openId4VpHolderService.getRelyingParty(this.agentContext, options)

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const randomValues = await Promise.all([...Array(4).keys()].map((_) => this.agentContext.wallet.generateNonce()))
    const nonce = randomValues[0] + randomValues[1]
    const state = randomValues[2]
    const correlationId = randomValues[3]

    const authorizationRequest = await relyingParty.createAuthorizationRequest({
      correlationId,
      nonce,
      state,
    })

    const authorizationRequestUri = await authorizationRequest.uri()
    const encodedAuthorizationRequestUri = authorizationRequestUri.encodedUri

    return {
      relyingParty,
      authorizationRequestUri: encodedAuthorizationRequestUri,
      correlationId,
      nonce,
      state,
    }
  }

  /**
   * Resolves the authentication request given as URI or JWT to a unified @class VerificationRequest,
   * then verifies the validity of the request and return the @class VerifiedAuthorizationRequest.
   * @param requestJwtOrUri JWT or an openid:// URI
   * @returns the Verified Authorization Request
   */
  public async resolveRequest(requestOrJwt: string) {
    return await this.openId4VpHolderService.resolveAuthorizationRequest(this.agentContext, requestOrJwt)
  }

  public async acceptRequest(verifiedRequest: VerifiedAuthorizationRequest, verificationMethod: VerificationMethod) {
    const resolved = await this.openId4VpHolderService.acceptRequest(
      this.agentContext,
      verifiedRequest,
      verificationMethod
    )
    return resolved
  }

  /**
   * Resolves a credential offer given as payload, credential offer URL, or issuance initiation URL,
   * into a unified format.`
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
