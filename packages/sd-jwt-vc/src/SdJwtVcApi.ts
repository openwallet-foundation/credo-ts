import type {
  SdJwtVcCreateOptions,
  SdJwtVcPresentOptions,
  SdJwtVcReceiveOptions,
  SdJwtVcVerifyOptions,
} from './SdJwtVcOptions'
import type { SdJwtVcVerificationResult } from './SdJwtVcService'
import type { SdJwtVcRecord } from './repository'
import type { Query } from '@credo-ts/core'

import { AgentContext, injectable } from '@credo-ts/core'

import { SdJwtVcService } from './SdJwtVcService'

/**
 * @public
 */
@injectable()
export class SdJwtVcApi {
  private agentContext: AgentContext
  private sdJwtVcService: SdJwtVcService

  public constructor(agentContext: AgentContext, sdJwtVcService: SdJwtVcService) {
    this.agentContext = agentContext
    this.sdJwtVcService = sdJwtVcService
  }

  public async create<Payload extends Record<string, unknown> = Record<string, unknown>>(
    payload: Payload,
    options: SdJwtVcCreateOptions<Payload>
  ): Promise<{ sdJwtVcRecord: SdJwtVcRecord; compact: string }> {
    return await this.sdJwtVcService.create<Payload>(this.agentContext, payload, options)
  }

  /**
   *
   * Validates and stores an sd-jwt-vc from the perspective of an holder
   *
   */
  public async storeCredential(sdJwtVcCompact: string, options: SdJwtVcReceiveOptions): Promise<SdJwtVcRecord> {
    return await this.sdJwtVcService.storeCredential(this.agentContext, sdJwtVcCompact, options)
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
  public async present(sdJwtVcRecord: SdJwtVcRecord, options: SdJwtVcPresentOptions): Promise<string> {
    return await this.sdJwtVcService.present(this.agentContext, sdJwtVcRecord, options)
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
    sdJwtVcCompact: string,
    options: SdJwtVcVerifyOptions
  ): Promise<{ sdJwtVcRecord: SdJwtVcRecord<Header, Payload>; validation: SdJwtVcVerificationResult }> {
    return await this.sdJwtVcService.verify<Header, Payload>(this.agentContext, sdJwtVcCompact, options)
  }

  public async getById(id: string): Promise<SdJwtVcRecord> {
    return await this.sdJwtVcService.getCredentialRecordById(this.agentContext, id)
  }

  public async getAll(): Promise<Array<SdJwtVcRecord>> {
    return await this.sdJwtVcService.getAllCredentialRecords(this.agentContext)
  }

  public async findAllByQuery(query: Query<SdJwtVcRecord>): Promise<Array<SdJwtVcRecord>> {
    return await this.sdJwtVcService.findCredentialRecordsByQuery(this.agentContext, query)
  }

  public async remove(id: string) {
    return await this.sdJwtVcService.removeCredentialRecord(this.agentContext, id)
  }

  public async update(sdJwtVcRecord: SdJwtVcRecord) {
    return await this.sdJwtVcService.updateCredentialRecord(this.agentContext, sdJwtVcRecord)
  }
}
