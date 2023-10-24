import type {
  PreAuthCodeFlowOptions,
  AuthCodeFlowOptions,
  ResolvedCredentialOffer,
} from './OpenId4VcHolderServiceOptions'
import type { W3cCredentialRecord } from '@aries-framework/core'
import type { CredentialOfferPayloadV1_0_11 } from '@sphereon/oid4vci-common'

import { injectable, AgentContext } from '@aries-framework/core'

import { OpenId4VcHolderService } from './OpenId4VcHolderService'
import { AuthFlowType } from './OpenId4VcHolderServiceOptions'

/**
 * @public
 */
@injectable()
export class OpenId4VcHolderApi {
  private agentContext: AgentContext
  private openId4VcHolderService: OpenId4VcHolderService

  public constructor(agentContext: AgentContext, openId4VcHolderService: OpenId4VcHolderService) {
    this.agentContext = agentContext
    this.openId4VcHolderService = openId4VcHolderService
  }

  public async resolveCredentialOffer(credentialOffer: string | CredentialOfferPayloadV1_0_11) {
    const resolved = await this.openId4VcHolderService.resolveCredentialOffer(credentialOffer)
    return resolved
  }

  public async acceptCredentialOfferUsingPreAuthorizedCode(
    resolvedCredentialOffer: ResolvedCredentialOffer,
    options: PreAuthCodeFlowOptions
  ): Promise<W3cCredentialRecord[]> {
    // set defaults
    const verifyRevocationState = options.verifyCredentialStatus ?? true

    return this.openId4VcHolderService.acceptCredentialOffer(this.agentContext, {
      ...resolvedCredentialOffer,
      ...options,
      verifyCredentialStatus: verifyRevocationState,
      flowType: AuthFlowType.PreAuthorizedCodeFlow,
    })
  }

  public async acceptCredentialOfferUsingAuthorizationCode(
    resolvedCredentialOffer: ResolvedCredentialOffer,
    options: AuthCodeFlowOptions
  ): Promise<W3cCredentialRecord[]> {
    // set defaults
    const checkRevocationState = options.verifyCredentialStatus ?? true

    return this.openId4VcHolderService.acceptCredentialOffer(this.agentContext, {
      ...resolvedCredentialOffer,
      ...options,
      verifyCredentialStatus: checkRevocationState,
      flowType: AuthFlowType.AuthorizationCodeFlow,
    })
  }
}
