import type { MdocVerifyOptions } from './MdocOptions'
import type { MdocRecord } from './repository'
import type { Query, QueryOptions } from '../../storage/StorageService'

import { AgentContext } from '../../agent'
import { injectable } from '../../plugins'

import { Mdoc } from './Mdoc'
import { MdocService } from './MdocService'

/**
 * @public
 */
@injectable()
export class MdocApi {
  private agentContext: AgentContext
  private mdocService: MdocService

  public constructor(agentContext: AgentContext, mdocService: MdocService) {
    this.agentContext = agentContext
    this.mdocService = mdocService
  }

  /**
   *
   * Verify an incoming mdoc. It will check whether everything is valid, but also returns parts of the validation.
   *
   * For example, you might still want to continue with a flow if not all the claims are included, but the signature is valid.
   *
   */
  public async verify(options: MdocVerifyOptions) {
    return await this.mdocService.verify(this.agentContext, options)
  }

  /**
   * Create an Mdoc class from a hex encoded Mdoc Issuer-Signed structure
   */
  public fromIssuerSignedHex(hexEncodedMdoc: string) {
    return Mdoc.fromIssuerSignedHex(hexEncodedMdoc)
  }

  /**
   * Create an Mdoc class from a base64/base64url encoded Mdoc Issuer-Signed structure
   */
  public fromIssuerSignedBase64(issuerSignedBase64: string) {
    return Mdoc.fromIssuerSignedBase64(issuerSignedBase64)
  }

  public async store(mdoc: Mdoc) {
    return await this.mdocService.store(this.agentContext, mdoc)
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
}
