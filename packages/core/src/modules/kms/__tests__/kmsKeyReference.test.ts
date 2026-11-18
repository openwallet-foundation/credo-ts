import { NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../../../../../node/src'
import { getAgentContext } from '../../../../tests/helpers'
import { X509Service } from '../../x509'
import { checkKmsKeyReferences } from '../checkKmsKeyReferences'
import { Ed25519PublicJwk, PublicJwk, X25519PublicJwk } from '../jwk'
import { KeyManagementApi } from '../KeyManagementApi'

const otherBackend = () =>
  Object.assign(new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage()), { backend: 'other' })

describe('kms key references', () => {
  test('fromKmsKey keeps the key id and backend of a created key, also when converted', async () => {
    const agentContext = getAgentContext({ kmsBackends: [otherBackend()] })
    const kms = agentContext.resolve(KeyManagementApi)

    const publicJwk = PublicJwk.fromKmsKey(await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } }))
    expect(publicJwk.kmsBackend).toBe('other')

    const x25519 = (publicJwk as PublicJwk<Ed25519PublicJwk>).convertTo(X25519PublicJwk)
    expect(x25519.keyId).toBe(publicJwk.keyId)
    expect(x25519.kmsBackend).toBe('other')
  })

  test('a certificate keeps the backend of its key', async () => {
    const agentContext = getAgentContext({ kmsBackends: [otherBackend()] })
    const kms = agentContext.resolve(KeyManagementApi)
    const authorityKey = PublicJwk.fromKmsKey(await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } }))

    const certificate = await X509Service.createCertificate(agentContext, { authorityKey, issuer: 'C=NL' })

    expect(certificate.keyId).toBe(authorityKey.keyId)
    expect(certificate.kmsBackend).toBe('other')
    expect(certificate.clone().kmsBackend).toBe('other')
  })

  test('warns once for a batch of keys without their key id or backend, also with one backend', () => {
    const agentContext = getAgentContext({ kmsBackends: [otherBackend()] })
    const warn = vi.spyOn(agentContext.config.logger, 'warn')

    checkKmsKeyReferences(agentContext, [{ keyId: 'key-id', backend: 'other' }])
    expect(warn).not.toHaveBeenCalled()

    checkKmsKeyReferences(agentContext, [
      { keyId: 'key-id', backend: 'other' },
      { keyId: 'key-id', backend: undefined },
      { keyId: undefined, backend: 'other' },
      { keyId: undefined, backend: undefined },
    ])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "('key-id' without backend, key without key id in backend 'other', key without key id or backend)"
      )
    )
  })

  test('throws for keys without key id or backend when configured', () => {
    const agentContext = getAgentContext({ kmsBackends: [otherBackend()] })
    const keys = [{ keyId: 'key-id', backend: undefined }]

    expect(() => checkKmsKeyReferences(agentContext, keys, { missingKeyId: 'throw' })).not.toThrow()
    expect(() => checkKmsKeyReferences(agentContext, keys, { missingBackend: 'throw' })).toThrow(
      "Unable to store KMS keys without their key id or backend ('key-id' without backend)"
    )
  })
})
