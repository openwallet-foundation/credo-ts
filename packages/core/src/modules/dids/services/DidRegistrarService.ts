import type { Logger } from '../../../logger'
import type { DidRegistrar } from '../domain/DidRegistrar'
import type {
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateOptions,
  DidDeactivateResult,
  DidUpdateOptions,
  DidUpdateResult,
} from '../types'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { IndyLedgerService } from '../../ledger'
import { parseDid } from '../domain/parse'
import { KeyDidRegistrar } from '../methods/key/KeyDidRegistrar'
import { PeerDidRegistrar } from '../methods/peer/PeerDidRegistrar'
import { SovDidRegistrar } from '../methods/sov/SovDidRegistrar'
import { DidRepository } from '../repository'

@scoped(Lifecycle.ContainerScoped)
export class DidRegistrarService {
  private logger: Logger
  private registrars: DidRegistrar[]

  public constructor(
    agentConfig: AgentConfig,
    // FIXME: we don't want to depend on the indy wallet, but we need it for the indy did resolver
    // Let's see how we can improve once askar / indy-vdr support is merged in.
    wallet: IndyWallet,
    didRepository: DidRepository,
    indyLedgerService: IndyLedgerService
  ) {
    this.logger = agentConfig.logger

    this.registrars = [
      new KeyDidRegistrar(wallet, didRepository),
      new PeerDidRegistrar(wallet, didRepository),
      new SovDidRegistrar(wallet, didRepository, agentConfig, indyLedgerService),
    ]
  }

  public async create<CreateOptions extends DidCreateOptions = DidCreateOptions>(
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

    const method = options.method ?? parseDid(options.did as string)?.method
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

    return await registrar.create(options)
  }

  public async update(options: DidUpdateOptions): Promise<DidUpdateResult> {
    this.logger.debug(`updating did ${options.did}`)

    const method = parseDid(options.did)?.method

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

    return await registrar.update(options)
  }

  public async deactivate(options: DidDeactivateOptions): Promise<DidDeactivateResult> {
    this.logger.debug(`deactivating did ${options.did}`)

    const errorResult = {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        did: options.did,
      },
    } as const

    const method = parseDid(options.did)?.method
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

    return await registrar.deactivate(options)
  }

  private findRegistrarForMethod(method: string): DidRegistrar | null {
    return this.registrars.find((r) => r.supportedMethods.includes(method)) ?? null
  }
}
