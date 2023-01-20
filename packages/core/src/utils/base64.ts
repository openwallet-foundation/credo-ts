import { Buffer } from './buffer'

export function base64ToBase64URL(base64: string) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function uint8ArrayToBase64URL(array: Uint8Array) {
  return base64ToBase64URL(Buffer.from(array).toString('base64'))
}
