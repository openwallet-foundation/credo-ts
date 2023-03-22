import type {
  GenerateAuthorizationUrlOptions,
  PreAuthCodeFlowOptions,
  AuthCodeFlowOptions,
} from './OpenId4VcClientService'
import type { W3cCredentialRecord } from '@aries-framework/core'

import { AgentContext, injectable } from '@aries-framework/core'

import { AuthFlowType, OpenId4VcClientService } from './OpenId4VcClientService'

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

  public async requestCredentialUsingPreAuthorizedCode(options: PreAuthCodeFlowOptions): Promise<W3cCredentialRecord> {
    // set defaults
    const verifyRevocationState = options.verifyRevocationState ?? true

    return this.openId4VcClientService.requestCredential(this.agentContext, {
      ...options,
      verifyRevocationState: verifyRevocationState,
      flowType: AuthFlowType.PreAuthorizedCodeFlow,
    })
  }

  public async requestCredentialUsingAuthorizationCode(options: AuthCodeFlowOptions): Promise<W3cCredentialRecord> {
    // set defaults
    const checkRevocationState = options.verifyRevocationState ?? true

    return this.openId4VcClientService.requestCredential(this.agentContext, {
      ...options,
      verifyRevocationState: checkRevocationState,
      flowType: AuthFlowType.AuthorizationCodeFlow,
    })
  }

  public async generateAuthorizationUrl(options: GenerateAuthorizationUrlOptions) {
    return this.openId4VcClientService.generateAuthorizationUrl(options)
  }
}
