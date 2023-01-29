import type { IndySdk } from '../../types'
import type { AgentContext, FileSystem } from '@aries-framework/core'

import { AriesFrameworkError, getDirFromFilePath, IndySdkError, InjectionSymbols } from '@aries-framework/core'

import { isIndyError } from '../../error'
import { IndySdkSymbol } from '../../types'

/**
 * Get a handler for the blob storage tails file reader.
 *
 * @param agentContext The agent context
 * @param tailsFilePath The path of the tails file
 * @returns The blob storage reader handle
 */
export async function createTailsReader(agentContext: AgentContext, tailsFilePath: string) {
  const fileSystem = agentContext.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
  const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)

  try {
    agentContext.config.logger.debug(`Opening tails reader at path ${tailsFilePath}`)
    const tailsFileExists = await fileSystem.exists(tailsFilePath)

    // Extract directory from path (should also work with windows paths)
    const dirname = getDirFromFilePath(tailsFilePath)

    if (!tailsFileExists) {
      throw new AriesFrameworkError(`Tails file does not exist at path ${tailsFilePath}`)
    }

    const tailsReaderConfig = {
      base_dir: dirname,
    }

    const tailsReader = await indySdk.openBlobStorageReader('default', tailsReaderConfig)
    agentContext.config.logger.debug(`Opened tails reader at path ${tailsFilePath}`)
    return tailsReader
  } catch (error) {
    if (isIndyError(error)) {
      throw new IndySdkError(error)
    }

    throw error
  }
}
