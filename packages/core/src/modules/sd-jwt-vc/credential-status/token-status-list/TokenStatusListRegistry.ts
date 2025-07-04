import type { AgentContext } from '../../../../agent'

export interface PublishTokenStatusListOptions {
  version?: string
  name?: string

  [x: string]: string | boolean | object | undefined
}

export interface TokenStatusListRegistry {
  readonly supportedMethods: string[]
  readonly allowsCaching: boolean
  /**
   * Publish a verified token status list JWT to the registry
   */
  publish(
    agentContext: AgentContext,
    statusListId: string,
    jwt: string,
    options?: PublishTokenStatusListOptions
  ): Promise<string>

  /**
   * Retrieve a token status list JWT from the registry
   */
  retrieve(agentContext: AgentContext, statusListId: string): Promise<string>
}
