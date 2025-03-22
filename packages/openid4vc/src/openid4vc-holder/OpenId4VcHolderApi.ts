import type {
  OpenId4VciAuthCodeFlowOptions,
  OpenId4VciCredentialRequestOptions as OpenId4VciRequestCredentialOptions,
  OpenId4VciTokenRequestOptions as OpenId4VciRequestTokenOptions,
  OpenId4VciRequestTokenResponse,
  OpenId4VciResolvedCredentialOffer,
  OpenId4VciRetrieveAuthorizationCodeUsingPresentationOptions,
  OpenId4VciSendNotificationOptions,
} from './OpenId4VciHolderServiceOptions'
import type {
  OpenId4VpAcceptAuthorizationRequestOptions,
  ResolveOpenId4VpAuthorizationRequestOptions,
} from './OpenId4vpHolderServiceOptions'

import {
  AgentContext,
  DcqlQueryResult,
  DcqlService,
  DifPexCredentialsForRequest,
  DifPresentationExchangeService,
  injectable,
} from '@credo-ts/core'

import { OpenId4VciMetadata } from '../shared'

import { OpenId4VciHolderService } from './OpenId4VciHolderService'
import { OpenId4VpHolderService } from './OpenId4vpHolderService'

/**
 * @public
 */
@injectable()
export class OpenId4VcHolderApi {
  public constructor(
    private agentContext: AgentContext,
    private openId4VciHolderService: OpenId4VciHolderService,
    private openId4VpHolderService: OpenId4VpHolderService,
    private difPresentationExchangeService: DifPresentationExchangeService,
    private dcqlService: DcqlService
  ) {}

  /**
   * Resolves the authentication request given as URI or JWT to a unified format, and
   * verifies the validity of the request.
   *
   * The resolved request can be accepted with the @see acceptOpenId4VpAuthorizationRequest.
   *
   * If the authorization request uses OpenID4VP and included presentation definitions,
   * a `presentationExchange` property will be defined with credentials that satisfy the
   * incoming request. When `presentationExchange` is present, you MUST supply `presentationExchange`
   * when calling `acceptOpenId4VpAuthorizationRequest` as well.
   *
   * @param request
   * Can be:
   * - JWT
   * - URI containing request or request_uri param
   * - Request payload
   * @returns the resolved and verified authentication request.
   */
  public async resolveOpenId4VpAuthorizationRequest(
    request: string | Record<string, unknown>,
    options?: ResolveOpenId4VpAuthorizationRequestOptions
  ) {
    return this.openId4VpHolderService.resolveAuthorizationRequest(this.agentContext, request, options)
  }

  /**
   * Accepts the authentication request after it has been resolved and verified with {@link resolveOpenId4VpAuthorizationRequest}.
   *
   * If the resolved authorization request included a `presentationExchange` property, you MUST supply `presentationExchange`
   * in the `options` parameter. The same is true for `dcql`.
   *
   * For response mode of `direct_post` or `direct_post.jwt` the response will be submitted directly
   * to the response url. For `dc_api` and `dc_api.jwt` the response will be returned but without a
   * `serverResponse`, and you have to submit the response yourself.
   */
  public async acceptOpenId4VpAuthorizationRequest(options: OpenId4VpAcceptAuthorizationRequestOptions) {
    return await this.openId4VpHolderService.acceptAuthorizationRequest(this.agentContext, options)
  }

  /**
   * Automatically select credentials from available credentials for a presentation exchange request. Can be called after calling
   * @see resolveOpenId4VpAuthorizationRequest.
   */
  public selectCredentialsForPresentationExchangeRequest(credentialsForRequest: DifPexCredentialsForRequest) {
    return this.difPresentationExchangeService.selectCredentialsForRequest(credentialsForRequest)
  }

  /**
   * Automatically select credentials from available credentials for a dcql request. Can be called after calling
   * @see resolveOpenId4VpAuthorizationRequest.
   */
  public selectCredentialsForDcqlRequest(dcqlQueryResult: DcqlQueryResult) {
    return this.dcqlService.selectCredentialsForRequest(dcqlQueryResult)
  }

  public async resolveIssuerMetadata(credentialIssuer: string): Promise<OpenId4VciMetadata> {
    return await this.openId4VciHolderService.resolveIssuerMetadata(this.agentContext, credentialIssuer)
  }

  /**
   * Resolves a credential offer given as credential offer URL, or issuance initiation URL,
   * into a unified format with metadata.
   *
   * @param credentialOffer the credential offer to resolve
   * @returns The uniform credential offer payload, the issuer metadata, protocol version, and the offered credentials with metadata.
   */
  public async resolveCredentialOffer(credentialOffer: string) {
    return await this.openId4VciHolderService.resolveCredentialOffer(this.agentContext, credentialOffer)
  }

  /**
   * This function is to be used to receive an credential in OpenID4VCI using the Authorization Code Flow.
   *
   * Not to be confused with the {@link resolveOpenId4VpAuthorizationRequest}, which is only used for OpenID4VP requests.
   *
   * It will generate an authorization session based on the provided options.
   *
   * There are two possible flows:
   * - Oauth2Recirect: an authorization request URI is returend which can be used to obtain the authorization code.
   *   This needs to be done manually (e.g. by opening a browser window)
   * - PresentationDuringIssuance: an openid4vp presentation request needs to be handled. A oid4vpRequestUri is returned
   *   which can be parsed using `resolveOpenId4VpAuthorizationRequest`. After the presentation session has been completed,
   *   the resulting `presentationDuringIssuanceSession` can be used to obtain an authorization code
   *
   * Authorization to request credentials can be requested via authorization_details or scopes.
   * This function automatically generates the authorization_details for all offered credentials.
   * If scopes are provided, the provided scopes are sent alongside the authorization_details.
   *
   * @param resolvedCredentialOffer Obtained through @see resolveCredentialOffer
   * @param authCodeFlowOptions
   * @returns The authorization request URI alongside the code verifier and original @param authCodeFlowOptions
   */
  public async resolveOpenId4VciAuthorizationRequest(
    resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer,
    authCodeFlowOptions: OpenId4VciAuthCodeFlowOptions
  ) {
    return await this.openId4VciHolderService.resolveAuthorizationRequest(
      this.agentContext,
      resolvedCredentialOffer,
      authCodeFlowOptions
    )
  }

  /**
   * Retrieve an authorization code using an `presentationDuringIssuanceSession`.
   *
   * The authorization code can be exchanged for an `accessToken` @see requestToken
   */
  public async retrieveAuthorizationCodeUsingPresentation(
    options: OpenId4VciRetrieveAuthorizationCodeUsingPresentationOptions
  ) {
    return await this.openId4VciHolderService.retrieveAuthorizationCodeUsingPresentation(this.agentContext, options)
  }

  /**
   * Requests the token to be used for credential requests.
   */
  public async requestToken(options: OpenId4VciRequestTokenOptions): Promise<OpenId4VciRequestTokenResponse> {
    const { accessTokenResponse, dpop } = await this.openId4VciHolderService.requestAccessToken(
      this.agentContext,
      options
    )

    return {
      accessToken: accessTokenResponse.access_token,
      cNonce: accessTokenResponse.c_nonce,
      dpop,
      accessTokenResponse,
    }
  }

  /**
   * Request a set of credentials from the credential isser.
   * Can be used with both the pre-authorized code flow and the authorization code flow.
   */
  public async requestCredentials(options: OpenId4VciRequestCredentialOptions) {
    const { resolvedCredentialOffer, cNonce, accessToken, dpop, clientId, ...credentialRequestOptions } = options

    return this.openId4VciHolderService.acceptCredentialOffer(this.agentContext, {
      resolvedCredentialOffer,
      acceptCredentialOfferOptions: credentialRequestOptions,
      accessToken,
      cNonce,
      dpop,
      clientId,
    })
  }

  /**
   * Send a notification event to the credential issuer
   */
  public async sendNotification(options: OpenId4VciSendNotificationOptions) {
    return this.openId4VciHolderService.sendNotification(this.agentContext, options)
  }
}
