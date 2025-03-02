import type { AgentContext } from '@credo-ts/core'
import type { AnonCredsRevocationRegistryDefinition } from '../../models'

export interface TailsFileService {
  /**
   * Retrieve base directory for tail file storage
   *
   * @param agentContext
   */
  getTailsBasePath(agentContext: AgentContext): string | Promise<string>

  /**
   * Upload the tails file for a given revocation registry definition.
   *
   * Optionally, receives revocationRegistryDefinitionId in case the ID is
   * known beforehand.
   *
   * Returns the published tail file URL
   * @param agentContext
   * @param options
   */
  uploadTailsFile(
    agentContext: AgentContext,
    options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
      revocationRegistryDefinitionId?: string
    }
  ): Promise<{ tailsFileUrl: string }>

  /**
   * Retrieve the tails file for a given revocation registry, downloading it
   * from the tailsLocation URL if not present in internal cache
   *
   * Classes implementing this interface should verify integrity of the downloaded
   * file.
   *
   * @param agentContext
   * @param options
   */
  getTailsFile(
    agentContext: AgentContext,
    options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
      revocationRegistryDefinitionId?: string
    }
  ): Promise<{ tailsFilePath: string }>
}
