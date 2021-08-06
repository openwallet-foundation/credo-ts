import type { default as Indy, BlobReaderHandle, RevRegId } from 'indy-sdk'

import { AbortController } from 'abort-controller'
import { scoped, Lifecycle } from 'tsyringe'

import { getDirFromFilePath } from '../../../utils/path'
import { AgentConfig } from '../../../agent/AgentConfig'
import { FileSystem } from '../../../storage/FileSystem'
import { IndyWallet } from '../../../wallet/IndyWallet'

@scoped(Lifecycle.ContainerScoped)
export class IndyUtilitesService {
  private indy: typeof Indy
  private fileSystem: FileSystem
  private fetch

  public constructor(
    agentConfig: AgentConfig,
    indyWallet: IndyWallet,
  ) {
    this.indy = agentConfig.agentDependencies.indy
    this.fileSystem = agentConfig.fileSystem
    this.fetch = agentConfig.agentDependencies.fetch
  }

  /**
   * Get a handler for the blob storage tails file reader.
   *
   * @param tailsFilePath The path of the tails file
   * @returns The blob storage reader handle
   */
  public async createTailsReader(tailsFilePath: string): Promise<BlobReaderHandle> {
    const tailsFileExists = await this.fileSystem.exists(tailsFilePath)

    // Extract directory from path (should also work with windows paths)
    const dirname = getDirFromFilePath(tailsFilePath)

    if (!tailsFileExists) {
      throw new Error(`Tails file does not exist at path ${tailsFilePath}`)
    }

    const tailsReaderConfig = {
      base_dir: dirname,
    }

    return this.indy.openBlobStorageReader('default', tailsReaderConfig)
  }

  public async downloadTails(hash: string, tailsLocation: string) {
    const filePath = `${this.fileSystem.basePath}/afj/tails/${hash}`
    if (!(await this.fileSystem.exists(filePath))) {
      const abortController = new AbortController()
      const id = setTimeout(() => abortController.abort(), 15000)
      const data = await this.fetch(tailsLocation, {
        method: 'GET',
        signal: abortController.signal,
      })
      clearTimeout(id)
      if (data) {
        await this.fileSystem.write(filePath, await data.text())
      } else {
        throw new Error(`Could not retrieve tails file from URL ${tailsLocation}`)
      }
    }

    return this.createTailsReader(filePath)
  }
}
