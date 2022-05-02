export interface FileSystem {
  readonly basePath: string

  exists(path: string): Promise<boolean>
  write(path: string, data: string): Promise<void>
  read(path: string): Promise<string>
  downloadToFile(url: string, path: string): Promise<void>
}
