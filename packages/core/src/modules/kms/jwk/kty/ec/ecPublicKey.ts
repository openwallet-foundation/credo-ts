import {
  AffinePoint,
  CurveParams,
  isValidCompressedPublicKeyFormat,
  isValidDecompressedPublicKeyFormat,
  Secp256k1,
  Secp256r1,
  Secp384r1,
  Secp521r1,
} from 'ec-compression'
import { TypedArrayEncoder } from '../../../../../utils'
import { KeyManagementError } from '../../../error/KeyManagementError'
import type { KmsJwkPublicEc } from './ecJwk'

// CurveParams for ec-compression lib
export const ecCrvToCurveParams: Record<KmsJwkPublicEc['crv'], CurveParams> = {
  'P-256': Secp256r1,
  'P-384': Secp384r1,
  'P-521': Secp521r1,
  secp256k1: Secp256k1,
}

export function ecPublicJwkToPublicKey(
  publicJwk: KmsJwkPublicEc,
  { compressed = false }: { compressed?: boolean } = {}
): Uint8Array {
  const xAsBytes = TypedArrayEncoder.fromBase64Url(publicJwk.x)
  const yAsBytes = TypedArrayEncoder.fromBase64Url(publicJwk.y)

  const affinePoint = new AffinePoint(xAsBytes, yAsBytes, publicJwk.crv)

  return compressed ? affinePoint.compressedForm : affinePoint.decompressedForm
}

export function ecPublicKeyToPublicJwk<Crv extends KmsJwkPublicEc['crv']>(publicKey: Uint8Array, crv: Crv) {
  const curveParams = ecCrvToCurveParams[crv]

  if (!curveParams) {
    throw new KeyManagementError(`kty EC with crv '${crv}' is not supported for creating jwk based on public key bytes`)
  }

  let affinePoint: AffinePoint

  if (isValidCompressedPublicKeyFormat(publicKey, curveParams)) {
    affinePoint = AffinePoint.fromCompressedPoint(publicKey, curveParams)
  } else if (isValidDecompressedPublicKeyFormat(publicKey, curveParams)) {
    affinePoint = AffinePoint.fromDecompressedPoint(publicKey, curveParams)
  } else {
    throw new KeyManagementError(
      `public key for kty EC with crv '${crv}' is neither a valid compressed or uncompressed key. Key prefix '${publicKey[0]}', key length '${publicKey.length}'`
    )
  }

  const jwk = {
    kty: 'EC',
    crv,
    x: TypedArrayEncoder.toBase64Url(affinePoint.xBytes),
    y: TypedArrayEncoder.toBase64Url(affinePoint.yBytes),
  } satisfies KmsJwkPublicEc & { crv: Crv }

  return jwk
}

export function ecMulticodecToPublicJwk<Crv extends KmsJwkPublicEc['crv']>(publicKey: Uint8Array, crv: Crv) {
  const length = ecCrvToCurveParams[crv].coordinateLength + 1
  if (publicKey.length !== length) {
    throw new KeyManagementError(
      `Invalid public key length for multicodec with crv '${crv}': expected ${length} bytes, received ${publicKey.length}`
    )
  }

  if (publicKey[0] !== 0x02 && publicKey[0] !== 0x03) {
    throw new KeyManagementError(`Invalid compressed public key header for multicodec with crv '${crv}'`)
  }

  return ecPublicKeyToPublicJwk(publicKey, crv)
}
