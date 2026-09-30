import { Buffer } from 'node:buffer'
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  getRandomValues,
} from 'node:crypto'
import { Kms, TypedArrayEncoder } from '@credo-ts/core'
import type { NodeKmsSupportedEcCrvs } from './createKey'

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

// Default IV from RFC 3394 section 2.2.3.1
const aesKeyWrapIv = Buffer.from('a6a6a6a6a6a6a6a6', 'hex')

export async function deriveEncryptionKey(options: {
  keyAgreement: NodeSupportedKeyAgreementEncryptOptions
  privateJwk: Kms.KmsJwkPrivateAsymmetric
  encryption: Kms.KmsEncryptDataContentEncryption
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
  const contentEncryptionKeyBytes = getRandomValues(
    new Uint8Array(mapContentEncryptionAlgorithmToKeyLength(encryption.algorithm) >> 3)
  )
  const cipher = createCipheriv(`id-aes${keyLength}-wrap`, derivedKeyBytes, aesKeyWrapIv)

  return {
    encryptedContentEncryptionKey: {
      encrypted: Buffer.concat([cipher.update(contentEncryptionKeyBytes), cipher.final()]),
    } satisfies Kms.KmsEncryptedKey,
    contentEncryptionKey: {
      kty: 'oct',
      k: TypedArrayEncoder.toBase64Url(contentEncryptionKeyBytes),
    } as const,
  }
}

export async function deriveDecryptionKey(options: {
  keyAgreement: NodeSupportedKeyAgreementDecryptOptions
  privateJwk: Kms.KmsJwkPrivateAsymmetric
  decryption: Kms.KmsDecryptDataContentDecryption
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
  const decipher = createDecipheriv(`id-aes${keyLength}-wrap`, derivedKeyBytes, aesKeyWrapIv)
  const contentEncryptionKeyBytes = Buffer.concat([
    decipher.update(keyAgreement.encryptedKey.encrypted),
    decipher.final(),
  ])

  return {
    contentEncryptionKey: {
      kty: 'oct',
      k: contentEncryptionKeyBytes.toString('base64url'),
    } as const,
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
  const sharedSecret = diffieHellman({
    privateKey: createPrivateKey({ format: 'jwk', key: options.privateJwk }),
    publicKey: createPublicKey({ format: 'jwk', key: options.publicJwk }),
  })

  // Prepare AlgorithmID for KDF (Datalen || Data)
  const algorithmData = TypedArrayEncoder.fromUtf8String(options.usageAlgorithm) // ASCII representation of alg
  const algorithmID = TypedArrayEncoder.concat([
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
  return concatKDF(sharedSecret, options.keyLength, otherInfo)
}

function numberTo4ByteUint8Array(number: number) {
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setUint32(0, number)
  return new Uint8Array(buffer)
}

/**
 * Implements Concat KDF as per NIST SP 800-56A, with SHA-256 for every curve (RFC 7518 section 4.6.2)
 */
function concatKDF(secret: Buffer, length: number, otherInfo: Buffer): Buffer {
  const hashLength = 256
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
    case 'A192GCM':
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
      return 384
    case 'A256CBC-HS512':
      return 512
    case 'XSALSA20-POLY1305':
      return 256
  }
}
