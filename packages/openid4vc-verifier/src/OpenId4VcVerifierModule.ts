import type { OpenId4VcVerifierModuleConfigOptions } from './OpenId4VcVerifierModuleConfig'
import type { AgentContext, DependencyManager, Module } from '@aries-framework/core'
import type { AuthorizationResponsePayload } from '@sphereon/did-auth-siop'

import { AgentConfig } from '@aries-framework/core'
import bodyParser from 'body-parser'

import { OpenId4VcVerifierApi } from './OpenId4VcVerifierApi'
import { OpenId4VcVerifierModuleConfig } from './OpenId4VcVerifierModuleConfig'
import { OpenId4VcVerifierService } from './OpenId4VcVerifierService'

/**
 * @public
 */
export class OpenId4VcVerifierModule implements Module {
  public readonly api = OpenId4VcVerifierApi

  public readonly config: OpenId4VcVerifierModuleConfig

  public constructor(options: OpenId4VcVerifierModuleConfigOptions) {
    this.config = new OpenId4VcVerifierModuleConfig(options)
  }

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The '@aries-framework/openid4vc-verifier' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages."
      )

    // Register config
    dependencyManager.registerInstance(OpenId4VcVerifierModuleConfig, this.config)

    // Api
    dependencyManager.registerContextScoped(OpenId4VcVerifierApi)

    // Services
    dependencyManager.registerSingleton(OpenId4VcVerifierService)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const endPointConfig = this.config.endpointConfig
    if (!endPointConfig) return

    // create application/x-www-form-urlencoded parser
    const urlencodedParser = bodyParser.urlencoded({ extended: false })

    endPointConfig.app.post(endPointConfig.verificationEndpointPath, urlencodedParser, async (req, res, next) => {
      try {
        const isVpRequest = req.body.presentation_submission !== undefined
        const verifierService = await agentContext.dependencyManager.resolve(OpenId4VcVerifierService)

        const authorizationResponse: AuthorizationResponsePayload = req.body
        if (isVpRequest) authorizationResponse.presentation_submission = JSON.parse(req.body.presentation_submission)

        const verifiedProofResponse = await verifierService.verifyProofResponse(agentContext, req.body)
        if (!endPointConfig.proofResponseHandler) return res.status(200).send()

        const { status } = await endPointConfig.proofResponseHandler(verifiedProofResponse)
        return res.status(status).send()
      } catch (error: unknown) {
        next(error)
      }

      return res.status(200).send()
    })
  }
}
