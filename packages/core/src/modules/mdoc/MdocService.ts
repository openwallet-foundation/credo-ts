import { AgentContext } from '../../agent'
import { injectable } from '../../plugins'
import type { Query, QueryOptions } from '../../storage/StorageService'
import { KeyManagementApi } from '../kms'
import { Mdoc } from './Mdoc'
import { MdocDeviceResponse } from './MdocDeviceResponse'
import type {
  MdocDeleteVerificationSessionOptions,
  MdocDeviceResponseDcqlQueryOptions,
  MdocDeviceResponseOptions,
  MdocDeviceResponsePresentationDefinitionOptions,
  MdocDeviceResponseVerifyOptions,
  MdocSignOptions,
  MdocStoreOptions,
  MdocVerifyOptions,
} from './MdocOptions'
import {
  MdocRecord,
  MdocRepository,
  type MdocVerificationSessionRecord,
  MdocVerificationSessionRepository,
} from './repository'

/**
 * @internal
 */
@injectable()
export class MdocService {
  private mdocRepository: MdocRepository
  private mdocVerificationSessionRepository: MdocVerificationSessionRepository

  public constructor(
    mdocRepository: MdocRepository,
    mdocVerificationSessionRepository: MdocVerificationSessionRepository
  ) {
    this.mdocRepository = mdocRepository
    this.mdocVerificationSessionRepository = mdocVerificationSessionRepository
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

  public async getVerificationSessionById(
    agentContext: AgentContext,
    verificationSessionId: string
  ): Promise<MdocVerificationSessionRecord> {
    return await this.mdocVerificationSessionRepository.getById(agentContext, verificationSessionId)
  }

  public async findVerificationSessionsByQuery(
    agentContext: AgentContext,
    query: Query<MdocVerificationSessionRecord>,
    queryOptions?: QueryOptions
  ): Promise<Array<MdocVerificationSessionRecord>> {
    return await this.mdocVerificationSessionRepository.findByQuery(agentContext, query, queryOptions)
  }

  /**
   * Delete a verification session, and by default the ephemeral session key it holds. The key is
   * not deleted at any other point in the session lifecycle.
   */
  public async deleteVerificationSessionById(
    agentContext: AgentContext,
    verificationSessionId: string,
    options?: MdocDeleteVerificationSessionOptions
  ) {
    const verificationSession = await this.mdocVerificationSessionRepository.getById(
      agentContext,
      verificationSessionId
    )

    await this.mdocVerificationSessionRepository.delete(agentContext, verificationSession)

    const deleteAssociatedKey = options?.deleteAssociatedKey ?? true
    if (deleteAssociatedKey) {
      const kms = agentContext.resolve(KeyManagementApi)

      // Returns false if the key was already gone, which is the state we want it in
      await kms.deleteKey({ keyId: verificationSession.sessionKeyId })
    }
  }
}
