import { HttpPostOptions } from './http'

export async function httpPost(url: string, data: string, options?: HttpPostOptions) {
  const response = await fetch(url, { method: 'POST', body: data, headers: options?.headers })
  return response.text()
}
