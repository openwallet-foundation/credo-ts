import type { FileSystem, DownloadToFileOptions } from '@credo-ts/core'

import { TypedArrayEncoder, CredoError, getDirFromFilePath, Buffer } from '@credo-ts/core'
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
   * Files will be created under baseDataPath/.credo directory. If not specified, it will be set to
   * RNFS.DocumentDirectoryPath
   * @param baseCachePath The base path to use for reading and writing cache files used within the framework.
   * Files will be created under baseCachePath/.credo directory. If not specified, it will be set to
   * RNFS.CachesDirectoryPath
   * @param baseTempPath The base path to use for reading and writing temporary files within the framework.
   * Files will be created under baseTempPath/.credo directory. If not specified, it will be set to
   * RNFS.TemporaryDirectoryPath
   *
   * @see https://github.com/itinance/react-native-fs#constants
   */
  public constructor(options?: { baseDataPath?: string; baseCachePath?: string; baseTempPath?: string }) {
    this.dataPath = `${options?.baseDataPath ?? RNFS.DocumentDirectoryPath}/.credo`
    // In Android, TemporaryDirectoryPath falls back to CachesDirectoryPath
    this.cachePath = options?.baseCachePath
      ? `${options?.baseCachePath}/.credo`
      : `${RNFS.CachesDirectoryPath}/.credo${Platform.OS === 'android' ? '/cache' : ''}`
    this.tempPath = options?.baseTempPath
      ? `${options?.baseTempPath}/.credo`
      : `${RNFS.TemporaryDirectoryPath}/.credo${Platform.OS === 'android' ? '/temp' : ''}`
  }

  /**
   * Migrate data from .afj to .credo if .afj exists.
   * Copy the contents from old directory (.afj) to new directory (.credo).
   */
  public async migrateWalletToCredoFolder() {
    try {
      const oldDataPath = this.dataPath.replace('.credo', `.afj`)
      const cacheAfjPath = this.cachePath.replace('.credo', '.afj')
      const tempAfjPath = this.tempPath.replace('.credo', '.afj')

      const pathsToMigrate = [
        {
          from: oldDataPath,
          to: this.dataPath,
        },
        {
          from: cacheAfjPath,
          to: this.cachePath,
        },
        {
          from: tempAfjPath,
          to: this.tempPath,
        },
      ]

      for await (const path of pathsToMigrate) {
        // Migrate if the old paths exist
        if (await this.exists(path.from)) {
          await this.copyDirectory(path.from, path.to)
        }
      }
    } catch (error) {
      throw new CredoError(`Error during migration from .afj to .credo`, {
        cause: error,
      })
    }
  }

  public async copyDirectory(sourcePath: string, destinationPath: string) {
    try {
      // Ensure the target directory exists
      await RNFS.mkdir(destinationPath)

      // Get the contents of the source directory
      const contents = await RNFS.readDir(sourcePath)

      for (const item of contents) {
        const newPath = `${destinationPath}/${item.name}`

        if (item.isDirectory()) {
          // Recursively copy subdirectories
          await this.copyDirectory(item.path, newPath)
        } else {
          // Copy files to the new location
          await RNFS.copyFile(item.path, newPath)
        }
      }
    } catch (error) {
      throw new CredoError(`Error copying directory from ${sourcePath} to ${destinationPath}`, { cause: error })
    }
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
