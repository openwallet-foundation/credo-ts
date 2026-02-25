import { Buffer } from 'node:buffer'
import type { DecipherGCM } from 'node:crypto'
import { createDecipheriv, createSecretKey, timingSafeEqual } from 'node:crypto'
import { type AnyUint8Array, Kms, type Uint8ArrayBuffer } from '@credo-ts/core'

import { performSign } from './sign'

export async function performDecrypt(
  key: Kms.KmsJwkPrivateOct,
  dataDecryption: Kms.KmsDecryptDataDecryption,
  encrypted: AnyUint8Array
): Promise<{ data: Uint8ArrayBuffer }> {
  const secretKeyBytes = Buffer.from(key.k, 'base64url')
  const nodeKey = createSecretKey(secretKeyBytes)

  // Create decipher with key and IV
  if (dataDecryption.algorithm === 'A128CBC' || dataDecryption.algorithm === 'A256CBC') {
    const nodeAlgorithm = dataDecryption.algorithm === 'A128CBC' ? 'aes-128-cbc' : 'aes-256-cbc'

    const decipher = createDecipheriv(nodeAlgorithm, nodeKey, dataDecryption.iv)

    // Get decrypted data
    const data = Buffer.concat([decipher.update(encrypted), decipher.final()])

    return { data }
  }
  if (
    dataDecryption.algorithm === 'A128GCM' ||
    dataDecryption.algorithm === 'A192GCM' ||
    dataDecryption.algorithm === 'A256GCM'
  ) {
    const nodeAlgorithm =
      dataDecryption.algorithm === 'A128GCM'
        ? 'aes-128-gcm'
        : dataDecryption.algorithm === 'A192GCM'
          ? 'aes-192-gcm'
          : 'aes-256-gcm'

    const decipher = createDecipheriv(nodeAlgorithm, nodeKey, dataDecryption.iv)

    // Set auth tag before decryption for authenticated modes
    decipher.setAuthTag(dataDecryption.tag)

    // If AAD was used during encryption, it must be provided for decryption
    if (dataDecryption.aad) {
      decipher.setAAD(dataDecryption.aad)
    }

    // Get decrypted data
    const data = Buffer.concat([decipher.update(encrypted), decipher.final()])

    return { data }
  }
  if (
    dataDecryption.algorithm === 'A128CBC-HS256' ||
    dataDecryption.algorithm === 'A192CBC-HS384' ||
    dataDecryption.algorithm === 'A256CBC-HS512'
  ) {
    // Map algorithms to their corresponding CBC and HMAC settings
    const algSettings = {
      'A128CBC-HS256': { cbcAlg: 'aes-128-cbc', hmacAlg: 'HS256', keySize: 16 } as const,
      'A192CBC-HS384': { cbcAlg: 'aes-192-cbc', hmacAlg: 'HS384', keySize: 24 } as const,
      'A256CBC-HS512': { cbcAlg: 'aes-256-cbc', hmacAlg: 'HS512', keySize: 32 } as const,
    }[dataDecryption.algorithm]

    // Split the input key into MAC and ENC keys (MAC key is first half, ENC key is second half)
    const macKey = secretKeyBytes.subarray(0, algSettings.keySize)
    const encKey = createSecretKey(secretKeyBytes.subarray(algSettings.keySize))

    // Calculate authentication tag for verification
    // AL (Associated Length) is 64-bit big-endian length of AAD in bits
    const al = Buffer.alloc(8)
    const aadLength = dataDecryption.aad ? dataDecryption.aad.length * 8 : 0
    al.writeBigUInt64BE(BigInt(aadLength))

    // Create concatenated buffer for MAC verification
    const macData = Buffer.concat([dataDecryption.aad ?? Buffer.alloc(0), dataDecryption.iv, encrypted, al])

    // Verify the authentication tag
    const hmac = await performSign({ kty: 'oct', k: macKey.toString('base64url') }, algSettings.hmacAlg, macData)
    const calculatedTag = Buffer.from(hmac).subarray(0, algSettings.keySize) // Truncate to appropriate size

    if (!timingSafeEqual(calculatedTag, dataDecryption.tag)) {
      throw new Kms.KeyManagementError(
        `Error during verification of authentication tag with decryption algorithm '${dataDecryption.algorithm}'`
      )
    }

    // After verification, perform decryption
    const decipher = createDecipheriv(algSettings.cbcAlg, encKey, dataDecryption.iv)
    const data = Buffer.concat([decipher.update(encrypted), decipher.final()])

    return { data }
  }
  if (dataDecryption.algorithm === 'C20P') {
    const decipher: DecipherGCM = createDecipheriv('chacha20-poly1305', nodeKey, dataDecryption.iv, {
      authTagLength: 16,
    })

    // Set auth tag before decryption
    decipher.setAuthTag(dataDecryption.tag)

    // If AAD was used during encryption, it must be provided for decryption
    if (dataDecryption.aad) {
      decipher.setAAD(dataDecryption.aad)
    }

    // Get decrypted data
    const data = Buffer.concat([decipher.update(encrypted), decipher.final()])

    return { data }
  }

  throw new Kms.KeyManagementAlgorithmNotSupportedError(
    `JWA content decryption algorithm '${dataDecryption.algorithm}'`,
    'node'
  )
}
