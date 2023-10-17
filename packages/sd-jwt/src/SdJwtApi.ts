import type {
  SdJwt,
  SdJwtCreateOptions,
  SdJwtPresentOptions,
  SdJwtReceiveOptions,
  SdJwtVerificationResult,
  SdJwtVerifyOptions,
} from './SdJwtService'
import type { SdJwtRecord } from './repository'
import type { Jwt } from '@aries-framework/core'

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

  /**
   * Taking a JWT here is a really suboptimal. It would be nice to also be able to take something like a VC, or something like that.
   */
  public async create(jwt: Jwt, options: SdJwtCreateOptions): Promise<SdJwtRecord> {
    return await this.sdJwtService.create(this.agentContext, jwt, options)
  }

  /**
   * @todo Name is not the best
   * @todo This stores for now as it is in-line with the rest of the framework, but this will be removed.
   *
   * Validates and stores an sd-jwt from the perspective of an holder
   */
  public async receive(sdJwt: SdJwt, options: SdJwtReceiveOptions): Promise<SdJwtRecord> {
    return await this.sdJwtService.receive(this.agentContext, sdJwt, options)
  }

  /**
   * Create a compact presentation of the sd-jwt.
   * This presentation can be send in- or out-of-band to the verifier.
   *
   * Within the `options` field, you can supply the indicies of the disclosures you would like to share with the verifier.
   * Also, whether to include the holder key binding.
   *
   */
  public async present(sdJwt: SdJwt, options: SdJwtPresentOptions): Promise<string> {
    return await this.sdJwtService.present(this.agentContext, sdJwt, options)
  }

  /**
   * Verify an incoming sd-jwt. It will check whether everything is valid, but also returns parts of the validation.
   *
   * For example, you might still want to continue with a flow if not all the claims are included, but the signature is valid.
   */
  public async verify(sdJwt: SdJwt | string, options: SdJwtVerifyOptions): Promise<SdJwtVerificationResult> {
    return await this.sdJwtService.verify(this.agentContext, sdJwt, options)
  }
}
