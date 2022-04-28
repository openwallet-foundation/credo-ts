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

// TODO:
//  - finish registrars for did:key, did:peer, did:sov.
//  - Add option to store a did record without publishing it (could be useful when initializing an already registered did. would need the private key material)
//  - Add option to publish a did without creating private keys. Just publish the did document as passed in
//  - Add option to publish a did document without storing it or creating keys (useful when writing dids to the ledger for another agent)
//  - Add repository methods to the module
//  - Determine how the dids module should be used in combination with did exchange for public dids (no difference between public and peer dids anymore)
//  - Determine how dids should be created without first needing to create the keys (some sort of placeholder did document where the keys are generated in the registrar)
//  - Add logging to resolvers / registrars
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
