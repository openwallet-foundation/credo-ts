import { AgentContext } from '../../agent'
import { injectable } from '../../plugins'
import type { Query, QueryOptions } from '../../storage/StorageService'
import type { SdJwtVcRecord } from './repository'
import type {
  SdJwtVcHeader,
  SdJwtVcPayload,
  SdJwtVcPresentOptions,
  SdJwtVcSignOptions,
  SdJwtVcStoreOptions,
  SdJwtVcVerifyOptions,
} from './SdJwtVcOptions'


import { TokenStatusListService } from './credential-status'
import { type SdJwtVc, SdJwtVcService } from './SdJwtVcService'
import type { SdJwtVcTypeMetadata } from './typeMetadata'

/**
 * @public
 */
@injectable()
export class SdJwtVcApi {
  private agentContext: AgentContext
  private sdJwtVcService: SdJwtVcService
  public statusList: TokenStatusListService

  public constructor(
    agentContext: AgentContext,
    sdJwtVcService: SdJwtVcService,
    tokenStatusListService: TokenStatusListService
  ) {
    this.agentContext = agentContext
    this.sdJwtVcService = sdJwtVcService
    this.statusList = tokenStatusListService
  }

  public async sign<Payload extends SdJwtVcPayload>(options: SdJwtVcSignOptions<Payload>) {
    return await this.sdJwtVcService.sign<Payload>(this.agentContext, options)
  }

  /**
   *
   * Create a compact presentation of the sd-jwt.
   * This presentation can be send in- or out-of-band to the verifier.
   *
   * Also, whether to include the holder key binding.
   */
  public async present<Payload extends SdJwtVcPayload = SdJwtVcPayload>(
    options: SdJwtVcPresentOptions<Payload>
  ): Promise<string> {
    return await this.sdJwtVcService.present(this.agentContext, options)
  }

  /**
   *
   * Verify an incoming sd-jwt. It will check whether everything is valid, but also returns parts of the validation.
   *
   * For example, you might still want to continue with a flow if not all the claims are included, but the signature is valid.
   *
   */
  public async verify<Header extends SdJwtVcHeader, Payload extends SdJwtVcPayload>(options: SdJwtVcVerifyOptions) {
    return await this.sdJwtVcService.verify<Header, Payload>(this.agentContext, options)
  }

  /**
   * Fetches the type metadata for the `vct`. Only supports `https` VCT url for now.
   *
   * If fetching the VCT directly fails, it will fallback to the legacy vct path. If both
   * fail, an error will be thrown, unless `throwErrorOnFetchError` is set to `false`.
   *
   * The integrity will always be verified if the metadata was resolved. The `extends` keyword is
   * not resolved yet.
   */
  public async fetchTypeMetadata(
    sdJwtVc: SdJwtVc,
    options?: { throwErrorOnFetchError?: boolean }
  ): Promise<SdJwtVcTypeMetadata | undefined> {
    return this.sdJwtVcService.fetchTypeMetadata(this.agentContext, sdJwtVc, options)
  }

  /**
   * Get and validate a sd-jwt-vc from a serialized JWT.
   */
  public fromCompact<Header extends SdJwtVcHeader, Payload extends SdJwtVcPayload>(sdJwtVcCompact: string) {
    return this.sdJwtVcService.fromCompact<Header, Payload>(sdJwtVcCompact)
  }

  public async store(options: SdJwtVcStoreOptions) {
    return await this.sdJwtVcService.store(this.agentContext, options)
  }

  public async getById(id: string): Promise<SdJwtVcRecord> {
    return await this.sdJwtVcService.getById(this.agentContext, id)
  }

  public async getAll(): Promise<Array<SdJwtVcRecord>> {
    return await this.sdJwtVcService.getAll(this.agentContext)
  }

  public async findAllByQuery(query: Query<SdJwtVcRecord>, queryOptions?: QueryOptions): Promise<Array<SdJwtVcRecord>> {
    return await this.sdJwtVcService.findByQuery(this.agentContext, query, queryOptions)
  }

  public async deleteById(id: string) {
    return await this.sdJwtVcService.deleteById(this.agentContext, id)
  }

  public async update(sdJwtVcRecord: SdJwtVcRecord) {
    return await this.sdJwtVcService.update(this.agentContext, sdJwtVcRecord)
  }
}
