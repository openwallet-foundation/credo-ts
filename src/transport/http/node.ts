import https from 'https'
import http from 'http'

import { HttpPostOptions } from './http'

// https://stackoverflow.com/a/50891354/10552895
export function httpPost(url: string, data: string, options?: HttpPostOptions): Promise<string> {
  const httpLib = url.startsWith('http://') ? http : https
  return new Promise((resolve, reject) => {
    const req = httpLib.request(
      url,
      {
        method: 'POST',
        headers: options?.headers,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (data: Buffer) => chunks.push(data))
        res.on('end', () => {
          const body = Buffer.concat(chunks)
          // TODO: return content-type
          resolve(body.toString())
        })
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}
