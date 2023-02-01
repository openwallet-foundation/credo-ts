import type { W3cCredentialRecord } from '@aries-framework/core'

import { AgentContext, injectable } from '@aries-framework/core'

import { OpenId4VcClientService } from './OpenId4VcClientService'

interface PreAuthorizedOptions {
  issuerUri: string
  kid: string
  checkRevocationState?: boolean // default = true
}

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

  public async requestCredentialPreAuthorized(options: PreAuthorizedOptions): Promise<W3cCredentialRecord> {
    // set defaults
    const checkRevocationState = options.checkRevocationState ?? true

    return this.openId4VcClientService.requestCredentialPreAuthorized(this.agentContext, {
      ...options,
      checkRevocationState: checkRevocationState,
    })
  }
}
