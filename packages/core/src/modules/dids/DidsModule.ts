import type { DependencyManager } from '../../plugins'
import type { Key } from './domain/Key'
import type { DidResolutionOptions } from './types'

import { injectable, module } from '../../plugins'

import { DidRepository } from './repository'
import { DidResolverService } from './services/DidResolverService'

@module()
@injectable()
export class DidsModule {
  private resolverService: DidResolverService
  private didRepository: DidRepository

  public constructor(resolverService: DidResolverService, didRepository: DidRepository) {
    this.resolverService = resolverService
    this.didRepository = didRepository
  }

  public resolve(didUrl: string, options?: DidResolutionOptions) {
    return this.resolverService.resolve(didUrl, options)
  }

  public resolveDidDocument(didUrl: string) {
    return this.resolverService.resolveDidDocument(didUrl)
  }

  public findByRecipientKey(recipientKey: Key) {
    return this.didRepository.findByRecipientKey(recipientKey)
  }

  public findAllByRecipientKey(recipientKey: Key) {
    return this.didRepository.findAllByRecipientKey(recipientKey)
  }

  /**
   * Registers the dependencies of the dids module module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(DidsModule)

    // Services
    dependencyManager.registerSingleton(DidResolverService)
    dependencyManager.registerSingleton(DidRepository)
  }
}
