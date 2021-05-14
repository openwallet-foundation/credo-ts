import RNFS from 'react-native-fs'

import { FileSystem } from './FileSystem'

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

  public async write(path: string, data: string): Promise<void> {
    return RNFS.writeFile(path, data, 'utf8')
  }

  public async read(path: string): Promise<string> {
    return RNFS.readFile(path, 'utf8')
  }
}
