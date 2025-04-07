import { Buffer } from 'node:buffer'
import type {
  KmsJwkPrivateEc,
  KmsJwkPrivateOkp,
  KmsJwkPublicEc,
  KmsJwkPublicOkp,
  KnownJwaContentEncryptionAlgorithm,
} from '@credo-ts/core/src/modules/kms'
import type { NodeKmsSupportedEcCrvs } from './createKey'

import { createECDH, createHash, createPrivateKey, createPublicKey } from 'node:crypto'
import { Kms } from '@credo-ts/core'

import { createEcKey, createOkpKey } from './createKey'

const nodeSupportedEcdhKeyDerivationEcCrv = [
  'P-256',
  'P-384',
  'P-521',
  'secp256k1',
] as const satisfies NodeKmsSupportedEcCrvs[]

function assertNodeSupportedEcdhKeyDerivationCrv(
  a: KmsJwkPublicEc | KmsJwkPublicOkp
): asserts a is
  | (KmsJwkPublicEc & { crv: (typeof nodeSupportedEcdhKeyDerivationEcCrv)[number] })
  | (KmsJwkPublicOkp & { crv: 'X25519' }) {
  if (
    (a.kty === 'OKP' && a.crv !== 'X25519') ||
    (a.kty === 'EC' && !(nodeSupportedEcdhKeyDerivationEcCrv as string[]).includes(a.crv))
  ) {
    throw new Kms.KeyManagementAlgorithmNotSupportedError(
      `key derivation with crv '${a.crv}' for kty '${a.kty}'`,
      'node'
    )
  }
}

export async function deriveKey(options: Exclude<Kms.KmsDeriveKeyOptions, 'keyId'>) {
  if (
    options.algorithm === 'ECDH-ES' ||
    options.algorithm === 'ECDH-ES+A128KW' ||
    options.algorithm === 'ECDH-ES+A192KW' ||
    options.algorithm === 'ECDH-ES+A256KW'
  ) {
    assertNodeSupportedEcdhKeyDerivationCrv(options.publicJwk)

    const keyLength =
      options.algorithm === 'ECDH-ES'
        ? mapContentEncryptionAlgorithmToKeyLength(options.encryptionAlgorithm)
        : options.algorithm === 'ECDH-ES+A128KW'
          ? 128
          : options.algorithm === 'ECDH-ES+A192KW'
            ? 192
            : 256

    const { privateJwk } =
      options.publicJwk.kty === 'OKP'
        ? await createOkpKey({ kty: 'OKP', crv: options.publicJwk.crv })
        : await createEcKey({ kty: 'EC', crv: options.publicJwk.crv })

    return await deriveKeyEcdhEs({
      keyLength,
      usageAlgorithm: options.algorithm,
      ephemeralPrivateJwk: privateJwk,
      staticPublicJwk: options.publicJwk,
      apu: options.apu,
      apv: options.apv,
    })
  }

  throw new Kms.KeyManagementAlgorithmNotSupportedError(`JWA key derivation algorithm '${options.algorithm}'`, 'node')
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
  ephemeralPrivateJwk: KmsJwkPrivateEc | KmsJwkPrivateOkp
  staticPublicJwk: KmsJwkPublicEc | KmsJwkPublicOkp
}): Promise<Buffer> {
  const privateKey = createPrivateKey({ format: 'jwk', key: options.ephemeralPrivateJwk })
  const publicKey = createPublicKey({ format: 'jwk', key: options.staticPublicJwk })

  // Create ECDH instance based on curve
  const nodeEcdhCurveName = mapCrvToNodeEcdhCurveName(options.ephemeralPrivateJwk.crv)
  const nodeConcatKdfHash = mapCrvToHashLength(options.ephemeralPrivateJwk.crv)

  const ecdh = createECDH(nodeEcdhCurveName)

  // Set private key
  ecdh.setPrivateKey(privateKey.export({ format: 'der', type: 'pkcs8' }))

  // Compute shared secret
  const sharedSecret = ecdh.computeSecret(publicKey.export({ format: 'der', type: 'spki' }))

  // Prepare other info for KDF
  const otherInfo = Buffer.concat([
    numberTo4ByteUint8Array(options.keyLength), // SuppPubInfo
    Buffer.from(options.usageAlgorithm), // AlgorithmID
    options.apu || Buffer.alloc(0), // PartyUInfo
    options.apv || Buffer.alloc(0), // PartyVInfo
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
function concatKDF(secret: Buffer, length: number, hashLength: ConcatKdfHashLength, otherInfo?: Buffer): Buffer {
  const reps = Math.ceil(length / (hashLength * 8))
  const output = Buffer.alloc(reps * hashLength)

  for (let i = 0; i < reps; i++) {
    const counter = Buffer.alloc(4)
    counter.writeUInt32BE(i + 1)

    const hasher = createHash(`sha${hashLength}`)
    hasher.update(counter)
    hasher.update(secret)
    if (otherInfo) hasher.update(otherInfo)

    hasher.digest().copy(output, i * hashLength)
  }

  return output.subarray(0, length / 8)
}

function mapCrvToNodeEcdhCurveName(crv: KmsJwkPublicEc['crv'] | KmsJwkPublicOkp['crv']) {
  switch (crv) {
    case 'P-256':
    case 'P-384':
    case 'P-521':
    case 'secp256k1':
      return crv
    case 'X25519':
      return 'x25519'
    default:
      throw new Kms.KeyManagementAlgorithmNotSupportedError(`crv '${crv}' for ECDH-ES`, 'node')
  }
}

type ConcatKdfHashLength = ReturnType<typeof mapCrvToHashLength>
function mapCrvToHashLength(crv: KmsJwkPublicEc['crv'] | KmsJwkPublicOkp['crv']) {
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
function mapContentEncryptionAlgorithmToKeyLength(encryptionAlgorithm: KnownJwaContentEncryptionAlgorithm): number {
  switch (encryptionAlgorithm) {
    case 'A128CBC':
    case 'A128GCM':
      return 128
    case 'A128CBC-HS256':
    case 'A256CBC':
    case 'A256GCM':
    case 'C20P':
    case 'XC20P':
      return 256
    case 'A192CBC-HS384':
    case 'A192GCM':
      return 384
    case 'A256CBC-HS512':
      return 512
  }
}
