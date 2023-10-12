import { AgentContext, injectable } from '@aries-framework/core'

import { SdJwtService } from './SdJwtService'

/**
 * @public
 */
@injectable()
export class SdJwtApi {
  private agentContext: AgentContext
  private sdJwtService: SdJwtService

  public constructor(agentContext: AgentContext, sdJwtService: SdJwtService) {
    this.agentContext = agentContext
    this.sdJwtService = sdJwtService
  }
}
