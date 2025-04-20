import type { ImportDidOptions } from './DidsApiOptions'
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
import { CredoError } from '../../error'
import { injectable } from '../../plugins'

import { KeyManagementApi } from '../kms'
import { DidsModuleConfig } from './DidsModuleConfig'
import { getAlternativeDidsForPeerDid, isValidPeerDid } from './methods'
import { DidRepository } from './repository'
import { DidRegistrarService, DidResolverService } from './services'

@injectable()
export class DidsApi {
  public config: DidsModuleConfig

  private didResolverService: DidResolverService
  private didRegistrarService: DidRegistrarService
  private didRepository: DidRepository
  private agentContext: AgentContext

  public constructor(
    didResolverService: DidResolverService,
    didRegistrarService: DidRegistrarService,
    didRepository: DidRepository,
    agentContext: AgentContext,
    config: DidsModuleConfig,
    _keyManagement: KeyManagementApi
  ) {
    this.didResolverService = didResolverService
    this.didRegistrarService = didRegistrarService
    this.didRepository = didRepository
    this.agentContext = agentContext
    this.config = config
  }

  /**
   * Resolve a did to a did document.
   *
   * Follows the interface as defined in https://w3c-ccg.github.io/did-resolution/
   */
  public resolve(didUrl: string, options?: DidResolutionOptions) {
    return this.didResolverService.resolve(this.agentContext, didUrl, options)
  }

  /**
   * Create, register and store a did and did document.
   *
   * Follows the interface as defined in https://identity.foundation/did-registration
   */
  public create<CreateOptions extends DidCreateOptions = DidCreateOptions>(
    options: CreateOptions
  ): Promise<DidCreateResult> {
    return this.didRegistrarService.create<CreateOptions>(this.agentContext, options)
  }

  /**
   * Update an existing did document.
   *
   * Follows the interface as defined in https://identity.foundation/did-registration
   */
  public update<UpdateOptions extends DidUpdateOptions = DidUpdateOptions>(
    options: UpdateOptions
  ): Promise<DidUpdateResult> {
    return this.didRegistrarService.update(this.agentContext, options)
  }

  /**
   * Deactivate an existing did.
   *
   * Follows the interface as defined in https://identity.foundation/did-registration
   */
  public deactivate<DeactivateOptions extends DidDeactivateOptions = DidDeactivateOptions>(
    options: DeactivateOptions
  ): Promise<DidDeactivateResult> {
    return this.didRegistrarService.deactivate(this.agentContext, options)
  }

  /**
   * Resolve a did to a did document. This won't return the associated metadata as defined
   * in the did resolution specification, and will throw an error if the did document could not
   * be resolved.
   */
  public resolveDidDocument(didUrl: string) {
    return this.didResolverService.resolveDidDocument(this.agentContext, didUrl)
  }

  /**
   * Get a list of all dids created by the agent. This will return a list of {@link DidRecord} objects.
   * Each document will have an id property with the value of the did. Optionally, it will contain a did document,
   * but this is only for documents that can't be resolved from the did itself or remotely.
   *
   * You can call `${@link DidsModule.resolve} to resolve the did document based on the did itself.
   */
  public getCreatedDids({ method, did }: { method?: string; did?: string } = {}) {
    return this.didRepository.getCreatedDids(this.agentContext, { method, did })
  }

  /**
   * Import an existing did that was created outside of the DidsApi. This will create a `DidRecord` for the did
   * and will allow the did to be used in other parts of the agent. If you need to create a new did document,
   * you can use the {@link DidsApi.create} method to create and register the did.
   *
   * If no `didDocument` is provided, the did document will be resolved using the did resolver. You can optionally provide a list
   * of private key buffer with the respective private key bytes. These keys will be stored in the wallet, and allows you to use the
   * did for other operations. Providing keys that already exist in the wallet is allowed, and those keys will be skipped from being
   * added to the wallet.
   *
   * By default, this method will throw an error if the did already exists in the wallet. You can override this behavior by setting
   * the `overwrite` option to `true`. This will update the did document in the record, and allows you to update the did over time.
   */
  public async import({ did, didDocument, keys = [], overwrite }: ImportDidOptions) {
    if (didDocument && didDocument.id !== did) {
      throw new CredoError(`Did document id ${didDocument.id} does not match did ${did}`)
    }

    const existingDidRecord = await this.didRepository.findCreatedDid(this.agentContext, did)
    if (existingDidRecord && !overwrite) {
      throw new CredoError(
        `A created did ${did} already exists. If you want to override the existing did, set the 'overwrite' option to update the did.`
      )
    }

    if (!didDocument) {
      didDocument = await this.resolveDidDocument(did)
    }

    for (const key of keys) {
      // Make sure the keys exists in the did document
      didDocument.dereferenceKey(key.didDocumentRelativeKeyId)
    }

    // Update existing did record
    if (existingDidRecord) {
      existingDidRecord.didDocument = didDocument
      existingDidRecord.keys = keys
      existingDidRecord.setTags({
        alternativeDids: isValidPeerDid(didDocument.id) ? getAlternativeDidsForPeerDid(did) : undefined,
      })

      await this.didRepository.update(this.agentContext, existingDidRecord)
      return
    }

    // Create new did record
    await this.didRepository.storeCreatedDid(this.agentContext, {
      did,
      didDocument,
      keys,
      tags: {
        alternativeDids: isValidPeerDid(didDocument.id) ? getAlternativeDidsForPeerDid(did) : undefined,
      },
    })
  }

  public get supportedResolverMethods() {
    return this.didResolverService.supportedMethods
  }

  public get supportedRegistrarMethods() {
    return this.didRegistrarService.supportedMethods
  }
}
