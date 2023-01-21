import type { BlobReaderHandle } from 'indy-sdk'

import {
  AriesFrameworkError,
  FileSystem,
  getDirFromFilePath,
  IndySdkError,
  InjectionSymbols,
  Logger,
} from '@aries-framework/core'
import { inject, injectable } from 'tsyringe'

import { isIndyError } from '../../error'
import { IndySdk, IndySdkSymbol } from '../../types'

@injectable()
export class AnonCredsRsUtilitiesService {
  private indySdk: IndySdk
  private logger: Logger
  private fileSystem: FileSystem

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    @inject(InjectionSymbols.FileSystem) fileSystem: FileSystem,
    @inject(IndySdkSymbol) indySdk: IndySdk
  ) {
    this.indySdk = indySdk
    this.logger = logger
    this.fileSystem = fileSystem
  }

  /**
   * Get a handler for the blob storage tails file reader.
   *
   * @param tailsFilePath The path of the tails file
   * @returns The blob storage reader handle
   */
  public async createTailsReader(tailsFilePath: string): Promise<BlobReaderHandle> {
    try {
      this.logger.debug(`Opening tails reader at path ${tailsFilePath}`)
      const tailsFileExists = await this.fileSystem.exists(tailsFilePath)

      // Extract directory from path (should also work with windows paths)
      const dirname = getDirFromFilePath(tailsFilePath)

      if (!tailsFileExists) {
        throw new AriesFrameworkError(`Tails file does not exist at path ${tailsFilePath}`)
      }

      const tailsReaderConfig = {
        base_dir: dirname,
      }

      const tailsReader = await this.indySdk.openBlobStorageReader('default', tailsReaderConfig)
      this.logger.debug(`Opened tails reader at path ${tailsFilePath}`)
      return tailsReader
    } catch (error) {
      if (isIndyError(error)) {
        throw new IndySdkError(error)
      }

      throw error
    }
  }
}
