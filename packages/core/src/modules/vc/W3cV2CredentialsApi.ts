import { AgentContext } from '../../agent'
import { injectable } from '../../plugins'
import type { Query, QueryOptions } from '../../storage/StorageService'
import type { ClaimFormat, W3cV2VerifiableCredential } from './models'
import type { W3cV2CredentialRecord } from './repository'
import { W3cV2CredentialService } from './W3cV2CredentialService'
import type {
  W3cV2SignCredentialOptions,
  W3cV2SignPresentationOptions,
  W3cV2StoreCredentialOptions,
  W3cV2VerifyCredentialOptions,
  W3cV2VerifyPresentationOptions,
} from './W3cV2CredentialServiceOptions'

/**
 * @public
 */
@injectable()
export class W3cV2CredentialsApi {
  private agentContext: AgentContext
  private w3cV2CredentialService: W3cV2CredentialService

  public constructor(agentContext: AgentContext, w3cV2CredentialService: W3cV2CredentialService) {
    this.agentContext = agentContext
    this.w3cV2CredentialService = w3cV2CredentialService
  }

  public async store(options: W3cV2StoreCredentialOptions): Promise<W3cV2CredentialRecord> {
    return this.w3cV2CredentialService.storeCredential(this.agentContext, options)
  }

  public async deleteById(id: string) {
    return this.w3cV2CredentialService.removeCredentialRecord(this.agentContext, id)
  }

  public async getAll(): Promise<W3cV2CredentialRecord[]> {
    return this.w3cV2CredentialService.getAllCredentialRecords(this.agentContext)
  }

  public async getById(id: string): Promise<W3cV2CredentialRecord> {
    return this.w3cV2CredentialService.getCredentialRecordById(this.agentContext, id)
  }

  public async findAllByQuery(
    query: Query<W3cV2CredentialRecord>,
    queryOptions?: QueryOptions
  ): Promise<W3cV2VerifiableCredential[]> {
    return this.w3cV2CredentialService.findCredentialsByQuery(this.agentContext, query, queryOptions)
  }

  public async signCredential<Format extends ClaimFormat.JwtW3cVc | ClaimFormat.SdJwtW3cVc>(
    options: W3cV2SignCredentialOptions<Format>
  ) {
    return this.w3cV2CredentialService.signCredential<Format>(this.agentContext, options)
  }

  public async verifyCredential(options: W3cV2VerifyCredentialOptions) {
    return this.w3cV2CredentialService.verifyCredential(this.agentContext, options)
  }

  public async signPresentation<Format extends ClaimFormat.JwtW3cVp | ClaimFormat.SdJwtW3cVp>(
    options: W3cV2SignPresentationOptions<Format>
  ) {
    return this.w3cV2CredentialService.signPresentation<Format>(this.agentContext, options)
  }

  public async verifyPresentation(options: W3cV2VerifyPresentationOptions) {
    return this.w3cV2CredentialService.verifyPresentation(this.agentContext, options)
  }
}
