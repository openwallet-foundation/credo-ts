import type { AgentContext } from '../../../agent'
import { InjectionSymbols } from '../../../constants'
import type { Logger } from '../../../logger'
import { inject, injectable } from '../../../plugins'
import { DidsModuleConfig } from '../DidsModuleConfig'
import { type DidDeactivationSupport, type DidRegistrar, deleteDidKeys } from '../domain/DidRegistrar'
import { tryParseDid } from '../domain/parse'
import { DidRecordStatus, DidRepository } from '../repository'
import type {
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateOptions,
  DidDeactivateResult,
  DidUpdateOptions,
  DidUpdateResult,
} from '../types'

import { DidResolverService } from './DidResolverService'

@injectable()
export class DidRegistrarService {
  private logger: Logger
  private didsModuleConfig: DidsModuleConfig
  private didResolverService: DidResolverService

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    didsModuleConfig: DidsModuleConfig,
    didResolverService: DidResolverService
  ) {
    this.logger = logger
    this.didsModuleConfig = didsModuleConfig
    this.didResolverService = didResolverService
  }

  public async create<CreateOptions extends DidCreateOptions = DidCreateOptions>(
    agentContext: AgentContext,
    options: CreateOptions
  ): Promise<DidCreateResult> {
    this.logger.debug(`creating did ${options.did ?? options.method}`)

    const errorResult = {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        did: options.did,
      },
    } as const

    if ((!options.did && !options.method) || (options.did && options.method)) {
      return {
        ...errorResult,
        didState: {
          ...errorResult.didState,
          reason: 'Either did OR method must be specified',
        },
      }
    }

    const method = options.method ?? tryParseDid(options.did as string)?.method
    if (!method) {
      return {
        ...errorResult,
        didState: {
          ...errorResult.didState,
          reason: `Could not extract method from did ${options.did}`,
        },
      }
    }

    const registrar = this.findRegistrarForMethod(method)
    if (!registrar) {
      return {
        ...errorResult,
        didState: {
          ...errorResult.didState,
          reason: `Unsupported did method: '${method}'`,
        },
      }
    }

    return await registrar.create(agentContext, options)
  }

  public async update(agentContext: AgentContext, options: DidUpdateOptions): Promise<DidUpdateResult> {
    this.logger.debug(`updating did ${options.did}`)

    const method = tryParseDid(options.did)?.method

    const errorResult = {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        did: options.did,
      },
    } as const

    if (!method) {
      return {
        ...errorResult,
        didState: {
          ...errorResult.didState,
          reason: `Could not extract method from did ${options.did}`,
        },
      }
    }

    const registrar = this.findRegistrarForMethod(method)
    if (!registrar) {
      return {
        ...errorResult,
        didState: {
          ...errorResult.didState,
          reason: `Unsupported did method: '${method}'`,
        },
      }
    }

    // Invalidate cache before updating
    await this.didResolverService.invalidateCacheForDid(agentContext, options.did)

    const result = await registrar.update(agentContext, options)
    if (options.deleteRemovedKeys && result.didState.state === 'finished' && result.removedKeys) {
      await deleteDidKeys(agentContext, result.removedKeys, `after updating ${options.did}`)
    }

    return result
  }

  public async deactivate(agentContext: AgentContext, options: DidDeactivateOptions): Promise<DidDeactivateResult> {
    this.logger.debug(`deactivating did ${options.did}`)

    const errorResult = {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        did: options.did,
      },
    } as const

    const method = tryParseDid(options.did)?.method
    if (!method) {
      return {
        ...errorResult,
        didState: {
          ...errorResult.didState,
          reason: `Could not extract method from did ${options.did}`,
        },
      }
    }

    const registrar = this.findRegistrarForMethod(method)
    if (!registrar) {
      return {
        ...errorResult,
        didState: {
          ...errorResult.didState,
          reason: `Unsupported did method: '${method}'`,
        },
      }
    }

    // Invalidate cache before deactivating
    await this.didResolverService.invalidateCacheForDid(agentContext, options.did)

    // If deactivation is not supported by method, we only deactivate the
    // local did record
    if (registrar.deactivationSupport === 'notSupportedByMethod') {
      return await this.deactivateDidRecord(agentContext, options.did)
    }

    if (!registrar.deactivate) {
      return {
        ...errorResult,
        didState: {
          ...errorResult.didState,
          reason: `notSupported: registrar for did method '${method}' doesn't support deactivation`,
        },
      }
    }

    return await registrar.deactivate(agentContext, options)
  }

  /**
   * Deactivates a did whose method has no deactivation, such as did:key, by only setting the status of its created did record.
   */
  private async deactivateDidRecord(agentContext: AgentContext, did: string): Promise<DidDeactivateResult> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const didRecord = await didRepository.findCreatedDid(agentContext, did)
    if (!didRecord) {
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: { state: 'failed', did, reason: `notFound: created did '${did}' not found` },
      }
    }

    let didDocument = didRecord.didDocument
    if (!didDocument) {
      const resolutionResult = await this.didResolverService.resolve(agentContext, did)
      if (!resolutionResult.didDocument) {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: { state: 'failed', did, reason: `notFound: ${resolutionResult.didResolutionMetadata.message}` },
        }
      }
      didDocument = resolutionResult.didDocument
    }

    didRecord.status = DidRecordStatus.Deactivated
    await didRepository.update(agentContext, didRecord)

    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: { state: 'finished', did, didDocument },
    }
  }

  /**
   * Whether the did can be deactivated. `notSupportedByRegistrar` when no registrar supports the did method.
   */
  public getDeactivationSupport(did: string): DidDeactivationSupport {
    const method = tryParseDid(did)?.method
    return (method && this.findRegistrarForMethod(method)?.deactivationSupport) || 'notSupportedByRegistrar'
  }

  private findRegistrarForMethod(method: string): DidRegistrar | null {
    return this.didsModuleConfig.registrars.find((r) => r.supportedMethods.includes(method)) ?? null
  }

  /**
   * Get all supported did methods for the did registrar.
   */
  public get supportedMethods() {
    return Array.from(new Set(this.didsModuleConfig.registrars.flatMap((r) => r.supportedMethods)))
  }
}
