import { Buffer } from 'node:buffer'
import type { NodeKmsSupportedEcCrvs } from './createKey'

import { createECDH, createHash, getRandomValues, subtle } from 'node:crypto'

import { Kms, TypedArrayEncoder } from '@credo-ts/core'

const nodeSupportedEcdhKeyDerivationEcCrv = [
  'P-256',
  'P-384',
  'P-521',
  'secp256k1',
] as const satisfies NodeKmsSupportedEcCrvs[]

export const nodeSupportedKeyAgreementAlgorithms = [
  'ECDH-ES',
  'ECDH-ES+A128KW',
  'ECDH-ES+A192KW',
  'ECDH-ES+A256KW',
] satisfies Kms.KnownJwaKeyAgreementAlgorithm[]

function assertNodeSupportedEcdhKeyDerivationCrv<Jwk extends Kms.KmsJwkPrivateAsymmetric | Kms.KmsJwkPublicAsymmetric>(
  jwk: Jwk
): asserts jwk is Jwk & { kty: 'OKP' | 'EC'; crv: (typeof nodeSupportedEcdhKeyDerivationEcCrv)[number] | 'X25519' } {
  if (
    (jwk.kty === 'OKP' && jwk.crv !== 'X25519') ||
    (jwk.kty === 'EC' && !(nodeSupportedEcdhKeyDerivationEcCrv as string[]).includes(jwk.crv))
  ) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(
      `key derivation with crv '${jwk.crv}' for kty '${jwk.kty}'`,
      'node'
    )
  }
}

type NodeSupportedKeyAgreementDecryptOptions = Kms.KmsKeyAgreementDecryptOptions & {
  algorithm: (typeof nodeSupportedKeyAgreementAlgorithms)[number]
}
type NodeSupportedKeyAgreementEncryptOptions = Kms.KmsKeyAgreementEncryptOptions & {
  algorithm: (typeof nodeSupportedKeyAgreementAlgorithms)[number]
}

export async function deriveEncryptionKey(options: {
  keyAgreement: NodeSupportedKeyAgreementEncryptOptions
  privateJwk: Kms.KmsJwkPrivateAsymmetric
  encryption: Kms.KmsEncryptDataEncryption
}) {
  const { keyAgreement, encryption, privateJwk } = options

  assertNodeSupportedEcdhKeyDerivationCrv(keyAgreement.externalPublicJwk)
  assertNodeSupportedEcdhKeyDerivationCrv(privateJwk)

  const keyLength =
    keyAgreement.algorithm === 'ECDH-ES'
      ? mapContentEncryptionAlgorithmToKeyLength(encryption.algorithm)
      : keyAgreement.algorithm === 'ECDH-ES+A128KW'
        ? 128
        : keyAgreement.algorithm === 'ECDH-ES+A192KW'
          ? 192
          : 256

  const derivedKeyBytes = await deriveKeyEcdhEs({
    keyLength,
    usageAlgorithm: keyAgreement.algorithm === 'ECDH-ES' ? encryption.algorithm : keyAgreement.algorithm,
    privateJwk,
    publicJwk: keyAgreement.externalPublicJwk,
    apu: keyAgreement.apu,
    apv: keyAgreement.apv,
  })

  if (keyAgreement.algorithm === 'ECDH-ES') {
    return {
      // TODO: will be more efficient to return node key instance
      contentEncryptionKey: {
        kty: 'oct',
        k: derivedKeyBytes.toString('base64url'),
      } as const,
    }
  }

  // Key wrapping
  const derivedKey = await subtle.importKey('raw', derivedKeyBytes, 'AES-KW', true, ['wrapKey'])
  const contentEncryptionKeyBytes = Buffer.from(
    getRandomValues(new Uint8Array(mapContentEncryptionAlgorithmToKeyLength(encryption.algorithm) >> 3))
  )
  const contentEncryptionKey = await subtle.importKey('raw', contentEncryptionKeyBytes, 'AES-KW', true, ['wrapKey'])
  const encryptedContentEncryptionKey = await subtle.wrapKey('raw', contentEncryptionKey, derivedKey, 'AES-KW')

  return {
    encryptedContentEncryptionKey: {
      encrypted: Buffer.from(encryptedContentEncryptionKey),
    } satisfies Kms.KmsEncryptedKey,
    contentEncryptionKey: {
      kty: 'oct',
      k: contentEncryptionKeyBytes.toString('base64url'),
    } as const,
  }
}

export async function deriveDecryptionKey(options: {
  keyAgreement: NodeSupportedKeyAgreementDecryptOptions
  privateJwk: Kms.KmsJwkPrivateAsymmetric
  decryption: Kms.KmsDecryptDataDecryption
}) {
  const { keyAgreement, decryption, privateJwk } = options

  assertNodeSupportedEcdhKeyDerivationCrv(keyAgreement.externalPublicJwk)
  assertNodeSupportedEcdhKeyDerivationCrv(privateJwk)

  const keyLength =
    keyAgreement.algorithm === 'ECDH-ES'
      ? mapContentEncryptionAlgorithmToKeyLength(decryption.algorithm)
      : keyAgreement.algorithm === 'ECDH-ES+A128KW'
        ? 128
        : keyAgreement.algorithm === 'ECDH-ES+A192KW'
          ? 192
          : 256

  const derivedKeyBytes = await deriveKeyEcdhEs({
    keyLength,
    usageAlgorithm: keyAgreement.algorithm === 'ECDH-ES' ? decryption.algorithm : keyAgreement.algorithm,
    privateJwk: privateJwk,
    publicJwk: keyAgreement.externalPublicJwk,
    apu: keyAgreement.apu,
    apv: keyAgreement.apv,
  })

  if (keyAgreement.algorithm === 'ECDH-ES') {
    return {
      // TODO: will be more efficient to return node key instance
      contentEncryptionKey: {
        kty: 'oct',
        k: derivedKeyBytes.toString('base64url'),
      } as const,
    }
  }

  // Key wrapping
  const derivedKey = await subtle.importKey('raw', derivedKeyBytes, 'AES-KW', true, ['wrapKey'])

  const contentEncryptionKey = await subtle.unwrapKey(
    'raw',
    keyAgreement.encryptedKey.encrypted,
    derivedKey,
    'AES-KW',
    // algorithm used is irrelevant
    { hash: 'SHA-256', name: 'HMAC' },
    true,
    ['decrypt']
  )

  return {
    contentEncryptionKey: (await subtle.exportKey('jwk', contentEncryptionKey)) as Kms.KmsJwkPrivate,
  }
}

/**
 * Derive a key using ECDH and Concat KDF
 */
async function deriveKeyEcdhEs(options: {
  keyLength: number
  /**
   * This is only used for the AlgorithmID in KDF
   */
  usageAlgorithm: string
  apv?: Uint8Array
  apu?: Uint8Array
  privateJwk: Kms.KmsJwkPrivateEc | Kms.KmsJwkPrivateOkp
  publicJwk: Kms.KmsJwkPublicEc | Kms.KmsJwkPublicOkp
}): Promise<Buffer> {
  // const privateKey = createPrivateKey({ format: 'jwk', key: options.privateJwk })
  // const publicKey = createPublicKey({ format: 'jwk', key: options.publicJwk })

  // Create ECDH instance based on curve
  const nodeEcdhCurveName = mapCrvToNodeEcdhCurveName(options.privateJwk.crv)
  const nodeConcatKdfHash = mapCrvToHashLength(options.publicJwk.crv)

  const ecdh = createECDH(nodeEcdhCurveName)

  // Set private key
  ecdh.setPrivateKey(TypedArrayEncoder.fromBase64(options.privateJwk.d))

  const publicKey = Kms.PublicJwk.fromPublicJwk(options.publicJwk).publicKey
  if (publicKey.kty === 'RSA') {
    throw new Kms.KeyManagementError('Key type RSA is not supported for ECDH-ES')
  }

  // Compute shared secret
  const sharedSecret = ecdh.computeSecret(publicKey.publicKey)

  // Prepare AlgorithmID for KDF (Datalen || Data)
  const algorithmData = Buffer.from(options.usageAlgorithm) // ASCII representation of alg
  const algorithmID = Buffer.concat([
    numberTo4ByteUint8Array(algorithmData.length), // Datalen: 32-bit big-endian counter
    algorithmData, // Data: ASCII representation of algorithm
  ])

  // Prepare PartyUInfo with proper length prefix
  const apu = options.apu || Buffer.alloc(0)
  const partyUInfo = Buffer.concat([
    numberTo4ByteUint8Array(apu.length), // Datalen: 32-bit big-endian counter
    apu, // Data: PartyUInfo value
  ])

  // Prepare PartyVInfo with proper length prefix
  const apv = options.apv || Buffer.alloc(0)
  const partyVInfo = Buffer.concat([
    numberTo4ByteUint8Array(apv.length), // Datalen: 32-bit big-endian counter
    apv, // Data: PartyVInfo value
  ])

  // Prepare otherInfo for KDF
  const otherInfo = Buffer.concat([
    algorithmID, // AlgorithmID: Datalen || Data
    partyUInfo, // PartyUInfo: Datalen || Data
    partyVInfo, // PartyVInfo: Datalen || Data
    numberTo4ByteUint8Array(options.keyLength), // SuppPubInfo: 32-bit big-endian rep of keydatalen
    Buffer.alloc(0), // SuppPrivInfo (empty octet sequence)
  ])

  // Derive final key using Concat KDF
  return concatKDF(sharedSecret, options.keyLength, nodeConcatKdfHash, otherInfo)
}

function numberTo4ByteUint8Array(number: number) {
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setUint32(0, number)
  return new Uint8Array(buffer)
}

/**
 * Implements Concat KDF as per NIST SP 800-56A
 */
function concatKDF(secret: Buffer, length: number, hashLength: ConcatKdfHashLength, otherInfo: Buffer): Buffer {
  const reps = Math.ceil((length >> 3) / (hashLength >> 3))
  const output = Buffer.alloc(reps * (hashLength >> 3))

  for (let i = 0; i < reps; i++) {
    const counter = Buffer.alloc(4 + secret.length + otherInfo.length)
    counter.writeUInt32BE(i + 1)
    counter.set(secret, 4)
    counter.set(otherInfo, 4 + secret.length)

    createHash(`sha${hashLength}`)
      .update(counter)
      .digest()
      .copy(output, (i * hashLength) >> 3)
  }

  return output.subarray(0, length >> 3)
}

function mapCrvToNodeEcdhCurveName(crv: Kms.KmsJwkPublicEc['crv'] | Kms.KmsJwkPublicOkp['crv']) {
  switch (crv) {
    case 'P-256':
      return 'prime256v1'
    case 'P-384':
      return 'secp384r1'
    case 'P-521':
      return 'secp521r1'
    case 'secp256k1':
      return 'secp256k1'
    case 'X25519':
      return 'x25519'
    default:
      throw new Kms.KeyManagementAlgorithmNotSupportedError(`crv '${crv}' for ECDH-ES`, 'node')
  }
}

type ConcatKdfHashLength = ReturnType<typeof mapCrvToHashLength>
function mapCrvToHashLength(crv: Kms.KmsJwkPublicEc['crv'] | Kms.KmsJwkPublicOkp['crv']) {
  switch (crv) {
    case 'secp256k1':
    case 'X25519':
    case 'P-256':
      return 256
    case 'P-384':
      return 384
    case 'P-521':
      return 512
    default:
      throw new Kms.KeyManagementAlgorithmNotSupportedError(`crv '${crv}' for ECDH-ES`, 'node')
  }
}

// TODO: might be worthwhile to add this to core?
// TODO: we might want to have a separate definition per algorithm
// defines things such as required key length.
function mapContentEncryptionAlgorithmToKeyLength(
  encryptionAlgorithm: Kms.KnownJwaContentEncryptionAlgorithm | Kms.KnownJwaKeyEncryptionAlgorithm
): number {
  switch (encryptionAlgorithm) {
    case 'A128CBC':
    case 'A128GCM':
    case 'A128KW':
      return 128
    case 'A192KW':
      return 192
    case 'A128CBC-HS256':
    case 'A256CBC':
    case 'A256GCM':
    case 'C20P':
    case 'XC20P':
    case 'A256KW':
      return 256

    case 'A192CBC-HS384':
    case 'A192GCM':
      return 384
    case 'A256CBC-HS512':
      return 512
    case 'XSALSA20-POLY1305':
      return 256
  }
}
