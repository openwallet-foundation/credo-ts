import type { ConnectionRecordProps, InitConfig, Wallet } from '@aries-framework/core'

import {
  AgentContext,
  DependencyManager,
  InjectionSymbols,
  AgentConfig,
  ConnectionRecord,
  DidExchangeRole,
  DidExchangeState,
} from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'

export function getMockConnection({
  state = DidExchangeState.InvitationReceived,
  role = DidExchangeRole.Requester,
  id = 'test',
  did = 'test-did',
  threadId = 'threadId',
  tags = {},
  theirLabel,
  theirDid = 'their-did',
}: Partial<ConnectionRecordProps> = {}) {
  return new ConnectionRecord({
    did,
    threadId,
    theirDid,
    id,
    role,
    state,
    tags,
    theirLabel,
  })
}

export function getAgentConfig(name: string, extraConfig: Partial<InitConfig> = {}) {
  const { config, agentDependencies } = getBaseConfig(name, extraConfig)
  return new AgentConfig(config, agentDependencies)
}

const publicDidSeed = process.env.TEST_AGENT_PUBLIC_DID_SEED ?? '000000000000000000000000Trustee9'
export function getBaseConfig(name: string, extraConfig: Partial<InitConfig> = {}) {
  const config: InitConfig = {
    label: `Agent: ${name}`,
    walletConfig: {
      id: `Wallet: ${name}`,
      key: `Key: ${name}`,
    },
    publicDidSeed,
    autoAcceptConnections: true,
    connectToIndyLedgersOnStartup: false,
    ...extraConfig,
  }

  return { config, agentDependencies } as const
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
