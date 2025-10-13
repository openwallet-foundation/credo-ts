import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'

import { DidCommFeatureRegistry, DidCommMessageHandlerRegistry, DidCommProtocol } from '@credo-ts/didcomm'

import { ActionMenuApi } from './ActionMenuApi'
import { ActionMenuRole } from './ActionMenuRole'
import {
  ActionMenuProblemReportHandler,
  MenuMessageHandler,
  MenuRequestMessageHandler,
  PerformMessageHandler,
} from './handlers'
import { ActionMenuRepository } from './repository'
import { ActionMenuService } from './services'

/**
 * @public
 */
export class ActionMenuModule implements Module {
  public readonly api = ActionMenuApi

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Services
    dependencyManager.registerSingleton(ActionMenuService)

    // Repositories
    dependencyManager.registerSingleton(ActionMenuRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const featureRegistry = agentContext.resolve(DidCommFeatureRegistry)
    const messageHandlerRegistry = agentContext.resolve(DidCommMessageHandlerRegistry)
    const actionMenuService = agentContext.resolve(ActionMenuService)

    messageHandlerRegistry.registerMessageHandlers([
      new ActionMenuProblemReportHandler(actionMenuService),
      new MenuMessageHandler(actionMenuService),
      new MenuRequestMessageHandler(actionMenuService),
      new PerformMessageHandler(actionMenuService),
    ])

    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/action-menu/1.0',
        roles: [ActionMenuRole.Requester, ActionMenuRole.Responder],
      })
    )
  }
}
