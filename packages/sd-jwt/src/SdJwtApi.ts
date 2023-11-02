import type { SdJwtCreateOptions, SdJwtPresentOptions, SdJwtReceiveOptions, SdJwtVerifyOptions } from './SdJwtOptions'
import type { SdJwtVcVerificationResult } from './SdJwtService'
import type { SdJwtRecord } from './repository'
import type { Query } from '@aries-framework/core'

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
   *
   * Validates and stores an sd-jwt from the perspective of an holder
   *
   */
  public async receive(sdJwtCompact: string, options: SdJwtReceiveOptions): Promise<SdJwtRecord> {
    return await this.sdJwtService.receive(this.agentContext, sdJwtCompact, options)
  }

  /**
   *
   * Create a compact presentation of the sd-jwt.
   * This presentation can be send in- or out-of-band to the verifier.
   *
   * Within the `options` field, you can supply the indicies of the disclosures you would like to share with the verifier.
   * Also, whether to include the holder key binding.
   *
   */
  public async present(sdJwtRecord: SdJwtRecord, options: SdJwtPresentOptions): Promise<string> {
    return await this.sdJwtService.present(this.agentContext, sdJwtRecord, options)
  }

  /**
   *
   * Verify an incoming sd-jwt. It will check whether everything is valid, but also returns parts of the validation.
   *
   * For example, you might still want to continue with a flow if not all the claims are included, but the signature is valid.
   *
   */
  public async verify<
    Header extends Record<string, unknown> = Record<string, unknown>,
    Payload extends Record<string, unknown> = Record<string, unknown>
  >(
    sdJwtCompact: string,
    options: SdJwtVerifyOptions
  ): Promise<{ sdJwtRecord: SdJwtRecord<Header, Payload>; validation: SdJwtVcVerificationResult }> {
    return await this.sdJwtService.verify<Header, Payload>(this.agentContext, sdJwtCompact, options)
  }

  public async getCredentialRecordById(id: string): Promise<SdJwtRecord> {
    return await this.sdJwtService.getCredentialRecordById(this.agentContext, id)
  }

  public async getAllCredentialRecords(): Promise<Array<SdJwtRecord>> {
    return await this.sdJwtService.getAllCredentialRecords(this.agentContext)
  }

  public async findCredentialRecordsByQuery(query: Query<SdJwtRecord>): Promise<Array<SdJwtRecord>> {
    return await this.sdJwtService.findCredentialRecordsByQuery(this.agentContext, query)
  }

  public async removeCredentialRecord(id: string) {
    return await this.sdJwtService.removeCredentialRecord(this.agentContext, id)
  }

  public async updateCredentialRecord(sdJwtRecord: SdJwtRecord) {
    return await this.sdJwtService.updateCredentialRecord(this.agentContext, sdJwtRecord)
  }
}
