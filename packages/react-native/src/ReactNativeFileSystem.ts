import type { FileSystem, DownloadToFileOptions } from '@aries-framework/core'

import { TypedArrayEncoder, AriesFrameworkError, getDirFromFilePath, Buffer } from '@aries-framework/core'
import * as RNFS from 'react-native-fs'

export class ReactNativeFileSystem implements FileSystem {
  public readonly dataPath
  public readonly cachePath
  public readonly tempPath

  /**
   * Create new ReactNativeFileSystem class instance.
   *
   * @param baseDataPath The base path to use for reading and writing data files used within the framework.
   * Files will be created under baseDataPath/.afj directory. If not specified, it will be set to homedir()
   * @param baseCachePath The base path to use for reading and writing cache files used within the framework.
   * Files will be created under baseCachePath/.afj directory. If not specified, it will be set to homedir()
   * @param baseTempPath The base path to use for reading and writing temporary files within the framework.
   * Files will be created under baseTempPath/.afj directory. If not specified, it will be set to tmpdir()
   *
   * @see https://github.com/itinance/react-native-fs#constants
   */
  public constructor(options?: { baseDataPath?: string; baseCachePath?: string; baseTempPath?: string }) {
    this.dataPath = `${options?.baseDataPath ?? RNFS.DocumentDirectoryPath}/.afj`
    // we add cache and temp suffix because in Android TemporaryDirectoryPath falls back to CachesDirectoryPath
    this.cachePath = `${options?.baseCachePath ?? RNFS.CachesDirectoryPath}/.afj/cache`
    this.tempPath = `${options?.baseTempPath ?? RNFS.TemporaryDirectoryPath}/.afj/temp`
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

  public async delete(path: string): Promise<void> {
    await RNFS.unlink(path)
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
