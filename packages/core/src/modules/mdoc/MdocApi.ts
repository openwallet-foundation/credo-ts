import { AgentContext } from '../../agent'
import { injectable } from '../../plugins'
import type { Query, QueryOptions } from '../../storage/StorageService'
import { Mdoc } from './Mdoc'
import { MdocDcApiService } from './MdocDcApiService'
import type {
  MdocDcApiCreateResponseOptions,
  MdocDcApiCreateVerificationSessionOptions,
  MdocDcApiResolveRequestOptions,
  MdocDcApiVerifyResponseOptions,
  MdocDeleteVerificationSessionOptions,
  MdocSignOptions,
  MdocStoreOptions,
  MdocVerifyOptions,
} from './MdocOptions'
import { MdocService } from './MdocService'
import type { MdocRecord, MdocVerificationSessionRecord } from './repository'

/**
 * @public
 */
@injectable()
export class MdocApi {
  private agentContext: AgentContext
  private mdocService: MdocService
  private mdocDcApiService: MdocDcApiService

  public constructor(agentContext: AgentContext, mdocService: MdocService, mdocDcApiService: MdocDcApiService) {
    this.agentContext = agentContext
    this.mdocService = mdocService
    this.mdocDcApiService = mdocDcApiService
  }

  /**
   * Create a new Mdoc, with a spcific doctype, namespace, and validity info.
   */
  public async sign(options: MdocSignOptions) {
    return await this.mdocService.signMdoc(this.agentContext, options)
  }

  /**
   *
   * Verify an incoming mdoc. It will check whether everything is valid, but also returns parts of the validation.
   *
   * For example, you might still want to continue with a flow if not all the claims are included, but the signature is valid.
   *
   */
  public async verify(mdoc: Mdoc, options: MdocVerifyOptions) {
    return await this.mdocService.verifyMdoc(this.agentContext, mdoc, options)
  }

  /**
   * Create a Mdoc class from a base64url encoded Mdoc Issuer-Signed structure
   */
  public fromBase64Url(base64Url: string) {
    return Mdoc.fromBase64Url(base64Url)
  }

  public async store(options: MdocStoreOptions) {
    return await this.mdocService.store(this.agentContext, options)
  }

  public async getById(id: string): Promise<MdocRecord> {
    return await this.mdocService.getById(this.agentContext, id)
  }

  public async getAll(): Promise<Array<MdocRecord>> {
    return await this.mdocService.getAll(this.agentContext)
  }

  public async findAllByQuery(query: Query<MdocRecord>, queryOptions?: QueryOptions): Promise<Array<MdocRecord>> {
    return await this.mdocService.findByQuery(this.agentContext, query, queryOptions)
  }

  public async deleteById(id: string) {
    return await this.mdocService.deleteById(this.agentContext, id)
  }

  public async update(mdocRecord: MdocRecord) {
    return await this.mdocService.update(this.agentContext, mdocRecord)
  }

  /**
   * Get an mdoc verification session by id, for any of the mdoc presentation protocols.
   */
  public async getVerificationSessionById(verificationSessionId: string): Promise<MdocVerificationSessionRecord> {
    return await this.mdocService.getVerificationSessionById(this.agentContext, verificationSessionId)
  }

  public async findVerificationSessionsByQuery(
    query: Query<MdocVerificationSessionRecord>,
    queryOptions?: QueryOptions
  ): Promise<Array<MdocVerificationSessionRecord>> {
    return await this.mdocService.findVerificationSessionsByQuery(this.agentContext, query, queryOptions)
  }

  /**
   * Delete an mdoc verification session. By default the ephemeral session key created for the
   * session is deleted along with it; it is not deleted at any other point in the session
   * lifecycle.
   */
  public async deleteVerificationSessionById(
    verificationSessionId: string,
    options?: MdocDeleteVerificationSessionOptions
  ) {
    return await this.mdocService.deleteVerificationSessionById(this.agentContext, verificationSessionId, options)
  }

  /**
   * Create an ISO 18013-7 Annex C (`org-iso-mdoc`) DC API request and the verification session
   * tracking it. The returned request can be passed to `navigator.credentials.get()` as the
   * `data` of a `org-iso-mdoc` protocol request.
   */
  public async createDcApiVerificationSession(options: MdocDcApiCreateVerificationSessionOptions) {
    return await this.mdocDcApiService.createVerificationSession(this.agentContext, options)
  }

  /**
   * Decrypt and verify an `org-iso-mdoc` DC API response for a verification session.
   */
  public async verifyDcApiResponse(options: MdocDcApiVerifyResponseOptions) {
    return await this.mdocDcApiService.verifyResponse(this.agentContext, options)
  }

  /**
   * Parse an incoming `org-iso-mdoc` DC API request, verify reader authentication where present,
   * and match the requested documents against the stored mdocs.
   */
  public async resolveDcApiRequest(options: MdocDcApiResolveRequestOptions) {
    return await this.mdocDcApiService.resolveRequest(this.agentContext, options)
  }

  /**
   * Create the encrypted `org-iso-mdoc` DC API response for a resolved request.
   */
  public async createDcApiResponse(options: MdocDcApiCreateResponseOptions) {
    return await this.mdocDcApiService.createResponse(this.agentContext, options)
  }
}
