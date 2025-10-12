import { type AnyUint8Array, CredoError, Kms } from '@credo-ts/core'
import { Key as AskarKey } from '@openwallet-foundation/askar-shared'
import { jwkCrvToAskarAlg } from './askarKeyTypes'

/**
 * Method to transform private key bytes into a private jwk,
 * which allows the key to be imported in the KMS API.
 *
 * This method is to still allow private keys that were
 * used before the KMS API was introduced, to be used and imported.
 *
 * @example
 * ```ts
 * import { transformPrivateKeyToPrivateJwk } from '@credo-ts/askar'
 *
 * const { privateJwk } = transformPrivateKeyToPrivateJwk({
 *   type: {
 *     kty: 'EC',
 *     crv: 'P-256',
 *   },
 *   privateKey: TypedArrayEncoder.fromString('00000000000000000000000000000My1')
 * })
 *
 * const { keyId } = await agent.kms.importKey({
 *   privateJwk
 * })
 * ```
 */
export function transformPrivateKeyToPrivateJwk<Type extends Kms.KmsCreateKeyTypeOkp | Kms.KmsCreateKeyTypeEc>({
  type,
  privateKey,
}: {
  type: Type
  privateKey: AnyUint8Array
}): { privateJwk: Kms.KmsJwkPrivateFromKmsJwkPublic<Kms.KmsJwkPublicFromCreateType<Type>> } {
  const askarAlgorithm = jwkCrvToAskarAlg[type.crv]
  if (!askarAlgorithm) {
    throw new CredoError(`kty '${type.kty}' with crv '${type.crv}' not supported by Askar`)
  }

  const privateJwk = AskarKey.fromSecretBytes({
    algorithm: askarAlgorithm,
    secretKey: privateKey,
  }).jwkSecret

  return {
    // biome-ignore lint/suspicious/noExplicitAny: no explanation
    privateJwk: privateJwk as any,
  }
}

/**
 * Method to transform seed into a private jwk,
 * which allows the key to be imported in the KMS API.
 *
 * This method is to still allow seeds that were
 * used before the KMS API was introduced, to be used and imported.
 *
 * @example
 * ```ts
 * import { transformSeedToPrivateJwk } from '@credo-ts/askar'
 *
 * const { privateJwk } = transformSeedToPrivateJwk({
 *   type: {
 *     kty: 'EC',
 *     crv: 'P-256',
 *   },
 *   seed: TypedArrayEncoder.fromString('00000000000000000000000000000My1')
 * })
 *
 * const { keyId } = await agent.kms.importKey({
 *   privateJwk
 * })
 * ```
 */
export function transformSeedToPrivateJwk<Type extends Kms.KmsCreateKeyTypeOkp | Kms.KmsCreateKeyTypeEc>({
  type,
  seed,
}: {
  type: Type
  seed: AnyUint8Array
}): { privateJwk: Kms.KmsJwkPrivateFromKmsJwkPublic<Kms.KmsJwkPublicFromCreateType<Type>> } {
  const askarAlgorithm = jwkCrvToAskarAlg[type.crv]
  if (!askarAlgorithm) {
    throw new CredoError(`kty '${type.kty}' with crv '${type.crv}' not supported by Askar`)
  }

  const privateJwk = AskarKey.fromSeed({
    algorithm: askarAlgorithm,
    seed,
  }).jwkSecret

  return {
    // biome-ignore lint/suspicious/noExplicitAny: no explanation
    privateJwk: privateJwk as any,
  }
}
