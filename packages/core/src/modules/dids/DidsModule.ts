import type { Key } from '../../crypto'
import type { DependencyManager } from '../../plugins'
import type {
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateOptions,
  DidDeactivateResult,
  DidResolutionOptions,
  DidUpdateOptions,
  DidUpdateResult,
} from './types'

import { AgentContext } from '../../agent'
import { injectable, module } from '../../plugins'

import { DidRepository } from './repository'
import { DidRegistrarService } from './services/DidRegistrarService'
import { DidResolverService } from './services/DidResolverService'

// TODO:
//  - check: finish registrars for did:key, did:peer, did:sov.
//  - defer: Add option to store a did record without publishing it (could be useful when initializing an already registered did. would need the private key material)
//  - defer: Add option to publish a did without creating private keys. Just publish the did document as passed in
//  - defer: Add option to publish a did document without storing it or creating keys (useful when writing dids to the ledger for another agent)
//  - defer: Add repository methods to the module
//  - Determine how the dids module should be used in combination with did exchange for public dids (no difference between public and peer dids anymore)
//  - defer: Determine how dids should be created without first needing to create the keys (some sort of placeholder did document where the keys are generated in the registrar)
//  - Add logging to resolvers / registrars
//  -
@module()
@injectable()
export class DidsModule {
  private resolverService: DidResolverService
  private registrarService: DidRegistrarService
  private didRepository: DidRepository
  private agentContext: AgentContext

  public constructor(
    resolverService: DidResolverService,
    registrarService: DidRegistrarService,
    didRepository: DidRepository,
    agentContext: AgentContext
  ) {
    this.resolverService = resolverService
    this.registrarService = registrarService
    this.didRepository = didRepository
    this.agentContext = agentContext
  }

  public resolve(didUrl: string, options?: DidResolutionOptions) {
    return this.resolverService.resolve(this.agentContext, didUrl, options)
  }

  public create<CreateOptions extends DidCreateOptions = DidCreateOptions>(
    options: CreateOptions
  ): Promise<DidCreateResult> {
    return this.registrarService.create<CreateOptions>(this.agentContext, options)
  }
  public update(options: DidUpdateOptions): Promise<DidUpdateResult> {
    return this.registrarService.update(this.agentContext, options)
  }

  public deactivate(options: DidDeactivateOptions): Promise<DidDeactivateResult> {
    return this.registrarService.deactivate(this.agentContext, options)
  }

  public resolveDidDocument(didUrl: string) {
    return this.resolverService.resolveDidDocument(this.agentContext, didUrl)
  }

  public findByRecipientKey(recipientKey: Key) {
    return this.didRepository.findByRecipientKey(this.agentContext, recipientKey)
  }

  public findAllByRecipientKey(recipientKey: Key) {
    return this.didRepository.findAllByRecipientKey(this.agentContext, recipientKey)
  }

  public getCreatedDids({ method }: { method?: string } = {}) {
    return this.didRepository.getCreatedDids(this.agentContext, { method })
  }

  /**
   * Registers the dependencies of the dids module module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(DidsModule)

    // Services
    dependencyManager.registerSingleton(DidResolverService)
    dependencyManager.registerSingleton(DidRegistrarService)
    dependencyManager.registerSingleton(DidRepository)
  }
}
