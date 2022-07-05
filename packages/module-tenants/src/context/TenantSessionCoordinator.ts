import type { TenantRecord } from '../repository'

import { AgentConfig, AgentContext, AriesFrameworkError, injectable, WalletModule } from '@aries-framework/core'
import { Mutex } from 'async-mutex'

/**
 * Coordinates all agent context instance for tenant sessions.
 *
 * NOTE: the implementation in temporary and doesn't correctly handle the lifecycle of sessions, it's just an implementation to make
 * multi-tenancy work. It will keep opening wallets over time, taking up more and more resources. The implementation will be improved in the near future.
 * It does however handle race conditions on initialization of wallets (so two requests for the same tenant being processed in parallel)
 */
@injectable()
export class TenantSessionCoordinator {
  private rootAgentContext: AgentContext
  private tenantAgentContextMapping: TenantAgentContextMapping = {}

  public constructor(rootAgentContext: AgentContext) {
    this.rootAgentContext = rootAgentContext
  }

  // FIXME: add timeouts to the lock acquire (to prevent deadlocks)
  public async getContextForSession(tenantRecord: TenantRecord): Promise<AgentContext> {
    let tenantContextMapping = this.tenantAgentContextMapping[tenantRecord.id]

    // TODO: we should probably create a new context (but with the same dependency manager / wallet) for each session.
    // This way we can add a `.dispose()` on the agent context, which means that agent context isn't usable anymore. However
    // the wallet won't be closed.

    // If we already have a context with sessions in place return the context and increment
    // the session count.
    if (isTenantContextSessions(tenantContextMapping)) {
      tenantContextMapping.sessionCount++
      return tenantContextMapping.agentContext
    }

    // TODO: look at semaphores to manage the total number of wallets
    // If the context is currently being initialized, wait for it to complete.
    else if (isTenantAgentContextInitializing(tenantContextMapping)) {
      // Wait for the wallet to finish initializing, then try to
      return await tenantContextMapping.mutex.runExclusive(() => {
        tenantContextMapping = this.tenantAgentContextMapping[tenantRecord.id]

        // There should always be a context now, if this isn't the case we must error out
        // TODO: handle the case where the previous initialization failed (the value is undefined)
        // We can just open a new session in that case, but for now we'll ignore this flow
        if (!isTenantContextSessions(tenantContextMapping)) {
          throw new AriesFrameworkError('Tenant context is not ready yet')
        }

        tenantContextMapping.sessionCount++
        return tenantContextMapping.agentContext
      })
    }
    // No value for this tenant exists yet, initialize a new session.
    else {
      // Set a mutex on the agent context mapping so other requests can wait for it to be initialized.
      const mutex = new Mutex()
      this.tenantAgentContextMapping[tenantRecord.id] = {
        mutex,
      }

      return await mutex.runExclusive(async () => {
        const tenantDependencyManager = this.rootAgentContext.dependencyManager.createChild()
        const tenantConfig = this.rootAgentContext.config.extend(tenantRecord.config)

        const agentContext = new AgentContext({
          contextCorrelationId: tenantRecord.id,
          dependencyManager: tenantDependencyManager,
        })

        tenantDependencyManager.registerInstance(AgentContext, agentContext)
        tenantDependencyManager.registerInstance(AgentConfig, tenantConfig)

        tenantContextMapping = {
          agentContext,
          sessionCount: 1,
        }

        // NOTE: we're using the wallet module here because that correctly handle creating if it doesn't exist yet
        // and will also write the storage version to the storage, which is needed by the update assistant. We either
        // need to move this out of the module, or just keep using the module here.
        const walletModule = agentContext.dependencyManager.resolve(WalletModule)
        await walletModule.initialize(tenantRecord.config.walletConfig)

        this.tenantAgentContextMapping[tenantRecord.id] = tenantContextMapping

        return agentContext
      })
    }
  }
}

interface TenantContextSessions {
  sessionCount: number
  agentContext: AgentContext
}

interface TenantContextInitializing {
  mutex: Mutex
}

export interface TenantAgentContextMapping {
  [tenantId: string]: TenantContextSessions | TenantContextInitializing | undefined
}

function isTenantAgentContextInitializing(
  contextMapping: TenantContextSessions | TenantContextInitializing | undefined
): contextMapping is TenantContextInitializing {
  return contextMapping !== undefined && (contextMapping as TenantContextInitializing).mutex !== undefined
}

function isTenantContextSessions(
  contextMapping: TenantContextSessions | TenantContextInitializing | undefined
): contextMapping is TenantContextSessions {
  return contextMapping !== undefined && (contextMapping as TenantContextSessions).sessionCount !== undefined
}
