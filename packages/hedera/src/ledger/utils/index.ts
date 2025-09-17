import { Kms, TypedArrayEncoder } from '@credo-ts/core'

export const getMultibasePublicKey = (publicJwk: Kms.KmsJwkPublicOkp & { crv: 'Ed25519' }): string => {
  return `z${TypedArrayEncoder.toBase58(Uint8Array.from(TypedArrayEncoder.fromBase64(publicJwk.x)))}`
}

export const createOrGetKey = async (
  kms: Kms.KeyManagementApi,
  keyId?: string
): Promise<{ keyId: string; publicJwk: Kms.KmsJwkPublicOkp & { crv: 'Ed25519' } }> => {
  if (!keyId) {
    const createKeyResult = await kms.createKey({
      type: {
        crv: 'Ed25519',
        kty: 'OKP',
      },
    })
    return {
      publicJwk: createKeyResult.publicJwk,
      keyId: createKeyResult.keyId,
    }
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
  return {
    keyId,
    publicJwk: {
      ...publicJwk,
      crv: publicJwk.crv,
    },
  }
}
