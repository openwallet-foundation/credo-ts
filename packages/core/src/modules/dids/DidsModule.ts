import type { DidResolutionOptions } from './types'

import { Lifecycle, scoped } from 'tsyringe'

import { DidResolverService } from './services/DidResolverService'

@scoped(Lifecycle.ContainerScoped)
export class DidsModule {
  private resolverService: DidResolverService

  public constructor(resolverService: DidResolverService) {
    this.resolverService = resolverService
  }

  public resolve(didUrl: string, options?: DidResolutionOptions) {
    return this.resolverService.resolve(didUrl, options)
  }
}
