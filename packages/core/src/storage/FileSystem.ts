import type { Buffer } from '../utils/buffer'

export interface DownloadToFileOptions {
  verifyHash?: { algorithm: 'sha256'; hash: Buffer }
}

export interface FileSystem {
  readonly basePath: string

  exists(path: string): Promise<boolean>
  createDirectory(path: string): Promise<void>
  write(path: string, data: string): Promise<void>
  read(path: string): Promise<string>
  downloadToFile(url: string, path: string, options?: DownloadToFileOptions): Promise<void>
}
