import type { IssueCredentialOptions, SendCredentialOfferOptions } from './OpenId4VcVerifierServiceOptions'

import { injectable, AgentContext } from '@aries-framework/core'

import { OpenId4VcVerifierService } from './OpenId4VcVerifierService'

/**
 * @public
 */
@injectable()
export class OpenId4VcVerifierApi {
  private agentContext: AgentContext
  private openId4VcVerifierService: OpenId4VcVerifierService

  public constructor(agentContext: AgentContext, openId4VcVerifierService: OpenId4VcVerifierService) {
    this.agentContext = agentContext
    this.openId4VcVerifierService = openId4VcVerifierService
  }

  public sendCredentialOffer(options: SendCredentialOfferOptions) {
    // TODO: Implement
  }

  public issueCredential(options: IssueCredentialOptions) {
    // TODO: Implement
  }
}
