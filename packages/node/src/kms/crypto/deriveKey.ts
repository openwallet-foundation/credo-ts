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
import { performEncrypt } from './encrypt'

export const nodeSupportedKeyAgreementAlgorithms = [
  'ECDH-ES',
  'ECDH-ES+A128KW',
  'ECDH-ES+A192KW',
  'ECDH-ES+A256KW',
  'ECDH-1PU+A256KW',
] satisfies Kms.KnownJwaKeyAgreementAlgorithm[]

type NodeSupportedKeyAgreementDecryptOptions = Kms.KmsKeyAgreementDecryptOptions & {
  algorithm: (typeof nodeSupportedKeyAgreementAlgorithms)[number]
}
type NodeSupportedKeyAgreementEncryptOptions = Kms.KmsKeyAgreementEncryptOptions & {
  algorithm: (typeof nodeSupportedKeyAgreementAlgorithms)[number]
}

// Default IV from RFC 3394 section 2.2.3.1
const aesKeyWrapIv = Buffer.from('a6a6a6a6a6a6a6a6', 'hex')

export async function encryptEcdh(options: {
  keyAgreement: NodeSupportedKeyAgreementEncryptOptions
  encryption: Kms.KmsEncryptDataContentEncryption
  aad?: Uint8Array
  ephemeralPrivateJwk: Kms.KmsJwkPrivateAsymmetric
  senderPrivateJwk?: Kms.KmsJwkPrivateAsymmetric
  data: Uint8Array
}): Promise<{ encrypted: Uint8Array; iv: Uint8Array; tag?: Uint8Array; encryptedKeys?: Kms.KmsEncryptedKey[] }> {
  const { keyAgreement, encryption, aad, ephemeralPrivateJwk, senderPrivateJwk, data } = options
  const kdfOptions = {
    keyAgreementAlgorithm: keyAgreement.algorithm,
    encryptionAlgorithm: encryption.algorithm,
    apu: keyAgreement.apu,
    apv: keyAgreement.apv,
  }

  if (keyAgreement.algorithm === 'ECDH-ES') {
    const contentEncryptionKey = deriveEcdhKey(
      ecdhSharedSecret(ephemeralPrivateJwk, keyAgreement.externalPublicJwk),
      kdfOptions
    )
    return await performEncrypt({ kty: 'oct', k: contentEncryptionKey.toString('base64url') }, encryption, data, aad)
  }

  const contentEncryptionKey = getRandomValues(
    new Uint8Array(mapContentEncryptionAlgorithmToKeyLength(encryption.algorithm) >> 3)
  )
  // Encrypt before wrapping, since ECDH-1PU puts the authentication tag into the key derivation
  const { encrypted, iv, tag } = await performEncrypt(
    { kty: 'oct', k: TypedArrayEncoder.toBase64Url(contentEncryptionKey) },
    encryption,
    data,
    aad
  )

  const isEcdh1Pu = keyAgreement.algorithm === 'ECDH-1PU+A256KW'
  if (isEcdh1Pu && (!senderPrivateJwk || !tag)) {
    throw new Kms.KeyManagementError(`Expected a sender key and an authentication tag for 'ECDH-1PU+A256KW'`)
  }

  const encryptedKeys = keyAgreement.recipients.map(({ externalPublicJwk }) => {
    const sharedSecret = Buffer.concat([
      ecdhSharedSecret(ephemeralPrivateJwk, externalPublicJwk),
      ...(isEcdh1Pu && senderPrivateJwk ? [ecdhSharedSecret(senderPrivateJwk, externalPublicJwk)] : []),
    ])
    const keyEncryptionKey = deriveEcdhKey(sharedSecret, { ...kdfOptions, ccTag: isEcdh1Pu ? tag : undefined })

    return { encrypted: aesKeyWrap(keyEncryptionKey, contentEncryptionKey) }
  })

  return { encrypted, iv, tag, encryptedKeys }
}

export function deriveDecryptionKey(options: {
  keyAgreement: NodeSupportedKeyAgreementDecryptOptions
  privateJwk: Kms.KmsJwkPrivateAsymmetric
  decryption: Kms.KmsDecryptDataContentDecryption
}): { contentEncryptionKey: Kms.KmsJwkPrivateOct } {
  const { keyAgreement, decryption, privateJwk } = options

  const isEcdh1Pu = keyAgreement.algorithm === 'ECDH-1PU+A256KW'
  const sharedSecret = Buffer.concat([
    ecdhSharedSecret(privateJwk, keyAgreement.ephemeralPublicJwk),
    ...(isEcdh1Pu ? [ecdhSharedSecret(privateJwk, keyAgreement.senderPublicJwk)] : []),
  ])
  const derivedKey = deriveEcdhKey(sharedSecret, {
    keyAgreementAlgorithm: keyAgreement.algorithm,
    encryptionAlgorithm: decryption.algorithm,
    apu: keyAgreement.apu,
    apv: keyAgreement.apv,
    ccTag: isEcdh1Pu && 'tag' in decryption ? decryption.tag : undefined,
  })

  const contentEncryptionKey =
    keyAgreement.algorithm === 'ECDH-ES' ? derivedKey : aesKeyUnwrap(derivedKey, keyAgreement.encryptedKey.encrypted)

  return { contentEncryptionKey: { kty: 'oct', k: contentEncryptionKey.toString('base64url') } }
}

function ecdhSharedSecret(privateJwk: Kms.KmsJwkPrivateAsymmetric, publicJwk: Kms.KmsJwkPublicAsymmetric): Buffer {
  return diffieHellman({
    privateKey: createPrivateKey({ format: 'jwk', key: privateJwk }),
    publicKey: createPublicKey({ format: 'jwk', key: publicJwk }),
  })
}

function aesKeyWrap(keyEncryptionKey: Uint8Array, contentEncryptionKey: Uint8Array): Uint8Array {
  const cipher = createCipheriv(`id-aes${keyEncryptionKey.length * 8}-wrap`, keyEncryptionKey, aesKeyWrapIv)
  return new Uint8Array(Buffer.concat([cipher.update(contentEncryptionKey), cipher.final()]))
}

function aesKeyUnwrap(keyEncryptionKey: Uint8Array, encryptedContentEncryptionKey: Uint8Array): Buffer {
  try {
    const decipher = createDecipheriv(`id-aes${keyEncryptionKey.length * 8}-wrap`, keyEncryptionKey, aesKeyWrapIv)
    return Buffer.concat([decipher.update(encryptedContentEncryptionKey), decipher.final()])
  } catch (error) {
    throw new Kms.KeyManagementError('Error unwrapping content encryption key', { cause: error })
  }
}

function deriveEcdhKey(
  sharedSecret: Buffer,
  options: {
    keyAgreementAlgorithm: (typeof nodeSupportedKeyAgreementAlgorithms)[number]
    encryptionAlgorithm: Kms.KnownJwaContentEncryptionAlgorithm
    apu?: Uint8Array
    apv?: Uint8Array
    ccTag?: Uint8Array
  }
): Buffer {
  const { keyAgreementAlgorithm, encryptionAlgorithm } = options
  const keyLength =
    keyAgreementAlgorithm === 'ECDH-ES'
      ? mapContentEncryptionAlgorithmToKeyLength(encryptionAlgorithm)
      : keyAgreementAlgorithm === 'ECDH-ES+A128KW'
        ? 128
        : keyAgreementAlgorithm === 'ECDH-ES+A192KW'
          ? 192
          : 256

  return concatKDF(
    sharedSecret,
    keyLength,
    concatKdfOtherInfo({
      algorithm: keyAgreementAlgorithm === 'ECDH-ES' ? encryptionAlgorithm : keyAgreementAlgorithm,
      keyLength,
      apu: options.apu,
      apv: options.apv,
      ccTag: options.ccTag,
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
