import type { AgentContext, FileSystem } from '@aries-framework/core'

import { TypedArrayEncoder, InjectionSymbols } from '@aries-framework/core'

const getTailsFilePath = (cachePath: string, tailsHash: string) => `${cachePath}/anoncreds/tails/${tailsHash}`

export function tailsFileExists(agentContext: AgentContext, tailsHash: string): Promise<boolean> {
  const fileSystem = agentContext.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
  const tailsFilePath = getTailsFilePath(fileSystem.cachePath, tailsHash)

  return fileSystem.exists(tailsFilePath)
}

export async function downloadTailsFile(
  agentContext: AgentContext,
  tailsLocation: string,
  tailsHashBase58: string
): Promise<{
  tailsFilePath: string
}> {
  const fileSystem = agentContext.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)

  try {
    agentContext.config.logger.debug(
      `Checking to see if tails file for URL ${tailsLocation} has been stored in the FileSystem`
    )

    // hash is used as file identifier
    const tailsExists = await tailsFileExists(agentContext, tailsHashBase58)
    const tailsFilePath = getTailsFilePath(fileSystem.cachePath, tailsHashBase58)
    agentContext.config.logger.debug(
      `Tails file for ${tailsLocation} ${tailsExists ? 'is stored' : 'is not stored'} at ${tailsFilePath}`
    )

    if (!tailsExists) {
      agentContext.config.logger.debug(`Retrieving tails file from URL ${tailsLocation}`)

      // download file and verify hash
      await fileSystem.downloadToFile(tailsLocation, tailsFilePath, {
        verifyHash: {
          algorithm: 'sha256',
          hash: TypedArrayEncoder.fromBase58(tailsHashBase58),
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
