import type { DownloadToFileOptions, FileSystem } from '@credo-ts/core'

import { createHash } from 'crypto'
import fs, { promises } from 'fs'
import http from 'http'
import https from 'https'
import { homedir, tmpdir } from 'os'
import { dirname } from 'path'
import { CredoError, TypedArrayEncoder } from '@credo-ts/core'

const { access, readFile, writeFile, mkdir, rm, unlink, copyFile } = promises

export class NodeFileSystem implements FileSystem {
  public readonly dataPath
  public readonly cachePath
  public readonly tempPath

  /**
   * Create new NodeFileSystem class instance.
   *
   * @param baseDataPath The base path to use for reading and writing data files used within the framework.
   * Files will be created under baseDataPath/.afj directory. If not specified, it will be set to homedir()
   * @param baseCachePath The base path to use for reading and writing cache files used within the framework.
   * Files will be created under baseCachePath/.afj directory. If not specified, it will be set to homedir()
   * @param baseTempPath The base path to use for reading and writing temporary files within the framework.
   * Files will be created under baseTempPath/.afj directory. If not specified, it will be set to tmpdir()
   */
  public constructor(options?: { baseDataPath?: string; baseCachePath?: string; baseTempPath?: string }) {
    this.dataPath = options?.baseDataPath ? `${options?.baseDataPath}/.afj` : `${homedir()}/.afj/data`
    this.cachePath = options?.baseCachePath ? `${options?.baseCachePath}/.afj` : `${homedir()}/.afj/cache`
    this.tempPath = `${options?.baseTempPath ?? tmpdir()}/.afj`
  }

  public async exists(path: string) {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }

  public async createDirectory(path: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true })
  }

  public async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    await copyFile(sourcePath, destinationPath)
  }

  public async write(path: string, data: string): Promise<void> {
    // Make sure parent directories exist
    await mkdir(dirname(path), { recursive: true })

    return writeFile(path, data, { encoding: 'utf-8' })
  }

  public async read(path: string): Promise<string> {
    return readFile(path, { encoding: 'utf-8' })
  }

  public async delete(path: string): Promise<void> {
    await rm(path, { recursive: true, force: true })
  }

  public async downloadToFile(url: string, path: string, options: DownloadToFileOptions) {
    const httpMethod = url.startsWith('https') ? https : http

    // Make sure parent directories exist
    await mkdir(dirname(path), { recursive: true })

    const file = fs.createWriteStream(path)
    const hash = options.verifyHash ? createHash('sha256') : undefined

    return new Promise<void>((resolve, reject) => {
      httpMethod
        .get(url, (response) => {
          // check if response is success
          if (response.statusCode !== 200) {
            reject(`Unable to download file from url: ${url}. Response status was ${response.statusCode}`)
          }

          hash && response.pipe(hash)
          response.pipe(file)
          file.on('finish', async () => {
            file.close()

            if (hash && options.verifyHash?.hash) {
              hash.end()
              const digest = hash.digest()
              if (digest.compare(options.verifyHash.hash) !== 0) {
                await fs.promises.unlink(path)

                reject(
                  new CredoError(
                    `Hash of downloaded file does not match expected hash. Expected: ${
                      options.verifyHash.hash
                    }, Actual: ${TypedArrayEncoder.toUtf8String(digest)})}`
                  )
                )
              }
            }
            resolve()
          })
        })
        .on('error', async (error) => {
          // Handle errors
          await unlink(path) // Delete the file async. (But we don't check the result)
          reject(`Unable to download file from url: ${url}. ${error.message}`)
        })
    })
  }
}
