import type { KmsJwkPrivate, KmsJwkPublic } from './knownJwk'

import * as v from '../../../utils/valibot'
import { KeyManagementError } from '../error/KeyManagementError'

import { getJwkHumanDescription } from './humanDescription'

export const vKnownJwkUse = v.union([
  v.pipe(v.literal('sig'), v.description('signature')),
  v.pipe(v.literal('enc'), v.description('encryption')),
])
export type KnownJwkUse = v.InferOutput<typeof vKnownJwkUse>

export const vJwkUse = v.union([vKnownJwkUse, v.string()])
export type JwkUse = v.InferOutput<typeof vJwkUse>

export const vKnownJwkKeyOps = v.union([
  v.pipe(v.literal('sign'), v.description('compute digital signature or MAC')),
  v.pipe(v.literal('verify'), v.description('verify digital signature or MAC')),
  v.pipe(v.literal('encrypt'), v.description('encrypt content')),
  v.pipe(v.literal('decrypt'), v.description('decrypt content and validate decryption, if applicable')),
  v.pipe(v.literal('wrapKey'), v.description('encrypt key')),
  v.pipe(v.literal('unwrapKey'), v.description('decrypt key and validate decryption, if applicable')),
  v.pipe(v.literal('deriveKey'), v.description('derive key')),
  v.pipe(v.literal('deriveBits'), v.description('derive bits not to be used as a key')),
])
export type KnownJwkKeyOps = v.InferOutput<typeof vKnownJwkKeyOps>

export const vJwkKeyOps = v.uniqueArray(v.union([vKnownJwkKeyOps, v.string()]))
export type JwkKeyOps = v.InferOutput<typeof vJwkKeyOps>

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

const allowedUseKeyOpsMapping = {
  sig: ['sign', 'verify'],
  enc: ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
} satisfies Record<KnownJwkUse, KnownJwkKeyOps[]>

const allowedKeyOpsCombinations = [
  ['sign', 'verify'],
  ['encrypt', 'decrypt'],
  ['wrapKey', 'unwrapKey'],
] satisfies Array<KnownJwkKeyOps[]>
