import type { SdJwtCreateOptions, SdJwtPresentOptions, SdJwtReceiveOptions, SdJwtVerifyOptions } from './SdJwtOptions'
import type { SdJwt, SdJwtVerificationResult } from './SdJwtService'
import type { SdJwtRecord } from './repository'

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

  public async create<Payload extends Record<string, unknown> = Record<string, unknown>>(
    payload: Payload,
    options: SdJwtCreateOptions<Payload>
  ): Promise<{ sdJwtRecord: SdJwtRecord; compact: string }> {
    return await this.sdJwtService.create<Payload>(this.agentContext, payload, options)
  }

  /**
   * @todo Name is not the best
   * @todo This stores for now as it is in-line with the rest of the framework, but this will be removed.
   *
   * Validates and stores an sd-jwt from the perspective of an holder
   */
  public async receive(sdJwt: string, options: SdJwtReceiveOptions): Promise<SdJwtRecord> {
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
