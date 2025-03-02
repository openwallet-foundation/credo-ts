import type { DownloadToFileOptions, FileSystem } from '@credo-ts/core'

import { Buffer, CredoError, TypedArrayEncoder, getDirFromFilePath } from '@credo-ts/core'
import { Platform } from 'react-native'
import * as RNFS from 'react-native-fs'

export class ReactNativeFileSystem implements FileSystem {
  public readonly dataPath
  public readonly cachePath
  public readonly tempPath

  /**
   * Create new ReactNativeFileSystem class instance.
   *
   * @param baseDataPath The base path to use for reading and writing data files used within the framework.
   * Files will be created under baseDataPath/.afj directory. If not specified, it will be set to
   * RNFS.DocumentDirectoryPath
   * @param baseCachePath The base path to use for reading and writing cache files used within the framework.
   * Files will be created under baseCachePath/.afj directory. If not specified, it will be set to
   * RNFS.CachesDirectoryPath
   * @param baseTempPath The base path to use for reading and writing temporary files within the framework.
   * Files will be created under baseTempPath/.afj directory. If not specified, it will be set to
   * RNFS.TemporaryDirectoryPath
   *
   * @see https://github.com/itinance/react-native-fs#constants
   */
  public constructor(options?: { baseDataPath?: string; baseCachePath?: string; baseTempPath?: string }) {
    this.dataPath = `${options?.baseDataPath ?? RNFS.DocumentDirectoryPath}/.afj`
    // In Android, TemporaryDirectoryPath falls back to CachesDirectoryPath
    this.cachePath = options?.baseCachePath
      ? `${options?.baseCachePath}/.afj`
      : `${RNFS.CachesDirectoryPath}/.afj${Platform.OS === 'android' ? '/cache' : ''}`
    this.tempPath = options?.baseTempPath
      ? `${options?.baseTempPath}/.afj`
      : `${RNFS.TemporaryDirectoryPath}/.afj${Platform.OS === 'android' ? '/temp' : ''}`
  }

  public async exists(path: string): Promise<boolean> {
    return RNFS.exists(path)
  }

  public async createDirectory(path: string): Promise<void> {
    await RNFS.mkdir(getDirFromFilePath(path))
  }

  public async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    await RNFS.copyFile(sourcePath, destinationPath)
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

    const fromUrl = this.encodeUriIfRequired(url)

    const { promise } = RNFS.downloadFile({
      fromUrl,
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
        throw new CredoError(
          `Hash of downloaded file does not match expected hash. Expected: ${TypedArrayEncoder.toBase58(
            options.verifyHash.hash
          )}, Actual: ${TypedArrayEncoder.toBase58(fileHashBuffer)}`
        )
      }
    }
  }

  private encodeUriIfRequired(uri: string) {
    // Some characters in the URL might be invalid for
    // the native os to handle. Only encode if necessary.
    return uri === decodeURI(uri) ? encodeURI(uri) : uri
  }
}
