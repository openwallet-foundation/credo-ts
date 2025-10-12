import type { CipherGCM } from 'node:crypto'

import { Buffer } from 'node:buffer'
import { createCipheriv, createSecretKey, randomBytes } from 'node:crypto'
import { type AnyUint8Array, Kms, type Uint8ArrayBuffer } from '@credo-ts/core'

import { performSign } from './sign'

export const nodeSupportedEncryptionAlgorithms = [
  'A128CBC',
  'A256CBC',
  'A128CBC-HS256',
  'A192CBC-HS384',
  'A256CBC-HS512',
  'A128GCM',
  'A192GCM',
  'A256GCM',
  'C20P',
] as const satisfies Kms.KnownJwaContentEncryptionAlgorithm[]

export async function performEncrypt(
  key: Kms.KmsJwkPrivateOct,
  dataEncryption: Kms.KmsEncryptDataEncryption,
  data: AnyUint8Array
): Promise<{ encrypted: Uint8ArrayBuffer; tag?: Uint8ArrayBuffer; iv: AnyUint8Array }> {
  const secretKeyBytes = Buffer.from(key.k, 'base64url')
  const nodeKey = createSecretKey(secretKeyBytes)

  // Create cipher with key and IV
  if (dataEncryption.algorithm === 'A128CBC' || dataEncryption.algorithm === 'A256CBC') {
    const nodeAlgorithm = dataEncryption.algorithm === 'A128CBC' ? 'aes-128-cbc' : 'aes-256-cbc'

    // IV should be exactly 16 bytes (128 bits) for CBC mode
    const iv = dataEncryption.iv ?? randomBytes(16)

    const cipher = createCipheriv(nodeAlgorithm, nodeKey, iv)

    // Get encrypted data
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])

    return { encrypted, iv }
  }
  if (
    dataEncryption.algorithm === 'A128CBC-HS256' ||
    dataEncryption.algorithm === 'A192CBC-HS384' ||
    dataEncryption.algorithm === 'A256CBC-HS512'
  ) {
    // Map algorithms to their corresponding CBC and HMAC settings
    const algSettings = {
      'A128CBC-HS256': { cbcAlg: 'aes-128-cbc', hmacAlg: 'HS256', keySize: 16 } as const,
      'A192CBC-HS384': { cbcAlg: 'aes-192-cbc', hmacAlg: 'HS384', keySize: 24 } as const,
      'A256CBC-HS512': { cbcAlg: 'aes-256-cbc', hmacAlg: 'HS512', keySize: 32 } as const,
    }[dataEncryption.algorithm]

    // IV should be exactly 16 bytes (128 bits) for CBC mode
    const iv = dataEncryption.iv ?? randomBytes(16)

    // Split the input key into MAC and ENC keys (MAC key is first half, ENC key is second half)
    const macKey = secretKeyBytes.subarray(0, algSettings.keySize)
    const encKey = createSecretKey(secretKeyBytes.subarray(algSettings.keySize))

    // Perform encryption
    const cipher = createCipheriv(algSettings.cbcAlg, encKey, iv)
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])

    // Calculate authentication tag
    // AL (Associated Length) is 64-bit big-endian length of AAD in bits
    const al = Buffer.alloc(8)
    const aadLength = dataEncryption.aad ? dataEncryption.aad.length * 8 : 0
    al.writeBigUInt64BE(BigInt(aadLength))

    // Create concatenated buffer for MAC calculation
    const macData = Buffer.concat([
      // If AAD exists, include it first, otherwise empty buffer
      dataEncryption.aad ?? Buffer.alloc(0),
      iv, // Initial Vector
      encrypted, // Ciphertext
      al, // Associated Length (AL)
    ])

    const hmac = await performSign({ kty: 'oct', k: macKey.toString('base64url') }, algSettings.hmacAlg, macData)
    const tag = Buffer.from(hmac).subarray(0, algSettings.keySize) // Truncate to appropriate size

    return { encrypted, tag, iv }
  }
  if (
    dataEncryption.algorithm === 'A128GCM' ||
    dataEncryption.algorithm === 'A192GCM' ||
    dataEncryption.algorithm === 'A256GCM'
  ) {
    const nodeAlgorithm =
      dataEncryption.algorithm === 'A128GCM'
        ? 'aes-128-gcm'
        : dataEncryption.algorithm === 'A192GCM'
          ? 'aes-192-gcm'
          : 'aes-256-gcm'

    // IV should be exactly 12 bytes (96 bits) for GCM
    const iv = dataEncryption.iv ?? randomBytes(12)

    const cipher = createCipheriv(nodeAlgorithm, nodeKey, iv)

    // If AAD is provided, update the cipher with it before encryption
    if (dataEncryption.aad) {
      cipher.setAAD(dataEncryption.aad)
    }

    // Get encrypted data
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])

    // Get auth tag - must be saved to verify decryption
    const tag = cipher.getAuthTag() as Uint8ArrayBuffer

    return {
      encrypted,
      tag,
      iv,
    }
  }
  if (dataEncryption.algorithm === 'C20P') {
    // IV should be exactly 12 bytes (96 bits) for C20P
    const iv = dataEncryption.iv ?? randomBytes(12)

    const cipher: CipherGCM = createCipheriv('chacha20-poly1305', nodeKey, iv, {
      authTagLength: 16,
    })

    // If AAD is provided, update the cipher with it before encryption
    if (dataEncryption.aad) {
      cipher.setAAD(dataEncryption.aad)
    }

    // Get encrypted data
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])

    // Get auth tag - must be saved to verify decryption
    const tag = cipher.getAuthTag() as Uint8ArrayBuffer

    return {
      encrypted,
      tag,
      iv,
    }
  }

  throw new Kms.KeyManagementAlgorithmNotSupportedError(
    `JWA content encryption algorithm '${dataEncryption.algorithm}'`,
    'node'
  )
}
