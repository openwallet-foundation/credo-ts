import {
  AuthCodeFlowOptions,
  AuthFlowType,
  GenerateAuthorizationUrlOptions,
  PreAuthCodeFlowOptions,
  RequestCredentialOptions,
} from './OpenId4VcClientService'
import type { W3cCredentialRecord } from '@aries-framework/core'

import { AgentContext, injectable } from '@aries-framework/core'

import { OpenId4VcClientService } from './OpenId4VcClientService'

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
    const checkRevocationState = options.checkRevocationState ?? true

    return this.openId4VcClientService.requestCredential(this.agentContext, {
      ...options,
      checkRevocationState: checkRevocationState,
      flowType: AuthFlowType.PRE_AUTHORIZED_CODE_FLOW,
    })
  }

  public async requestCredentialUsingAuthorizationCode(options: AuthCodeFlowOptions): Promise<W3cCredentialRecord> {
    // set defaults
    const checkRevocationState = options.checkRevocationState ?? true

    return this.openId4VcClientService.requestCredential(this.agentContext, {
      ...options,
      checkRevocationState: checkRevocationState,
      flowType: AuthFlowType.AUTHORIZATION_CODE_FLOW,
    })
  }

  public async generateCodeVerifier(): Promise<string> {
    return this.openId4VcClientService.generateCodeVerifier()
  }

  public async generateAuthorizationUrl(options: GenerateAuthorizationUrlOptions) {
    return this.openId4VcClientService.generateAuthorizationUrl(options)
  }
}
