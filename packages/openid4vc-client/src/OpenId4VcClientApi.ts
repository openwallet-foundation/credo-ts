import type {
  GenerateAuthorizationUrlOptions,
  PreAuthCodeFlowOptions,
  AuthCodeFlowOptions,
} from './OpenId4VcClientServiceOptions'
import type { W3cCredentialRecord } from '@aries-framework/core'

import { AgentContext, injectable } from '@aries-framework/core'

import { OpenId4VcClientService } from './OpenId4VcClientService'
import { AuthFlowType } from './OpenId4VcClientServiceOptions'

/**
 * @public
 */
@injectable()
export class OpenId4VcClientApi {
  private agentContext: AgentContext
  private openId4VcClientService: OpenId4VcClientService

  public constructor(agentContext: AgentContext, openId4VcClientService: OpenId4VcClientService) {
    this.agentContext = agentContext
    this.openId4VcClientService = openId4VcClientService
  }

  public async requestCredentialUsingPreAuthorizedCode(
    options: PreAuthCodeFlowOptions
  ): Promise<W3cCredentialRecord[]> {
    // set defaults
    const verifyRevocationState = options.verifyCredentialStatus ?? true

    return this.openId4VcClientService.requestCredential(this.agentContext, {
      ...options,
      verifyCredentialStatus: verifyRevocationState,
      flowType: AuthFlowType.PreAuthorizedCodeFlow,
    })
  }

  public async requestCredentialUsingAuthorizationCode(options: AuthCodeFlowOptions): Promise<W3cCredentialRecord[]> {
    // set defaults
    const checkRevocationState = options.verifyCredentialStatus ?? true

    return this.openId4VcClientService.requestCredential(this.agentContext, {
      ...options,
      verifyCredentialStatus: checkRevocationState,
      flowType: AuthFlowType.AuthorizationCodeFlow,
    })
  }

  public async generateAuthorizationUrl(options: GenerateAuthorizationUrlOptions) {
    return this.openId4VcClientService.generateAuthorizationUrl(options)
  }
}
