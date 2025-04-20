import { KeyManagementError } from '../error/KeyManagementError'
import { KmsJwkPublicAsymmetric } from './knownJwk'
import { ecPublicJwkToPublicKey, okpPublicJwkToPublicKey, rsaPublicJwkToPublicKey } from './kty'

export function publicJwkAsymmetricToPublicKey(publicJwk: KmsJwkPublicAsymmetric): Uint8Array {
  if (publicJwk.kty === 'EC') {
    return ecPublicJwkToPublicKey(publicJwk)
  }

  if (publicJwk.kty === 'OKP') {
    return okpPublicJwkToPublicKey(publicJwk)
  }

  if (publicJwk.kty === 'RSA') {
    return rsaPublicJwkToPublicKey(publicJwk)
  }

  // @ts-expect-error
  throw new KeyManagementError(`Unsupported kty '${publicJwk.kty}' for transforming public jwk to public key bytes`)
}
