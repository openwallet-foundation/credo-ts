import type { Wallet } from '@aries-framework/core'

import { AgentConfig, AgentContext, DependencyManager, InjectionSymbols } from '@aries-framework/core'

export function mockFunction<T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> {
  return fn as jest.MockedFunction<T>
}

export function getAgentContext({
  dependencyManager = new DependencyManager(),
  wallet,
  agentConfig,
  contextCorrelationId = 'mock',
}: {
  dependencyManager?: DependencyManager
  wallet?: Wallet
  agentConfig?: AgentConfig
  contextCorrelationId?: string
} = {}) {
  if (wallet) dependencyManager.registerInstance(InjectionSymbols.Wallet, wallet)
  if (agentConfig) dependencyManager.registerInstance(AgentConfig, agentConfig)
  return new AgentContext({ dependencyManager, contextCorrelationId })
}
