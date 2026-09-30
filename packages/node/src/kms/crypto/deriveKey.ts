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
import { createEcKey, createOkpKey, type NodeKmsSupportedEcCrvs } from './createKey'
import { performEncrypt } from './encrypt'

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
  'ECDH-1PU+A256KW',
] satisfies Kms.KnownJwaKeyAgreementAlgorithm[]

// draft-madden-jose-ecdh-1pu-04 section 2.1: key wrapping mode MUST reject content encryption other than AES_CBC_HMAC_SHA2
export const nodeSupportedEcdh1PuContentEncryptionAlgorithms = [
  'A128CBC-HS256',
  'A192CBC-HS384',
  'A256CBC-HS512',
] as const satisfies Kms.KnownJwaContentEncryptionAlgorithm[]

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
  algorithm: Exclude<(typeof nodeSupportedKeyAgreementAlgorithms)[number], 'ECDH-1PU+A256KW'>
}

function assertNodeSupportedEcdh1PuContentEncryptionAlgorithm<
  Encryption extends Kms.KmsEncryptDataContentEncryption | Kms.KmsDecryptDataContentDecryption,
>(
  encryption: Encryption
): asserts encryption is Encryption & { algorithm: (typeof nodeSupportedEcdh1PuContentEncryptionAlgorithms)[number] } {
  if (!(nodeSupportedEcdh1PuContentEncryptionAlgorithms as readonly string[]).includes(encryption.algorithm)) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(
      `content encryption algorithm '${encryption.algorithm}' with key agreement algorithm 'ECDH-1PU+A256KW'`,
      'node'
    )
  }
}

// Default IV from RFC 3394 section 2.2.3.1
const aesKeyWrapIv = Buffer.from('a6a6a6a6a6a6a6a6', 'hex')

const x25519Pkcs8Prefix = Buffer.from('302e020100300506032b656e04220420', 'hex')

// Same conversion as libsodium crypto_sign_ed25519_sk_to_curve25519, which Askar uses for DIDComm
export function toKeyAgreementPrivateJwk(privateJwk: Kms.KmsJwkPrivateAsymmetric): Kms.KmsJwkPrivateAsymmetric {
  if (privateJwk.kty !== 'OKP' || privateJwk.crv !== 'Ed25519') return privateJwk

  const scalar = createHash('sha512').update(TypedArrayEncoder.fromBase64Url(privateJwk.d)).digest().subarray(0, 32)
  scalar[0] &= 248
  scalar[31] &= 127
  scalar[31] |= 64

  return createPrivateKey({
    key: Buffer.concat([x25519Pkcs8Prefix, scalar]),
    format: 'der',
    type: 'pkcs8',
  }).export({ format: 'jwk' }) as Kms.KmsJwkPrivateOkp
}

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
      contentEncryptionKey: {
        kty: 'oct',
        k: derivedKeyBytes.toString('base64url'),
      } as const,
    }
  }

  const contentEncryptionKeyBytes = getRandomValues(
    new Uint8Array(mapContentEncryptionAlgorithmToKeyLength(encryption.algorithm) >> 3)
  )

  return {
    encryptedContentEncryptionKey: {
      encrypted: aesKeyWrap(derivedKeyBytes, contentEncryptionKeyBytes),
    } satisfies Kms.KmsEncryptedKey,
    contentEncryptionKey: {
      kty: 'oct',
      k: TypedArrayEncoder.toBase64Url(contentEncryptionKeyBytes),
    } as const,
  }
}

/**
 * ECDH-1PU key wrapping mode (draft-madden-jose-ecdh-1pu-04 section 2.1). The content is encrypted first
 * because its authentication tag is an input to the key derivation.
 */
export async function encryptEcdh1Pu(options: {
  keyAgreement: Kms.KmsKeyAgreementEncryptOptions & { algorithm: 'ECDH-1PU+A256KW' }
  encryption: Kms.KmsEncryptDataContentEncryption
  senderPrivateJwk: Kms.KmsJwkPrivateAsymmetric
  ephemeralPrivateJwk?: Kms.KmsJwkPrivateAsymmetric
  data: Uint8Array
}): Promise<Kms.KmsEncryptReturn> {
  const { keyAgreement, encryption, senderPrivateJwk, data } = options
  assertNodeSupportedEcdh1PuContentEncryptionAlgorithm(encryption)

  const recipientPublicJwk = keyAgreement.externalPublicJwk
  const ephemeralPrivateJwk =
    options.ephemeralPrivateJwk ??
    (
      await (recipientPublicJwk.kty === 'OKP'
        ? createOkpKey({ kty: 'OKP', crv: 'X25519' })
        : createEcKey({ kty: 'EC', crv: recipientPublicJwk.crv }))
    ).privateJwk
  Kms.assertAsymmetricJwkKeyTypeMatches(ephemeralPrivateJwk, recipientPublicJwk)

  const contentEncryptionKeyBytes = getRandomValues(
    new Uint8Array(mapContentEncryptionAlgorithmToKeyLength(encryption.algorithm) >> 3)
  )
  const { encrypted, iv, tag } = await performEncrypt(
    { kty: 'oct', k: TypedArrayEncoder.toBase64Url(contentEncryptionKeyBytes) },
    encryption,
    data
  )
  if (!tag) throw new Kms.KeyManagementError('Expected authentication tag from content encryption')

  const keyEncryptionKey = deriveKeyEcdh1Pu({
    ephemeralSecret: ecdhSharedSecret(ephemeralPrivateJwk, recipientPublicJwk),
    staticSecret: ecdhSharedSecret(senderPrivateJwk, recipientPublicJwk),
    apu: keyAgreement.apu,
    apv: keyAgreement.apv,
    tag,
  })

  return {
    encrypted,
    iv,
    tag,
    encryptedKey: {
      encrypted: aesKeyWrap(keyEncryptionKey, contentEncryptionKeyBytes),
      ephemeralPublicKey: Kms.publicJwkFromPrivateJwk(ephemeralPrivateJwk) as Kms.KmsJwkPublicEcdh,
    },
  }
}

export async function deriveDecryptionKey(options: {
  keyAgreement: NodeSupportedKeyAgreementDecryptOptions
  privateJwk: Kms.KmsJwkPrivateAsymmetric
  decryption: Kms.KmsDecryptDataContentDecryption
}) {
  const { keyAgreement, decryption, privateJwk } = options

  if (keyAgreement.algorithm === 'ECDH-1PU+A256KW') {
    return deriveDecryptionKeyEcdh1Pu({ keyAgreement, decryption, privateJwk })
  }

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
  const contentEncryptionKeyBytes = aesKeyUnwrap(derivedKeyBytes, keyAgreement.encryptedKey.encrypted)

  return {
    contentEncryptionKey: {
      kty: 'oct',
      k: contentEncryptionKeyBytes.toString('base64url'),
    } as const,
  }
}

function deriveDecryptionKeyEcdh1Pu(options: {
  keyAgreement: Kms.KmsKeyAgreementDecryptOptions & { algorithm: 'ECDH-1PU+A256KW' }
  decryption: Kms.KmsDecryptDataContentDecryption
  privateJwk: Kms.KmsJwkPrivateAsymmetric
}): { contentEncryptionKey: Kms.KmsJwkPrivateOct } {
  const { keyAgreement, decryption, privateJwk } = options
  assertNodeSupportedEcdh1PuContentEncryptionAlgorithm(decryption)

  const keyEncryptionKey = deriveKeyEcdh1Pu({
    ephemeralSecret: ecdhSharedSecret(privateJwk, keyAgreement.ephemeralPublicJwk),
    staticSecret: ecdhSharedSecret(privateJwk, keyAgreement.senderPublicJwk),
    apu: keyAgreement.apu,
    apv: keyAgreement.apv,
    tag: decryption.tag,
  })

  return {
    contentEncryptionKey: {
      kty: 'oct',
      k: TypedArrayEncoder.toBase64Url(aesKeyUnwrap(keyEncryptionKey, keyAgreement.encryptedKey.encrypted)),
    },
  }
}

function deriveKeyEcdh1Pu(options: {
  ephemeralSecret: Buffer
  staticSecret: Buffer
  apu?: Uint8Array
  apv?: Uint8Array
  tag: Uint8Array
}): Buffer {
  return concatKDF(
    Buffer.concat([options.ephemeralSecret, options.staticSecret]),
    256,
    concatKdfOtherInfo({
      algorithm: 'ECDH-1PU+A256KW',
      keyLength: 256,
      apu: options.apu,
      apv: options.apv,
      ccTag: options.tag,
    })
  )
}

function ecdhSharedSecret(privateJwk: Kms.KmsJwkPrivateAsymmetric, publicJwk: Kms.KmsJwkPublicAsymmetric): Buffer {
  return diffieHellman({
    privateKey: createPrivateKey({ format: 'jwk', key: privateJwk }),
    publicKey: createPublicKey({ format: 'jwk', key: publicJwk }),
  })
}

function aesKeyWrap(keyEncryptionKey: Uint8Array, contentEncryptionKey: Uint8Array): Buffer {
  const cipher = createCipheriv(`id-aes${keyEncryptionKey.length * 8}-wrap`, keyEncryptionKey, aesKeyWrapIv)
  return Buffer.concat([cipher.update(contentEncryptionKey), cipher.final()])
}

function aesKeyUnwrap(keyEncryptionKey: Uint8Array, encryptedContentEncryptionKey: Uint8Array): Buffer {
  try {
    const decipher = createDecipheriv(`id-aes${keyEncryptionKey.length * 8}-wrap`, keyEncryptionKey, aesKeyWrapIv)
    return Buffer.concat([decipher.update(encryptedContentEncryptionKey), decipher.final()])
  } catch (error) {
    throw new Kms.KeyManagementError('Error unwrapping content encryption key', { cause: error })
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
  return concatKDF(
    ecdhSharedSecret(options.privateJwk, options.publicJwk),
    options.keyLength,
    concatKdfOtherInfo({
      algorithm: options.usageAlgorithm,
      keyLength: options.keyLength,
      apu: options.apu,
      apv: options.apv,
    })
  )
}

function concatKdfOtherInfo(options: {
  algorithm: string
  keyLength: number
  apu?: Uint8Array
  apv?: Uint8Array
  ccTag?: Uint8Array
}): Buffer {
  // Prepare AlgorithmID for KDF (Datalen || Data)
  const algorithmData = TypedArrayEncoder.fromUtf8String(options.algorithm) // ASCII representation of alg
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

  // ECDH-1PU key wrapping appends Datalen || tag to SuppPubInfo (draft-madden-jose-ecdh-1pu-04 section 2.3)
  const ccTag = options.ccTag ? [numberTo4ByteUint8Array(options.ccTag.length), options.ccTag] : []

  return Buffer.concat([
    algorithmID, // AlgorithmID: Datalen || Data
    partyUInfo, // PartyUInfo: Datalen || Data
    partyVInfo, // PartyVInfo: Datalen || Data
    numberTo4ByteUint8Array(options.keyLength), // SuppPubInfo: 32-bit big-endian rep of keydatalen
    ...ccTag,
    Buffer.alloc(0), // SuppPrivInfo (empty octet sequence)
  ])
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
