import type { KeyType } from '../../crypto'
import type { DidType } from './domain'
import type { DidResolutionOptions } from './types'

import { Lifecycle, scoped } from 'tsyringe'

import { DidService, DidResolverService } from './services'

@scoped(Lifecycle.ContainerScoped)
export class DidsModule {
  private didService: DidService
  private resolverService: DidResolverService

  public constructor(didService: DidService, resolverService: DidResolverService) {
    this.didService = didService
    this.resolverService = resolverService
  }

  public create(didType: DidType, keyType?: KeyType, seed?: string) {
    return this.didService.createDID(didType, keyType, seed)
  }

  public resolve(didUrl: string, options?: DidResolutionOptions) {
    return this.resolverService.resolve(didUrl, options)
  }
}
