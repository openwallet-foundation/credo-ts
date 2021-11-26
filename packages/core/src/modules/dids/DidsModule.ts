import type { DIDResolutionOptions } from './types'

import { Lifecycle, scoped } from 'tsyringe'

import { DidResolverService } from './services/DidResolverService'
@scoped(Lifecycle.ContainerScoped)
export class DidsModule {
  private resolverService: DidResolverService

  public constructor(resolverService: DidResolverService) {
    this.resolverService = resolverService
  }

  public resolve(didUrl: string, options?: DIDResolutionOptions) {
    return this.resolverService.resolve(didUrl, options)
  }
}
