import type { AgentContext } from '@credo-ts/core'
import type { DidCommOutboundPackage } from '../types'

export interface DidCommOutboundTransport {
  supportedSchemes: string[]

  sendMessage(outboundPackage: DidCommOutboundPackage): Promise<void>

  /**
   * Forget the sockets of a connection right away, emit their closed event once and then close them.
   * Returns true when a socket was closed.
   */
  closeSocketByConnectionId?(connectionId: string): boolean

  start(agentContext: AgentContext): Promise<void>
  stop(): Promise<void>
}
