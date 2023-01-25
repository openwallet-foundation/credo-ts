import type { W3cCredentialRecord } from '@aries-framework/core'

import { AgentContext, injectable } from '@aries-framework/core'

import { OpenId4VcClientService } from './OpenId4VcClientService'

interface PreAuthorizedOptions {
  issuerUri: string
  kid: string
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

  public async preAuthorized(options: PreAuthorizedOptions): Promise<W3cCredentialRecord> {
    return this.openId4VcClientService.preAuthorized(this.agentContext, options)
  }
}
