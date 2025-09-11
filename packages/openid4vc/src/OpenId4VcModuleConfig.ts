import type { Router } from 'express'
import {
  OpenId4VcIssuerModuleConfig,
  OpenId4VcIssuerModuleConfigOptions,
} from './openid4vc-issuer/OpenId4VcIssuerModuleConfig'
import { OpenId4VcVerifierModuleConfig, OpenId4VcVerifierModuleConfigOptions } from './openid4vc-verifier'

export interface OpenId4VcModuleConfigOptions<
  IssuerConfig extends OpenId4VcIssuerModuleConfigOptions | undefined | null = null,
  VerifierConfig extends OpenId4VcVerifierModuleConfigOptions | undefined | null = null,
> {
  issuer?: Exclude<IssuerConfig, null>
  verifier?: Exclude<VerifierConfig, null>
}

export class OpenId4VcModuleConfig<
  IssuerConfig extends OpenId4VcIssuerModuleConfigOptions | undefined | null = null,
  VerifierConfig extends OpenId4VcVerifierModuleConfigOptions | undefined | null = null,
> {
  private options: OpenId4VcModuleConfigOptions<IssuerConfig, VerifierConfig>

  public readonly router?: Router

  public readonly issuer: IssuerConfig
  public readonly verifier: VerifierConfig

  public constructor(options?: OpenId4VcModuleConfigOptions<IssuerConfig, VerifierConfig>) {
    this.options = options ?? {}

    this.issuer = (
      this.options.issuer ? new OpenId4VcIssuerModuleConfig(this.options.issuer) : undefined
    ) as this['issuer']
    this.verifier = (
      this.options.verifier ? new OpenId4VcVerifierModuleConfig(this.options.verifier) : undefined
    ) as this['verifier']
  }
}
