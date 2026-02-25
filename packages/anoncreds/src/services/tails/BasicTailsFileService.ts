import type { AgentContext, FileSystem } from '@credo-ts/core'
import { CredoError, InjectionSymbols, TypedArrayEncoder } from '@credo-ts/core'
import type { AnonCredsRevocationRegistryDefinition } from '../../models'
import type { TailsFileService } from './TailsFileService'

export class BasicTailsFileService implements TailsFileService {
  private tailsDirectoryPath?: string

  public constructor(options?: { tailsDirectoryPath?: string; tailsServerBaseUrl?: string }) {
    this.tailsDirectoryPath = options?.tailsDirectoryPath
  }

  public async getTailsBasePath(agentContext: AgentContext) {
    const fileSystem = agentContext.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
    const basePath = `${this.tailsDirectoryPath ?? fileSystem.cachePath}/anoncreds/tails`
    if (!(await fileSystem.exists(basePath))) {
      await fileSystem.createDirectory(`${basePath}/file`)
    }
    return basePath
  }

  public async uploadTailsFile(
    _agentContext: AgentContext,
    _options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
    }
  ): Promise<{ tailsFileUrl: string }> {
    throw new CredoError('BasicTailsFileService only supports tails file downloading')
  }

  public async getTailsFile(
    agentContext: AgentContext,
    options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
    }
  ) {
    const { revocationRegistryDefinition } = options
    const { tailsLocation, tailsHash } = revocationRegistryDefinition.value

    const fileSystem = agentContext.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)

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

        // download file and verify hash
        await fileSystem.downloadToFile(tailsLocation, tailsFilePath, {
          verifyHash: {
            algorithm: 'sha256',
            hash: TypedArrayEncoder.fromBase58(tailsHash),
          },
        })
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

  protected async getTailsFilePath(agentContext: AgentContext, tailsHash: string) {
    return `${await this.getTailsBasePath(agentContext)}/${tailsHash}`
  }

  protected async tailsFileExists(agentContext: AgentContext, tailsHash: string): Promise<boolean> {
    const fileSystem = agentContext.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
    const tailsFilePath = await this.getTailsFilePath(agentContext, tailsHash)
    return await fileSystem.exists(tailsFilePath)
  }
}
