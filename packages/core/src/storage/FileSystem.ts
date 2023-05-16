import type { Buffer } from '../utils/buffer'

export interface DownloadToFileOptions {
  verifyHash?: { algorithm: 'sha256'; hash: Buffer }
}

export interface FileSystem {
  readonly dataPath: string
  readonly cachePath: string
  readonly tempPath: string

  exists(path: string): Promise<boolean>
  createDirectory(path: string): Promise<void>
  copyFile(sourcePath: string, destinationPath: string): Promise<void>
  write(path: string, data: string): Promise<void>
  read(path: string): Promise<string>
  delete(path: string): Promise<void>
  downloadToFile(url: string, path: string, options?: DownloadToFileOptions): Promise<void>
}
