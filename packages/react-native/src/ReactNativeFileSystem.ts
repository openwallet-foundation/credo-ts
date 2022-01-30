import type { FileSystem } from '@aries-framework/core'

import { getDirFromFilePath } from '@aries-framework/core'
import * as ExpoFileSystem from 'expo-file-system'

export class ReactNativeFileSystem implements FileSystem {
  public readonly basePath

  /**
   * Create new ReactNativeFileSystem class instance.
   *
   * @param basePath The base path to use for reading and writing files. ExpoFileSystem.documentDirectory if not specified
   *
   * @see https://docs.expo.dev/versions/latest/sdk/filesystem/#filesystemcachedirectory
   */
  public constructor(basePath?: string) {
    if (!basePath) {
      // Returns null on web. Safe to cast for iOS / Android
      // https://github.com/expo/expo/issues/5558
      let expoPath = ExpoFileSystem.documentDirectory as string

      // Remove trailing /
      if (expoPath.endsWith('/')) {
        expoPath = expoPath.substring(0, expoPath.length - 1)
      }

      expoPath = expoPath.replace('file://', '')

      this.basePath = expoPath
    } else {
      this.basePath = basePath
    }
  }

  public async exists(path: string): Promise<boolean> {
    // Expo requires the path to begin with `file://`
    const expoPath = this.getExpoPath(path)

    const fileInfo = await ExpoFileSystem.getInfoAsync(expoPath)

    return fileInfo.exists
  }

  public async write(path: string, data: string): Promise<void> {
    const fileDirectory = getDirFromFilePath(path)

    // Make sure parent directories exist
    await this.ensureDirectoryExists(fileDirectory)

    // Expo requires the path to begin with `file://`
    const expoPath = this.getExpoPath(path)

    return ExpoFileSystem.writeAsStringAsync(expoPath, data, { encoding: 'utf8' })
  }

  public async read(path: string): Promise<string> {
    // Expo requires the path to begin with `file://`
    const expoPath = this.getExpoPath(path)

    return ExpoFileSystem.readAsStringAsync(expoPath, { encoding: 'utf8' })
  }

  public async downloadToFile(url: string, path: string) {
    // Expo requires the path to begin with `file://`
    const expoPath = this.getExpoPath(path)

    const fileDirectory = getDirFromFilePath(expoPath)

    // Make sure parent directories exist
    await this.ensureDirectoryExists(fileDirectory)

    await ExpoFileSystem.downloadAsync(url, expoPath)
  }

  private getExpoPath(path: string) {
    if (!path.startsWith('file://')) {
      return `file://${path}`
    }

    return path
  }

  private async ensureDirectoryExists(path: string) {
    const dirInfo = await ExpoFileSystem.getInfoAsync(path)
    if (!dirInfo.exists) {
      await ExpoFileSystem.makeDirectoryAsync(path, { intermediates: true })
    }
  }
}
