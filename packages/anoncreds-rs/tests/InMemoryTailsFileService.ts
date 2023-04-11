import type { AnonCredsRevocationRegistryDefinition } from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'

import { BasicTailsFileService } from '@aries-framework/anoncreds'

export class InMemoryTailsFileService extends BasicTailsFileService {
  private tailsFilePaths: Record<string, string> = {}

  public async uploadTailsFile(
    agentContext: AgentContext,
    options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
    }
  ): Promise<string> {
    this.tailsFilePaths[options.revocationRegistryDefinition.value.tailsHash] =
      options.revocationRegistryDefinition.value.tailsLocation

    return options.revocationRegistryDefinition.value.tailsHash
  }

  public async downloadTailsFile(
    agentContext: AgentContext,
    options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
    }
  ): Promise<{
    tailsFilePath: string
  }> {
    const { revocationRegistryDefinition } = options
    const { tailsLocation, tailsHash } = revocationRegistryDefinition.value

    try {
      agentContext.config.logger.debug(
        `Checking to see if tails file for URL ${revocationRegistryDefinition.value.tailsLocation} has been stored in the FileSystem`
      )

      // hash is used as file identifier
      const tailsExists = await this.tailsFileExists(agentContext, tailsHash)
      const tailsFilePath = this.getTailsFilePath(agentContext, tailsHash)
      agentContext.config.logger.debug(
        `Tails file for ${tailsLocation} ${tailsExists ? 'is stored' : 'is not stored'} at ${tailsFilePath}`
      )

      if (!tailsExists) {
        agentContext.config.logger.debug(`Retrieving tails file from URL ${tailsLocation}`)
        // TODO
        agentContext.config.logger.debug(`Saved tails file to FileSystem at path ${tailsFilePath}`)
      }

      return {
        tailsFilePath,
      }
    } catch (error) {
      agentContext.config.logger.error(`Error while retrieving tails file from URL ${tailsLocation}`, {
        error,
      })
      throw error
    }
  }
}
