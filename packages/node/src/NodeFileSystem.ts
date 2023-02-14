import type { DownloadToFileOptions, FileSystem } from '@aries-framework/core'

import { AriesFrameworkError, TypedArrayEncoder } from '@aries-framework/core'
import { createHash } from 'crypto'
import fs, { promises } from 'fs'
import http from 'http'
import https from 'https'
import { tmpdir } from 'os'
import { dirname } from 'path'

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

  public async createDirectory(path: string): Promise<void> {
    await promises.mkdir(dirname(path), { recursive: true })
  }

  public async write(path: string, data: string): Promise<void> {
    // Make sure parent directories exist
    await promises.mkdir(dirname(path), { recursive: true })

    return writeFile(path, data, { encoding: 'utf-8' })
  }

  public async read(path: string): Promise<string> {
    return readFile(path, { encoding: 'utf-8' })
  }

  public async downloadToFile(url: string, path: string, options: DownloadToFileOptions) {
    const httpMethod = url.startsWith('https') ? https : http

    // Make sure parent directories exist
    await promises.mkdir(dirname(path), { recursive: true })

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
                  new AriesFrameworkError(
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
          await fs.promises.unlink(path) // Delete the file async. (But we don't check the result)
          reject(`Unable to download file from url: ${url}. ${error.message}`)
        })
    })
  }
}
