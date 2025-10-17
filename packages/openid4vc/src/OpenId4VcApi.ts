import { AgentContext, injectable } from '@credo-ts/core'

import {
  type OpenId4VcIssuerModuleConfigOptions,
  OpenId4VcModuleConfig,
  type OpenId4VcVerifierModuleConfigOptions,
} from './OpenId4VcModuleConfig'
import { OpenId4VcHolderApi } from './openid4vc-holder'
import { OpenId4VcIssuerApi } from './openid4vc-issuer'
import { OpenId4VcVerifierApi } from './openid4vc-verifier'

/**
 * @public
 */
@injectable()
export class OpenId4VcApi<
  IssuerConfig extends OpenId4VcIssuerModuleConfigOptions | undefined | null = null,
  VerifierConfig extends OpenId4VcVerifierModuleConfigOptions | undefined | null = null,
> {
  public constructor(
    public readonly config: OpenId4VcModuleConfig<IssuerConfig, VerifierConfig>,
    private agentContext: AgentContext
  ) {}

  public get issuer(): IssuerConfig extends OpenId4VcIssuerModuleConfigOptions
    ? OpenId4VcIssuerApi
    : IssuerConfig extends null
      ? OpenId4VcIssuerApi | undefined
      : undefined {
    if (!this.config.issuer) {
      return undefined as this['issuer']
    }

    return this.agentContext.resolve(OpenId4VcIssuerApi) as this['issuer']
  }

  public get verifier(): VerifierConfig extends OpenId4VcVerifierModuleConfigOptions
    ? OpenId4VcVerifierApi
    : VerifierConfig extends null
      ? OpenId4VcVerifierApi | undefined
      : undefined {
    if (!this.config.verifier) {
      return undefined as this['verifier']
    }

    return this.agentContext.resolve(OpenId4VcVerifierApi) as this['verifier']
  }

  public get holder() {
    return this.agentContext.resolve(OpenId4VcHolderApi)
  }
}
