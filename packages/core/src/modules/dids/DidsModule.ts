import type {
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateOptions,
  DidDeactivateResult,
  DidResolutionOptions,
  DidUpdateOptions,
  DidUpdateResult,
} from './types'

import { Lifecycle, scoped } from 'tsyringe'

import { DidRepository } from './repository'
import { DidRegistrarService } from './services/DidRegistrarService'
import { DidResolverService } from './services/DidResolverService'

@scoped(Lifecycle.ContainerScoped)
export class DidsModule {
  private resolverService: DidResolverService
  private registrarService: DidRegistrarService
  private didRepository: DidRepository

  public constructor(
    resolverService: DidResolverService,
    registrarService: DidRegistrarService,
    didRepository: DidRepository
  ) {
    this.resolverService = resolverService
    this.registrarService = registrarService
    this.didRepository = didRepository
  }

  public resolve(didUrl: string, options?: DidResolutionOptions) {
    return this.resolverService.resolve(didUrl, options)
  }

  public create<CreateOptions extends DidCreateOptions = DidCreateOptions>(
    options: CreateOptions
  ): Promise<DidCreateResult> {
    return this.registrarService.create<CreateOptions>(options)
  }
  public update(options: DidUpdateOptions): Promise<DidUpdateResult> {
    return this.registrarService.update(options)
  }

  public deactivate(options: DidDeactivateOptions): Promise<DidDeactivateResult> {
    return this.registrarService.deactivate(options)
  }

  public getCreatedDids({ method }: { method?: string }) {
    return this.didRepository.getCreatedDids({ method })
  }
}
