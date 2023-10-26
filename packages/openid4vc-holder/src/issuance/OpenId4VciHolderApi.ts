import type {
  ResolvedCredentialOffer,
  AuthCodeFlowOptions,
  AcceptCredentialOfferOptions,
  ResolvedAuthorizationRequest,
} from './OpenId4VciHolderServiceOptions'
import type { VerificationMethod, W3cCredentialRecord } from '@aries-framework/core'
import type { VerifiedAuthorizationRequest } from '@sphereon/did-auth-siop'
import type { CredentialOfferPayloadV1_0_11 } from '@sphereon/oid4vci-common'

import { injectable, AgentContext } from '@aries-framework/core'

import { OpenId4VpHolderService } from '../presentations/OpenId4VpHolderService'

import { OpenId4VcHolderService } from './OpenId4VciHolderService'

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

  public async resolveRequest(uri: string) {
    const resolved = await this.openId4VpHolderService.resolveAuthenticationRequest(this.agentContext, uri)
    return resolved
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
    const resolvedCredentialOffer = await this.openId4VcHolderService.resolveCredentialOffer(credentialOffer)
    return resolvedCredentialOffer
  }

  /**
   * This function is to be used with the Authorization Code Flow.
   * It will generate the authorization request URI based on the provided options.
   * The authorization request URI is used to obtain the authorization code. Currently this needs to be done manually.
   * @param resolvedCredentialOffer Obtained through @function resolveCredentialOffer
   * @param authCodeFlowOptions
   * @returns The authorization request URI alongside the code verifier and original @param authCodeFlowOptions
   */
  public async resolveAuthorizationRequest(
    resolvedCredentialOffer: ResolvedCredentialOffer,
    authCodeFlowOptions: AuthCodeFlowOptions
  ) {
    const resolvedAuthorizationRequest = await this.openId4VcHolderService.resolveAuthorizationRequest(
      resolvedCredentialOffer,
      authCodeFlowOptions
    )
    return resolvedAuthorizationRequest
  }

  /**
   * Accepts a credential offer using the pre-authorized code flow.
   * @param resolvedCredentialOffer Obtained through @function resolveCredentialOffer
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
   * @param resolvedCredentialOffer Obtained through @function resolveCredentialOffer
   * @param resolvedAuthorizationRequest Obtained through @function resolveAuthorizationRequest
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
