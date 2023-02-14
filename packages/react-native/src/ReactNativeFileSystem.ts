import type { FileSystem, DownloadToFileOptions } from '@aries-framework/core'

import { TypedArrayEncoder, AriesFrameworkError, getDirFromFilePath, Buffer } from '@aries-framework/core'
import * as RNFS from 'react-native-fs'

export class ReactNativeFileSystem implements FileSystem {
  public readonly basePath

  /**
   * Create new ReactNativeFileSystem class instance.
   *
   * @param basePath The base path to use for reading and writing files. RNFS.TemporaryDirectoryPath if not specified
   *
   * @see https://github.com/itinance/react-native-fs#constants
   */
  public constructor(basePath?: string) {
    this.basePath = basePath ?? RNFS.TemporaryDirectoryPath
  }

  public async exists(path: string): Promise<boolean> {
    return RNFS.exists(path)
  }

  public async createDirectory(path: string): Promise<void> {
    await RNFS.mkdir(getDirFromFilePath(path))
  }

  public async write(path: string, data: string): Promise<void> {
    // Make sure parent directories exist
    await RNFS.mkdir(getDirFromFilePath(path))

    return RNFS.writeFile(path, data, 'utf8')
  }

  public async read(path: string): Promise<string> {
    return RNFS.readFile(path, 'utf8')
  }

  public async downloadToFile(url: string, path: string, options?: DownloadToFileOptions) {
    // Make sure parent directories exist
    await RNFS.mkdir(getDirFromFilePath(path))

    const { promise } = RNFS.downloadFile({
      fromUrl: url,
      toFile: path,
    })

    await promise

    if (options?.verifyHash) {
      // RNFS returns hash as HEX
      const fileHash = await RNFS.hash(path, options.verifyHash.algorithm)
      const fileHashBuffer = Buffer.from(fileHash, 'hex')

      // If hash doesn't match, remove file and throw error
      if (fileHashBuffer.compare(options.verifyHash.hash) !== 0) {
        await RNFS.unlink(path)
        throw new AriesFrameworkError(
          `Hash of downloaded file does not match expected hash. Expected: ${TypedArrayEncoder.toBase58(
            options.verifyHash.hash
          )}, Actual: ${TypedArrayEncoder.toBase58(fileHashBuffer)}`
        )
      }
    }
  }
}
