import { TypedArrayEncoder } from '../../../../../utils'
import { KeyManagementError } from '../../../error/KeyManagementError'
import type { KnownJwaKeyAgreementAlgorithm, KnownJwaSignatureAlgorithm } from '../../jwa'
import type { PublicJwkType } from '../PublicJwk'
import type { KmsJwkPublicAkp } from './akpJwk'

type AkpSignatureAlgorithm = KmsJwkPublicAkp['alg']

const publicKeyLengths: Record<AkpSignatureAlgorithm, number> = {
  'ML-DSA-44': 1312,
  'ML-DSA-65': 1952,
  'ML-DSA-87': 2592,
}

export abstract class AkpPublicJwkBase<Jwk extends KmsJwkPublicAkp> implements PublicJwkType<Jwk> {
  public abstract supportedSignatureAlgorithms: KnownJwaSignatureAlgorithm[]
  public abstract multicodecPrefix: number
  public readonly multibaseEncoding = 'base64url' as const
  public supportedEncryptionKeyAgreementAlgorithms: KnownJwaKeyAgreementAlgorithm[] = []

  protected constructor(public readonly jwk: Jwk) {}

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
}

export function assertPublicKeyLength(algorithm: AkpSignatureAlgorithm, publicKey: Uint8Array) {
  const expectedLength = publicKeyLengths[algorithm]
  if (publicKey.length !== expectedLength) {
    throw new KeyManagementError(
      `Invalid public key length for multicodec with alg '${algorithm}': expected ${expectedLength} bytes, received ${publicKey.length}`
    )
  }
}
