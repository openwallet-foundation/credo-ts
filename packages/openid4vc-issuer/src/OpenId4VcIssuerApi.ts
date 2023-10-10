import type { IssueCredentialOptions, SendCredentialOfferOptions } from './OpenId4VcIssuerServiceOptions'

import { injectable, AgentContext } from '@aries-framework/core'

import { OpenId4VcIssuerService } from './OpenId4VcIssuerService'

/**
 * @public
 */
@injectable()
export class OpenId4VcIssuerApi {
  private agentContext: AgentContext
  private openId4VcIssuerService: OpenId4VcIssuerService

  public constructor(agentContext: AgentContext, openId4VcIssuerService: OpenId4VcIssuerService) {
    this.agentContext = agentContext
    this.openId4VcIssuerService = openId4VcIssuerService
  }

  public sendCredentialOffer(options: SendCredentialOfferOptions) {
    // TODO: Implement
  }

  public issueCredential(options: IssueCredentialOptions) {
    // TODO: Implement
  }
}
