import { parse, stringify, v4, validate } from 'uuid'
import { Hasher } from '../crypto/hashes/Hasher'
import { TypedArrayEncoder } from './TypedArrayEncoder'

export function uuid() {
  return v4()
}

export function isValidUuid(id: string) {
  return validate(id)
}

// https://www.rfc-editor.org/rfc/rfc9562#appendix-B.2
export function uuidFromName(name: string, namespace: string): string {
  const bytes = Hasher.hash(
    TypedArrayEncoder.concat([parse(namespace), TypedArrayEncoder.fromUtf8String(name)]),
    'sha-256'
  ).slice(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x80
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return stringify(bytes)
}
