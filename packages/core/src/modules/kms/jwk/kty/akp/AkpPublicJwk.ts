import { TypedArrayEncoder } from '../../../../../utils'
import { KeyManagementError } from '../../../error/KeyManagementError'
import { supportedSigningAlgsForKey } from '../../alg/signing'
import type { KnownJwaKeyAgreementAlgorithm, KnownJwaSignatureAlgorithm } from '../../jwa'
import type { PublicJwkType } from '../PublicJwk'
import type { KmsJwkPublicAkp } from './akpJwk'

type Jwk = KmsJwkPublicAkp

const multicodecPrefixes = {
  'ML-DSA-44': 0x1210,
  'ML-DSA-65': 0x1211,
  'ML-DSA-87': 0x1212,
} as const

const publicKeyLengths = {
  'ML-DSA-44': 1312,
  'ML-DSA-65': 1952,
  'ML-DSA-87': 2592,
} as const

type AkpSignatureAlgorithm = keyof typeof multicodecPrefixes

export class AkpPublicJwk implements PublicJwkType<Jwk> {
  public static supportedEncryptionKeyAgreementAlgorithms: KnownJwaKeyAgreementAlgorithm[] = []
  public static supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[] = ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87']
  public static multicodecPrefix: undefined = undefined

  public supportedEncryptionKeyAgreementAlgorithms = AkpPublicJwk.supportedEncryptionKeyAgreementAlgorithms

  public get multicodecPrefix() {
    return multicodecPrefixes[this.jwk.alg]
  }

  public get supportedSignatureAlgorithms() {
    return supportedSigningAlgsForKey(this.jwk)
  }

  public constructor(public readonly jwk: Jwk) {}

  public get publicKey(): never {
    throw new KeyManagementError('Byte public keys are not supported for AKP JWKs')
  }

  public get compressedPublicKey(): never {
    throw new KeyManagementError('Compressed public keys are not supported for AKP JWKs')
  }

  public get multicodec() {
    const publicKey = TypedArrayEncoder.fromBase64Url(this.jwk.pub)
    assertPublicKeyLength(this.jwk.alg, publicKey)
    return publicKey
  }

  public static fromPublicKey(): never {
    throw new KeyManagementError('Creating AKP JWKs from byte public keys is not supported')
  }

  public static fromMulticodec(): never {
    throw new KeyManagementError('Creating AKP JWKs from multicodec requires an algorithm prefix')
  }

  public static supportsMulticodecPrefix(multicodecPrefix: number) {
    return Object.values(multicodecPrefixes).includes(
      multicodecPrefix as (typeof multicodecPrefixes)[AkpSignatureAlgorithm]
    )
  }

  public static fromMulticodecPrefix(multicodecPrefix: number, multicodec: Uint8Array) {
    const algorithm = (Object.entries(multicodecPrefixes) as Array<[AkpSignatureAlgorithm, number]>).find(
      ([, prefix]) => prefix === multicodecPrefix
    )?.[0]

    if (!algorithm) {
      throw new KeyManagementError(`Unsupported AKP multicodec prefix '${multicodecPrefix}'`)
    }

    assertPublicKeyLength(algorithm, multicodec)
    return new AkpPublicJwk({
      kty: 'AKP',
      alg: algorithm,
      pub: TypedArrayEncoder.toBase64Url(multicodec),
    })
  }
}

function assertPublicKeyLength(algorithm: AkpSignatureAlgorithm, publicKey: Uint8Array) {
  const expectedLength = publicKeyLengths[algorithm]
  if (publicKey.length !== expectedLength) {
    throw new KeyManagementError(
      `Invalid public key length for multicodec with alg '${algorithm}': expected ${expectedLength} bytes, received ${publicKey.length}`
    )
  }
}
