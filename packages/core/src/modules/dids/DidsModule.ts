import type { DependencyManager } from '../../plugins'
import type { DIDInformation } from './domain'
import type { DidRecord } from './repository'
import type { DidResolutionOptions, DIDMetadata } from './types'

import { injectable, module } from '../../plugins'

import { DidRepository } from './repository'
import { DidService, DidResolverService } from './services'

@module()
@injectable()
export class DidsModule {
  private didService: DidService
  private resolverService: DidResolverService
  private didRepository: DidRepository

  public constructor(didService: DidService, resolverService: DidResolverService, didRepository: DidRepository) {
    this.didService = didService
    this.resolverService = resolverService
    this.didRepository = didRepository
  }

  public resolve(didUrl?: string, options?: DidResolutionOptions) {
    return this.resolverService.resolve(didUrl, options)
  }

  public async getById(recordId: string): Promise<DidRecord> {
    return this.didService.getById(recordId)
  }

  public async findById(recordId: string): Promise<DidRecord | null> {
    return this.didService.findById(recordId)
  }

  public async getAllDIDs(): Promise<DidRecord[]> {
    return this.didService.getAll()
  }

  public async getMyDIDs(): Promise<DidRecord[]> {
    return this.didService.getMyDIDs()
  }

  public async getReceivedDIDs(): Promise<DidRecord[]> {
    return this.didService.getReceivedDIDs()
  }

  public async findAllDIDsByQuery(query: Partial<DidRecord>) {
    return this.didService.findAllByQuery(query)
  }

  public async setDidMetadata(did: string, meta: DIDMetadata) {
    const didRecord = await this.getById(did)
    return this.didService.setDidMetadata(didRecord, meta)
  }

  public async getDidMetadata(did: string): Promise<DIDMetadata> {
    return this.didService.getDidMetadata(did)
  }

  public async getDidInfo(did: string): Promise<DIDInformation> {
    return this.didService.getDidInfo(did)
  }

  public resolveDidDocument(didUrl: string) {
    return this.resolverService.resolveDidDocument(didUrl)
  }

  /**
   * Registers the dependencies of the dids module module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(DidsModule)

    // Services
    dependencyManager.registerSingleton(DidResolverService)
    dependencyManager.registerSingleton(DidService)

    // Repositories
    dependencyManager.registerSingleton(DidRepository)
  }
}
