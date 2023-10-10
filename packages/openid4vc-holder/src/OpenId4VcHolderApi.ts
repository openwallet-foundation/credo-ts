import type {
  GenerateAuthorizationUrlOptions,
  PreAuthCodeFlowOptions,
  AuthCodeFlowOptions,
} from './OpenId4VcHolderServiceOptions'
import type { W3cCredentialRecord } from '@aries-framework/core'

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

  public async requestCredentialUsingPreAuthorizedCode(
    options: PreAuthCodeFlowOptions
  ): Promise<W3cCredentialRecord[]> {
    // set defaults
    const verifyRevocationState = options.verifyCredentialStatus ?? true

    return this.openId4VcHolderService.requestCredential(this.agentContext, {
      ...options,
      verifyCredentialStatus: verifyRevocationState,
      flowType: AuthFlowType.PreAuthorizedCodeFlow,
    })
  }

  public async requestCredentialUsingAuthorizationCode(options: AuthCodeFlowOptions): Promise<W3cCredentialRecord[]> {
    // set defaults
    const checkRevocationState = options.verifyCredentialStatus ?? true

    return this.openId4VcHolderService.requestCredential(this.agentContext, {
      ...options,
      verifyCredentialStatus: checkRevocationState,
      flowType: AuthFlowType.AuthorizationCodeFlow,
    })
  }

  public async generateAuthorizationUrl(options: GenerateAuthorizationUrlOptions) {
    return this.openId4VcHolderService.generateAuthorizationUrl(options)
  }
}
