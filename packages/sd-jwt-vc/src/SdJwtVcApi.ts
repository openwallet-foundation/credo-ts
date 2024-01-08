import type { SdJwtCredential } from './SdJwtCredential'
import type {
  SdJwtVcCreateOptions,
  SdJwtVcFromSerializedJwtOptions,
  SdJwtVcHeader,
  SdJwtVcPayload,
  SdJwtVcPresentOptions,
  SdJwtVcVerifyOptions,
} from './SdJwtVcOptions'
import type { SdJwtVcRecord } from './repository'
import type { Query } from '@aries-framework/core'

import { AgentContext, injectable } from '@aries-framework/core'

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

  public async create<Payload extends SdJwtVcPayload>(payload: Payload, options: SdJwtVcCreateOptions<Payload>) {
    return await this.sdJwtVcService.create<Payload>(this.agentContext, payload, options)
  }

  public async signCredential<Payload extends SdJwtVcPayload>(credential: SdJwtCredential<Payload>) {
    return await this.sdJwtVcService.signCredential<Payload>(this.agentContext, credential)
  }

  /**
   *
   * Get and validate a sd-jwt-vc from a serialized JWT.
   */
  public async fromSerializedJwt<Header extends SdJwtVcHeader, Payload extends SdJwtVcPayload>(
    sdJwtVcCompact: string,
    options: SdJwtVcFromSerializedJwtOptions
  ) {
    return await this.sdJwtVcService.fromSerializedJwt<Header, Payload>(this.agentContext, sdJwtVcCompact, options)
  }

  /**
   *
   * Stores and sd-jwt-vc record
   *
   */
  public async storeCredential(sdJwtVcRecord: SdJwtVcRecord) {
    return await this.sdJwtVcService.storeCredential(this.agentContext, sdJwtVcRecord)
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
  public async present<Header extends SdJwtVcHeader, Payload extends SdJwtVcPayload>(
    sdJwtVcRecord: SdJwtVcRecord<Header, Payload>,
    options: SdJwtVcPresentOptions<Payload>
  ): Promise<string> {
    return await this.sdJwtVcService.present<Header, Payload>(this.agentContext, sdJwtVcRecord, options)
  }

  /**
   *
   * Verify an incoming sd-jwt. It will check whether everything is valid, but also returns parts of the validation.
   *
   * For example, you might still want to continue with a flow if not all the claims are included, but the signature is valid.
   *
   */
  public async verify<Header extends SdJwtVcHeader, Payload extends SdJwtVcPayload>(
    sdJwtVcCompact: string,
    options: SdJwtVcVerifyOptions
  ) {
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
