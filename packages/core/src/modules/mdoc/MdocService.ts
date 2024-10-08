import type {
  MdocCreateOptions,
  MdocDeviceResponseOpenId4VpOptions,
  MdocDeviceResponseVerifyOptions,
  MdocVerifyOptions,
} from './MdocOptions'
import type { Query, QueryOptions } from '../../storage/StorageService'

import { injectable } from 'tsyringe'

import { AgentContext } from '../../agent'

import { Mdoc } from './Mdoc'
import { MdocDeviceResponse } from './MdocDeviceResponse'
import { MdocRecord, MdocRepository } from './repository'

/**
 * @internal
 */
@injectable()
export class MdocService {
  private MdocRepository: MdocRepository

  public constructor(mdocRepository: MdocRepository) {
    this.MdocRepository = mdocRepository
  }

  public mdocFromBase64Url(hexEncodedMdoc: string) {
    return Mdoc.fromBase64Url(hexEncodedMdoc)
  }

  public createMdoc(agentContext: AgentContext, options: MdocCreateOptions) {
    return Mdoc.create(agentContext, options)
  }

  public async verifyMdoc(agentContext: AgentContext, mdoc: Mdoc, options: MdocVerifyOptions) {
    return await mdoc.verify(agentContext, options)
  }

  public async createDeviceResponse(agentContext: AgentContext, options: MdocDeviceResponseOpenId4VpOptions) {
    return MdocDeviceResponse.openId4Vp(agentContext, options)
  }

  public async verifyDeviceResponse(agentContext: AgentContext, options: MdocDeviceResponseVerifyOptions) {
    return MdocDeviceResponse.verify(agentContext, options)
  }

  public async store(agentContext: AgentContext, mdoc: Mdoc) {
    const mdocRecord = new MdocRecord({ mdoc })
    await this.MdocRepository.save(agentContext, mdocRecord)

    return mdocRecord
  }

  public async getById(agentContext: AgentContext, id: string): Promise<MdocRecord> {
    return await this.MdocRepository.getById(agentContext, id)
  }

  public async getAll(agentContext: AgentContext): Promise<Array<MdocRecord>> {
    return await this.MdocRepository.getAll(agentContext)
  }

  public async findByQuery(
    agentContext: AgentContext,
    query: Query<MdocRecord>,
    queryOptions?: QueryOptions
  ): Promise<Array<MdocRecord>> {
    return await this.MdocRepository.findByQuery(agentContext, query, queryOptions)
  }

  public async deleteById(agentContext: AgentContext, id: string) {
    await this.MdocRepository.deleteById(agentContext, id)
  }

  public async update(agentContext: AgentContext, mdocRecord: MdocRecord) {
    await this.MdocRepository.update(agentContext, mdocRecord)
  }
}
