import type { Query, QueryOptions } from '../../storage/StorageService'
import type { MdocDeviceResponsePresentationDefinitionOptions } from './MdocOptions'
import type {
  MdocDeviceResponseOptions,
  MdocDeviceResponseVerifyOptions,
  MdocSignOptions,
  MdocVerifyOptions,
} from './MdocOptions'

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
  private mdocRepository: MdocRepository

  public constructor(mdocRepository: MdocRepository) {
    this.mdocRepository = mdocRepository
  }

  public mdocFromBase64Url(hexEncodedMdoc: string) {
    return Mdoc.fromBase64Url(hexEncodedMdoc)
  }

  public signMdoc(agentContext: AgentContext, options: MdocSignOptions) {
    return Mdoc.sign(agentContext, options)
  }

  public async verifyMdoc(agentContext: AgentContext, mdoc: Mdoc, options: MdocVerifyOptions) {
    return await mdoc.verify(agentContext, options)
  }

  public async createDeviceResponse(agentContext: AgentContext, options: MdocDeviceResponseOptions) {
    return MdocDeviceResponse.createDeviceResponse(agentContext, options)
  }

  public async createPresentationDefinitionDeviceResponse(
    agentContext: AgentContext,
    options: MdocDeviceResponsePresentationDefinitionOptions
  ) {
    return MdocDeviceResponse.createPresentationDefinitionDeviceResponse(agentContext, options)
  }

  public async verifyDeviceResponse(agentContext: AgentContext, options: MdocDeviceResponseVerifyOptions) {
    const deviceResponse = MdocDeviceResponse.fromBase64Url(options.deviceResponse)
    return deviceResponse.verify(agentContext, options)
  }

  public async store(agentContext: AgentContext, mdoc: Mdoc) {
    const mdocRecord = new MdocRecord({ mdoc })
    await this.mdocRepository.save(agentContext, mdocRecord)

    return mdocRecord
  }

  public async getById(agentContext: AgentContext, id: string): Promise<MdocRecord> {
    return await this.mdocRepository.getById(agentContext, id)
  }

  public async getAll(agentContext: AgentContext): Promise<Array<MdocRecord>> {
    return await this.mdocRepository.getAll(agentContext)
  }

  public async findByQuery(
    agentContext: AgentContext,
    query: Query<MdocRecord>,
    queryOptions?: QueryOptions
  ): Promise<Array<MdocRecord>> {
    return await this.mdocRepository.findByQuery(agentContext, query, queryOptions)
  }

  public async deleteById(agentContext: AgentContext, id: string) {
    await this.mdocRepository.deleteById(agentContext, id)
  }

  public async update(agentContext: AgentContext, mdocRecord: MdocRecord) {
    await this.mdocRepository.update(agentContext, mdocRecord)
  }
}
