import { z } from 'zod'
import { zUniqueArray } from '../../../utils/zod'
import { KeyManagementError } from '../error/KeyManagementError'
import { getJwkHumanDescription } from './humanDescription'
import type { KmsJwkPrivate, KmsJwkPublic } from './knownJwk'

export const zKnownJwkUse = z.union([z.literal('sig').describe('signature'), z.literal('enc').describe('encryption')])
export type KnownJwkUse = z.output<typeof zKnownJwkUse>

export const zJwkUse = z.union([zKnownJwkUse, z.string()])
export type JwkUse = z.output<typeof zJwkUse>

export const zKnownJwkKeyOps = z.union([
  z.literal('sign').describe('compute digital signature or MAC'),
  z.literal('verify').describe('verify digital signature or MAC'),
  z.literal('encrypt').describe('encrypt content'),
  z.literal('decrypt').describe('decrypt content and validate decryption, if applicable'),
  z.literal('wrapKey').describe('encrypt key'),
  z.literal('unwrapKey').describe('decrypt key and validate decryption, if applicable'),
  z.literal('deriveKey').describe('derive key'),
  z.literal('deriveBits').describe('derive bits not to be used as a key'),
])
export type KnownJwkKeyOps = z.output<typeof zKnownJwkKeyOps>

export const zJwkKeyOps = zUniqueArray(z.union([zKnownJwkKeyOps, z.string()]))
export type JwkKeyOps = z.output<typeof zJwkKeyOps>

export function keyAllowsDerive(key: KmsJwkPublic | KmsJwkPrivate): boolean {
  // Check if key has use/key_ops restrictions
  if (key.use && key.use !== 'enc') {
    return false
  }
  if (key.key_ops && !key.key_ops.includes('deriveKey')) {
    return false
  }
  return true
}

export function assertKeyAllowsDerive(jwk: KmsJwkPrivate | KmsJwkPublic) {
  if (!keyAllowsDerive(jwk)) {
    throw new KeyManagementError(`${getJwkHumanDescription(jwk)} usage does not allow key derivation operations`)
  }
}

export function keyAllowsVerify(key: KmsJwkPublic | KmsJwkPrivate): boolean {
  // Check if key has use/key_ops restrictions
  if (key.use && key.use !== 'sig') {
    return false
  }
  if (key.key_ops && !key.key_ops.includes('verify')) {
    return false
  }
  return true
}

export function assertKeyAllowsVerify(jwk: KmsJwkPrivate | KmsJwkPublic) {
  if (!keyAllowsVerify(jwk)) {
    throw new KeyManagementError(`${getJwkHumanDescription(jwk)} usage does not allow verification operations`)
  }
}

export function keyAllowsSign(key: KmsJwkPrivate | KmsJwkPublic): boolean {
  // Check if key has use/key_ops restrictions
  if (key.use && key.use !== 'sig') {
    return false
  }
  if (key.key_ops && !key.key_ops.includes('sign')) {
    return false
  }
  return true
}

export function assertKeyAllowsSign(jwk: KmsJwkPrivate | KmsJwkPublic) {
  if (!keyAllowsSign(jwk)) {
    throw new KeyManagementError(`${getJwkHumanDescription(jwk)} usage does not allow signing operations`)
  }
}

export function keyAllowsEncrypt(key: KmsJwkPublic | KmsJwkPrivate): boolean {
  // Check if key has use/key_ops restrictions
  if (key.use && key.use !== 'enc') {
    return false
  }
  if (key.key_ops && !key.key_ops.includes('encrypt')) {
    return false
  }
  return true
}

export function assertKeyAllowsEncrypt(jwk: KmsJwkPrivate | KmsJwkPublic) {
  if (!keyAllowsEncrypt(jwk)) {
    throw new KeyManagementError(`${getJwkHumanDescription(jwk)} usage does not allow encryption operations`)
  }
}

export function keyAllowsDecrypt(key: KmsJwkPublic | KmsJwkPrivate): boolean {
  // Check if key has use/key_ops restrictions
  if (key.use && key.use !== 'enc') {
    return false
  }
  if (key.key_ops && !key.key_ops.includes('decrypt')) {
    return false
  }
  return true
}

export function assertKeyAllowsDecrypt(jwk: KmsJwkPrivate | KmsJwkPublic) {
  if (!keyAllowsDecrypt(jwk)) {
    throw new KeyManagementError(`${getJwkHumanDescription(jwk)} usage does not allow decryption operations`)
  }
}
