import RNFS from 'react-native-fs'

import { FileSystem } from './FileSystem'

export class ReactNativeFileSystem implements FileSystem {
  public readonly basePath = RNFS.DocumentDirectoryPath

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
