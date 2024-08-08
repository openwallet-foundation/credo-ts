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
  private MdocService: MdocService

  public constructor(agentContext: AgentContext, mdocService: MdocService) {
    this.agentContext = agentContext
    this.MdocService = mdocService
  }

  /**
   *
   * Verify an incoming mdoc. It will check whether everything is valid, but also returns parts of the validation.
   *
   * For example, you might still want to continue with a flow if not all the claims are included, but the signature is valid.
   *
   */
  public async verify(options: MdocVerifyOptions) {
    return await this.MdocService.verify(this.agentContext, options)
  }

  /**
   * Create an Mdoc class from a hex encoded Mdoc
   */
  public fromHexEncodedMdoc(hexEncodedMdoc: string) {
    return Mdoc.fromHexEncodedMdoc(hexEncodedMdoc)
  }

  /**
   * Create an Mdoc class from a hex encoded Mdoc
   */
  public fromBase64UrlEncoded(base64UrlEncodedMdoc: string) {
    return Mdoc.fromBase64UrlEncodedMdoc(base64UrlEncodedMdoc)
  }

  public async store(mdoc: Mdoc) {
    return await this.MdocService.store(this.agentContext, mdoc)
  }

  public async getById(id: string): Promise<MdocRecord> {
    return await this.MdocService.getById(this.agentContext, id)
  }

  public async getAll(): Promise<Array<MdocRecord>> {
    return await this.MdocService.getAll(this.agentContext)
  }

  public async findAllByQuery(query: Query<MdocRecord>, queryOptions?: QueryOptions): Promise<Array<MdocRecord>> {
    return await this.MdocService.findByQuery(this.agentContext, query, queryOptions)
  }

  public async deleteById(id: string) {
    return await this.MdocService.deleteById(this.agentContext, id)
  }

  public async update(mdocRecord: MdocRecord) {
    return await this.MdocService.update(this.agentContext, mdocRecord)
  }
}
