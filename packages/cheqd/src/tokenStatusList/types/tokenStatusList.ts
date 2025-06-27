import { AgentContext } from '@credo-ts/core'
import { StatusListToken } from './index'

export interface TokenStatusList {
  createStatusList(
    agentContext: AgentContext,
    did: string,
    name: string,
    tag: string,
    size: number,
    signer: any
  ): Promise<StatusListToken>
  revokeIndex(
    agentContext: AgentContext,
    statusListId: string,
    index: number,
    tag: string,
    signer: any
  ): Promise<StatusListToken>
  isRevoked(agentContext: AgentContext, statusListId: string, index: number): Promise<boolean>
  getStatusListToken(agentContext: AgentContext, statusListId: string): Promise<StatusListToken>
}
