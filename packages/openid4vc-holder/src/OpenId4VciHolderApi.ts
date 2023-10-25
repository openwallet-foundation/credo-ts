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

import { OpenId4VcHolderService } from './OpenId4VciHolderService'
import { OpenId4VpHolderService } from './presentations/OpenId4VpHolderService'

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

  public async resolveCredentialOffer(credentialOffer: string | CredentialOfferPayloadV1_0_11) {
    const resolved = await this.openId4VcHolderService.resolveCredentialOffer(credentialOffer)
    return resolved
  }

  public async resolveAuthorizationRequest(
    resolvedCredentialOffer: ResolvedCredentialOffer,
    authCodeFlowOptions: AuthCodeFlowOptions
  ) {
    const uri = await this.openId4VcHolderService.resolveAuthorizationRequest(
      resolvedCredentialOffer,
      authCodeFlowOptions
    )
    return uri
  }

  public async acceptCredentialOfferUsingPreAuthorizedCode(
    resolvedCredentialOffer: ResolvedCredentialOffer,
    options: AcceptCredentialOfferOptions
  ): Promise<W3cCredentialRecord[]> {
    return this.openId4VcHolderService.acceptCredentialOffer(this.agentContext, {
      resolvedCredentialOffer,
      acceptCredentialOfferOptions: options,
    })
  }

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
