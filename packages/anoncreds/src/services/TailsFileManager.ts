import type { AnonCredsRevocationRegistryDefinition } from '../models'
import type { AgentContext } from '@aries-framework/core'

export interface TailsFileManager {
  getTailsBasePath(agentContext: AgentContext): string

  getTailsFilePath(agentContext: AgentContext, tailsHash: string): string

  tailsFileExists(agentContext: AgentContext, tailsHash: string): Promise<boolean>

  uploadTailsFile(
    agentContext: AgentContext,
    options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
    }
  ): Promise<string>

  downloadTailsFile(
    agentContext: AgentContext,
    options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
    }
  ): Promise<{
    tailsFilePath: string
  }>
}
