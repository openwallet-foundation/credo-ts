import type { AnonCredsRevocationRegistryDefinition } from '@credo-ts/anoncreds'
import { BasicTailsFileService } from '@credo-ts/anoncreds'
import type { AgentContext, FileSystem } from '@credo-ts/core'
import { InjectionSymbols } from '@credo-ts/core'

export class InMemoryTailsFileService extends BasicTailsFileService {
  private tailsFilePaths: Record<string, string> = {}

  public async uploadTailsFile(
    _agentContext: AgentContext,
    options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
    }
  ) {
    this.tailsFilePaths[options.revocationRegistryDefinition.value.tailsHash] =
      options.revocationRegistryDefinition.value.tailsLocation

    return { tailsFileUrl: options.revocationRegistryDefinition.value.tailsHash }
  }

  public async getTailsFile(
    agentContext: AgentContext,
    options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
    }
  ) {
    const { revocationRegistryDefinition } = options
    const { tailsLocation, tailsHash } = revocationRegistryDefinition.value

    try {
      agentContext.config.logger.debug(
        `Checking to see if tails file for URL ${revocationRegistryDefinition.value.tailsLocation} has been stored in the FileSystem`
      )

      // hash is used as file identifier
      const tailsExists = await this.tailsFileExists(agentContext, tailsHash)
      const tailsFilePath = await this.getTailsFilePath(agentContext, tailsHash)
      agentContext.config.logger.debug(
        `Tails file for ${tailsLocation} ${tailsExists ? 'is stored' : 'is not stored'} at ${tailsFilePath}`
      )

      if (!tailsExists) {
        agentContext.config.logger.debug(`Retrieving tails file from URL ${tailsLocation}`)
        const fileSystem = agentContext.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
        await fileSystem.downloadToFile(tailsLocation, tailsFilePath)
        agentContext.config.logger.debug(`Saved tails file to FileSystem at path ${tailsFilePath}`)
      }

      return { tailsFilePath }
    } catch (error) {
      agentContext.config.logger.error(`Error while retrieving tails file from URL ${tailsLocation}`, {
        error,
      })
      throw error
    }
  }
}
