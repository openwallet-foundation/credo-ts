import type { AnonCredsRevocationRegistryDefinition } from '../../models'
import type { AgentContext } from '@aries-framework/core'

export interface TailsFileService {
  getTailsBasePath(agentContext: AgentContext): string | Promise<string>

  getTailsFilePath(agentContext: AgentContext, tailsHash: string): string | Promise<string>

  tailsFileExists(agentContext: AgentContext, tailsHash: string): boolean | Promise<boolean>

  uploadTailsFile(
    agentContext: AgentContext,
    options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
      revocationRegistryDefinitionId?: string
    }
  ): Promise<string>

  downloadTailsFile(
    agentContext: AgentContext,
    options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
      revocationRegistryDefinitionId?: string
    }
  ): Promise<{
    tailsFilePath: string
  }>
}
