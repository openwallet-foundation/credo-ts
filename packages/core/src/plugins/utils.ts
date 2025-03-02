import type { AgentContext } from '../agent'
import type { ApiModule, Module } from './Module'

export function getRegisteredModuleByInstance<M extends Module>(
  agentContext: AgentContext,
  moduleType: { new (...args: unknown[]): M }
): M | undefined {
  const module = Object.values(agentContext.dependencyManager.registeredModules).find(
    (module): module is M => module instanceof moduleType
  )

  return module
}

export function getRegisteredModuleByName<M extends Module>(
  agentContext: AgentContext,
  constructorName: string
): M | undefined {
  const module = Object.values(agentContext.dependencyManager.registeredModules).find(
    (module): module is M => module.constructor.name === constructorName
  )

  return module
}

export function getApiForModuleByName<M extends ApiModule>(
  agentContext: AgentContext,
  constructorName: string
): InstanceType<M['api']> | undefined {
  const module = getRegisteredModuleByName(agentContext, constructorName)
  if (!module || !module.api) return undefined

  return agentContext.dependencyManager.resolve(module.api) as InstanceType<M['api']>
}
