declare module 'base64url-universal' {
  export function encode(input: Uint8Array | string): string
  export function decode(input: string): Uint8Array
}
