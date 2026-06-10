import { AgentContext } from '../../agent'
import { injectable } from '../../plugins'
import type { Query, QueryOptions } from '../../storage/StorageService'
import { Mdoc } from './Mdoc'
import { MdocDeviceResponse } from './MdocDeviceResponse'
import type {
  MdocDeviceResponseDcqlQueryOptions,
  MdocDeviceResponseOptions,
  MdocDeviceResponsePresentationDefinitionOptions,
  MdocDeviceResponseVerifyOptions,
  MdocSignOptions,
  MdocStoreOptions,
  MdocVerifyOptions,
} from './MdocOptions'
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
    return MdocDeviceResponse.createDeviceResponseWithPresentationDefinition(agentContext, options)
  }

  public async createDcqlQueryDeviceResponse(agentContext: AgentContext, options: MdocDeviceResponseDcqlQueryOptions) {
    return MdocDeviceResponse.createDeviceResponseWithDcqlQuery(agentContext, options)
  }

  public async verifyDeviceResponse(agentContext: AgentContext, options: MdocDeviceResponseVerifyOptions) {
    const deviceResponse = MdocDeviceResponse.fromBase64Url(options.deviceResponse)
    return deviceResponse.verify(agentContext, options)
  }

  public async store(agentContext: AgentContext, options: MdocStoreOptions) {
    await this.mdocRepository.save(agentContext, options.record)

    return options.record
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
