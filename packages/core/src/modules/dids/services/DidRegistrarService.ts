import type { AgentContext } from '../../../agent'
import type { DidRegistrar } from '../domain/DidRegistrar'
import type {
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateOptions,
  DidDeactivateResult,
  DidUpdateOptions,
  DidUpdateResult,
} from '../types'

import { InjectionSymbols } from '../../../constants'
import { Logger } from '../../../logger'
import { inject, injectable } from '../../../plugins'
import { DidsModuleConfig } from '../DidsModuleConfig'
import { tryParseDid } from '../domain/parse'

@injectable()
export class DidRegistrarService {
  private logger: Logger
  private didsModuleConfig: DidsModuleConfig

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger, didsModuleConfig: DidsModuleConfig) {
    this.logger = logger
    this.didsModuleConfig = didsModuleConfig
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

    return await registrar.update(agentContext, options)
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

    return await registrar.deactivate(agentContext, options)
  }

  private findRegistrarForMethod(method: string): DidRegistrar | null {
    return this.didsModuleConfig.registrars.find((r) => r.supportedMethods.includes(method)) ?? null
  }
}
