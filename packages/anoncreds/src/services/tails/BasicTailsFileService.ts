import type { TailsFileService } from './TailsFileService'
import type { AnonCredsRevocationRegistryDefinition } from '../../models'
import type { AgentContext, FileSystem } from '@aries-framework/core'

import { AriesFrameworkError, InjectionSymbols, TypedArrayEncoder } from '@aries-framework/core'

export class BasicTailsFileService implements TailsFileService {
  private tailsDirectoryPath?: string

  public constructor(options?: { tailsDirectoryPath?: string; tailsServerBaseUrl?: string }) {
    this.tailsDirectoryPath = options?.tailsDirectoryPath
  }

  public getTailsBasePath(agentContext: AgentContext) {
    const fileSystem = agentContext.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
    return `${this.tailsDirectoryPath ?? fileSystem.cachePath}/anoncreds/tails`
  }

  public getTailsFilePath(agentContext: AgentContext, tailsHash: string) {
    return `${this.getTailsBasePath(agentContext)}/${tailsHash}`
  }

  public tailsFileExists(agentContext: AgentContext, tailsHash: string): Promise<boolean> {
    const fileSystem = agentContext.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
    const tailsFilePath = this.getTailsFilePath(agentContext, tailsHash)
    return fileSystem.exists(tailsFilePath)
  }

  public async uploadTailsFile(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    agentContext: AgentContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
    }
  ): Promise<string> {
    throw new AriesFrameworkError('BasicTailsFileManager only supports tails file downloading')
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

    const fileSystem = agentContext.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)

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

        // download file and verify hash
        await fileSystem.downloadToFile(tailsLocation, tailsFilePath, {
          verifyHash: {
            algorithm: 'sha256',
            hash: TypedArrayEncoder.fromBase58(tailsHash),
          },
        })
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
