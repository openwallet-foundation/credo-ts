import type { Express } from 'express'

import {
  type InternalOpenId4VcIssuerModuleConfigOptions,
  OpenId4VcIssuerModuleConfig,
} from './openid4vc-issuer/OpenId4VcIssuerModuleConfig'
import {
  type InternalOpenId4VcVerifierModuleConfigOptions,
  OpenId4VcVerifierModuleConfig,
} from './openid4vc-verifier/OpenId4VcVerifierModuleConfig'
import { importExpress } from './shared/router'

export type OpenId4VcIssuerModuleConfigOptions = Omit<InternalOpenId4VcIssuerModuleConfigOptions, 'app'>
export type OpenId4VcVerifierModuleConfigOptions = Omit<InternalOpenId4VcVerifierModuleConfigOptions, 'app'>

export type OpenId4VcModuleConfigOptions<
  IssuerConfig extends OpenId4VcIssuerModuleConfigOptions | undefined | null = null,
  VerifierConfig extends OpenId4VcVerifierModuleConfigOptions | undefined | null = null,
> = {
  /**
   * Express app on which the openid4vc endpoints will be registered. If
   * no app is provided and either the issuer or verifier modules is enabled
   * a new one will be created.
   *
   * NOTE: you must manually start the server foryour express app and
   * expose this on a public url that is reachable.
   *
   * NOTE: It is recommended that you register your middleware and routes
   * AFTER the openid4vc routes are registered on the app. The openid4vc
   * module ensures only the routes are listened to that are needed.
   */
  app?: Express
} & (IssuerConfig extends null
  ? { issuer?: OpenId4VcIssuerModuleConfigOptions }
  : IssuerConfig extends undefined
    ? { issuer?: undefined }
    : { issuer: IssuerConfig }) &
  (VerifierConfig extends null
    ? { verifier?: OpenId4VcVerifierModuleConfigOptions }
    : VerifierConfig extends undefined
      ? { verifier?: undefined }
      : { verifier: VerifierConfig })

export class OpenId4VcModuleConfig<
  IssuerConfig extends OpenId4VcIssuerModuleConfigOptions | undefined | null = null,
  VerifierConfig extends OpenId4VcVerifierModuleConfigOptions | undefined | null = null,
> {
  private options: OpenId4VcModuleConfigOptions<IssuerConfig, VerifierConfig>

  public readonly app: IssuerConfig extends OpenId4VcIssuerModuleConfigOptions
    ? Express
    : VerifierConfig extends OpenId4VcVerifierModuleConfigOptions
      ? Express
      : undefined

  public readonly issuer: IssuerConfig extends OpenId4VcVerifierModuleConfigOptions
    ? OpenId4VcIssuerModuleConfig
    : undefined
  public readonly verifier: VerifierConfig extends OpenId4VcVerifierModuleConfigOptions
    ? OpenId4VcVerifierModuleConfig
    : undefined

  public constructor(options?: OpenId4VcModuleConfigOptions<IssuerConfig, VerifierConfig>) {
    this.options = options ?? ({} as OpenId4VcModuleConfigOptions<IssuerConfig, VerifierConfig>)

    this.app = (this.options.app ||
      (this.options.issuer || this.options.verifier ? importExpress()() : undefined)) as this['app']

    this.issuer = (
      this.options.issuer
        ? new OpenId4VcIssuerModuleConfig({
            ...this.options.issuer,
            app: this.app as Express, // app is always defined if issuer options are defined,
          })
        : undefined
    ) as this['issuer']
    this.verifier = (
      this.options.verifier
        ? new OpenId4VcVerifierModuleConfig({
            ...this.options.verifier,
            app: this.app as Express, // app is always defined if issuer options are defined,
          })
        : undefined
    ) as this['verifier']
  }
}
