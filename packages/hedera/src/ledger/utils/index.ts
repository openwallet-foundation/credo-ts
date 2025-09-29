import { Kms, TypedArrayEncoder } from '@credo-ts/core'
import { PublicKey } from '@hashgraph/sdk'
import { KeysUtility } from '@hiero-did-sdk/core'

export function getMultibasePublicKey(publicJwk: Kms.PublicJwk<Kms.Ed25519PublicJwk>): string {
  return `z${TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey)}`
}

export async function createOrGetKey(
  kms: Kms.KeyManagementApi,
  keyId?: string
): Promise<Kms.PublicJwk<Kms.Ed25519PublicJwk>> {
  if (!keyId) {
    const { publicJwk } = await kms.createKey({
      type: {
        crv: 'Ed25519',
        kty: 'OKP',
      },
    })

    return Kms.PublicJwk.fromPublicJwk(publicJwk)
  }

  const publicJwk = await kms.getPublicKey({ keyId })
  if (!publicJwk) {
    throw new Error(`Key with key id '${keyId}' not found`)
  }
  if (publicJwk.kty !== 'OKP' || publicJwk.crv !== 'Ed25519') {
    throw new Error(
      `Key with key id '${keyId}' uses unsupported ${Kms.getJwkHumanDescription(publicJwk)} for did:hedera`
    )
  }

  return Kms.PublicJwk.fromPublicJwk(publicJwk) as Kms.PublicJwk<Kms.Ed25519PublicJwk>
}

export function hederaPublicKeyFromPublicJwk(publicJwk: Kms.PublicJwk<Kms.Ed25519PublicJwk>): PublicKey {
  return KeysUtility.fromBytes(publicJwk.publicKey.publicKey).toPublicKey()
}
