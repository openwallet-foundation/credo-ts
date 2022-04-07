import type { FileSystem, WalletStorageCreds } from '@aries-framework/core'
import type { WalletStorageConfig } from 'indy-sdk'

import fs, { promises } from 'fs'
import http from 'http'
import https from 'https'
import { tmpdir } from 'os'
import { dirname } from 'path'

import storagePlugin from './postgres.plugin'

const { access, readFile, writeFile } = promises

export class NodeFileSystem implements FileSystem {
  public readonly basePath

  /**
   * Create new NodeFileSystem class instance.
   *
   * @param basePath The base path to use for reading and writing files. process.cwd() if not specified
   */
  public constructor(basePath?: string) {
    this.basePath = basePath ?? tmpdir()
  }

  public async exists(path: string) {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }

  public async write(path: string, data: string): Promise<void> {
    // Make sure parent directories exist
    await promises.mkdir(dirname(path), { recursive: true })

    return writeFile(path, data, { encoding: 'utf-8' })
  }

  public async read(path: string): Promise<string> {
    return readFile(path, { encoding: 'utf-8' })
  }

  public async downloadToFile(url: string, path: string) {
    const httpMethod = url.startsWith('https') ? https : http

    // Make sure parent directories exist
    await promises.mkdir(dirname(path), { recursive: true })

    const file = fs.createWriteStream(path)

    return new Promise<void>((resolve, reject) => {
      httpMethod
        .get(url, (response) => {
          // check if response is success
          if (response.statusCode !== 200) {
            reject(`Unable to download file from url: ${url}. Response status was ${response.statusCode}`)
          }

          response.pipe(file)
          file.on('finish', () => {
            file.close()
            resolve()
          })
        })
        .on('error', async (error) => {
          // Handle errors
          await fs.promises.unlink(path) // Delete the file async. (But we don't check the result)
          reject(`Unable to download file from url: ${url}. ${error.message}`)
        })
    })
  }

  public async loadPostgresPlugin(storageConfig: WalletStorageConfig, storageCreds: WalletStorageCreds) {
    await storagePlugin.postgresstorage_init()
    await storagePlugin.init_storagetype(JSON.stringify(storageConfig), JSON.stringify(storageCreds))
    return true
  }
}
