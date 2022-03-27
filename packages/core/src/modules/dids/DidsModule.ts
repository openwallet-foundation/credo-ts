import type { DidResolutionOptions } from './types'

import { Lifecycle, scoped } from 'tsyringe'

import { DidRepository } from './repository'
import { DidResolverService } from './services/DidResolverService'

@scoped(Lifecycle.ContainerScoped)
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

  public findByVerkey(recipientKey: string) {
    return this.didRepository.findByVerkey(recipientKey)
  }

  public findMultipleByVerkey(verkey: string) {
    return this.didRepository.findMultipleByVerkey(verkey)
  }
}
