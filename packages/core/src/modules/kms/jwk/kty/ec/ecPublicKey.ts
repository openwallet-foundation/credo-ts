import {
  AffinePoint,
  CurveParams,
  Secp256k1,
  Secp256r1,
  Secp384r1,
  Secp521r1,
  isValidCompressedPublicKeyFormat,
  isValidDecompressedPublicKeyFormat,
} from 'ec-compression'
import type { AnyUint8Array, Uint8ArrayBuffer } from '../../../../../types'
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
): AnyUint8Array {
  const xAsBytes = Uint8Array.from(TypedArrayEncoder.fromBase64(publicJwk.x))
  const yAsBytes = Uint8Array.from(TypedArrayEncoder.fromBase64(publicJwk.y))

  const affinePoint = new AffinePoint(xAsBytes, yAsBytes)

  return compressed
    ? (affinePoint.compressedForm as Uint8ArrayBuffer)
    : (affinePoint.decompressedForm as Uint8ArrayBuffer)
}

export function ecPublicKeyToPublicJwk<Crv extends KmsJwkPublicEc['crv']>(publicKey: AnyUint8Array, crv: Crv) {
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
    x: TypedArrayEncoder.toBase64URL(affinePoint.xBytes),
    y: TypedArrayEncoder.toBase64URL(affinePoint.yBytes),
  } satisfies KmsJwkPublicEc & { crv: Crv }

  return jwk
}
