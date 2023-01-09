import { AgentContext, injectable } from '@aries-framework/core'

import { OidcClientService } from './OidcClientService'

/**
 * @public
 */
@injectable()
export class OidcClientApi {
  private agentContext: AgentContext
  private oidcClientService: OidcClientService

  public constructor(agentContext: AgentContext, oidcClientService: OidcClientService) {
    ;(this.agentContext = agentContext), (this.oidcClientService = oidcClientService)
  }
}
