import { Jwt, Kms } from '@credo-ts/core'
import { getAgentContext } from '../../../../core/tests'
import { NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../../../../node/src'
import { getOid4vcJwtSignCallback } from '../callbacks'
import { getDpopOptions } from '../dpop'
import { getJwkSignerKey } from '../utils'

describe('getDpopOptions', () => {
  test('the signer carries the backend of the DPoP key to the sign callback and the returned jwk', async () => {
    const defaultBackend = new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage())
    const otherBackend = Object.assign(new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage()), {
      backend: 'other',
    })
    const agentContext = getAgentContext({ kmsBackends: [otherBackend, defaultBackend] })

    const { signer } = await getDpopOptions(agentContext, { dpopSigningAlgValuesSupported: ['ES256'] })
    const signerKey = getJwkSignerKey(signer)
    expect(signerKey.kmsBackend).toBe('other')
    // The KMS key id travels as the signer kid, not in the jwk that goes into the DPoP header
    expect(signer.publicJwk.kid).toBeUndefined()
    expect(signer.kid).toEqual(signerKey.keyId)

    const getPublicKey = vi.spyOn(otherBackend, 'getPublicKey')
    const sign = vi.spyOn(otherBackend, 'sign')
    const { jwt } = await getOid4vcJwtSignCallback(agentContext)(signer, {
      header: { typ: 'dpop+jwt', alg: signer.alg, jwk: signer.publicJwk },
      payload: { htm: 'POST', htu: 'https://example.com', iat: 0, jti: 'jti' },
    })
    // The backend is known, so no backend is scanned for the key
    expect(getPublicKey).not.toHaveBeenCalled()
    expect(sign).toHaveBeenCalledWith(agentContext, expect.objectContaining({ keyId: signerKey.keyId }))
    expect(Jwt.fromSerializedJwt(jwt).header.jwk).toEqual(signerKey.toJson({ includeKid: false }))

    const reused = await getDpopOptions(agentContext, {
      dpopSigningAlgValuesSupported: ['ES256'],
      jwk: getJwkSignerKey(signer) as Kms.PublicJwk,
    })
    expect(getJwkSignerKey(reused.signer).kmsBackend).toBe('other')
  })
})
