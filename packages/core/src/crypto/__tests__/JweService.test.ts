import { NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../../../../node/src'
import { getAgentConfig, getAgentContext } from '../../../tests/helpers'
import type { AgentContext } from '../../agent'
import { KeyManagementApi, PublicJwk } from '../../modules/kms'
import { JsonEncoder, TypedArrayEncoder } from '../../utils'
import { JweService } from '../JweService'

describe('JweService', () => {
  let agentContext: AgentContext
  let kms: KeyManagementApi
  const jweService = new JweService()
  const data = TypedArrayEncoder.fromUtf8String('hello jwe')

  const createKey = async (crv: 'P-256' | 'X25519') => {
    const key = await kms.createKey({ type: crv === 'P-256' ? { kty: 'EC', crv } : { kty: 'OKP', crv } })
    return { keyId: key.keyId, publicJwk: PublicJwk.fromPublicJwk(key.publicJwk) }
  }

  beforeAll(() => {
    agentContext = getAgentContext({
      kmsBackends: [new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage())],
      agentConfig: getAgentConfig('JweService'),
    })
    kms = agentContext.resolve(KeyManagementApi)
  })

  it('encrypts and decrypts a compact JWE with ECDH-ES', async () => {
    const recipient = await createKey('P-256')
    const apu = TypedArrayEncoder.fromUtf8String('alice')
    const apv = TypedArrayEncoder.fromUtf8String('bob')

    const jwe = await jweService.encryptJweCompact(agentContext, {
      keyAgreement: { algorithm: 'ECDH-ES', recipient: { publicJwk: recipient.publicJwk, header: { kid: 'bob-key' } } },
      enc: 'A256GCM',
      apu,
      apv,
      protectedHeaderOptions: { typ: 'test+jwe' },
      data,
    })

    const parts = jwe.split('.')
    expect(parts).toHaveLength(5)
    expect(parts[1]).toBe('')
    expect(JsonEncoder.fromBase64Url(parts[0])).toEqual({
      typ: 'test+jwe',
      kid: 'bob-key',
      alg: 'ECDH-ES',
      enc: 'A256GCM',
      apu: TypedArrayEncoder.toBase64Url(apu),
      apv: TypedArrayEncoder.toBase64Url(apv),
      epk: expect.objectContaining({ kty: 'EC', crv: 'P-256' }),
    })

    const decrypted = await jweService.decryptJwe(agentContext, { jwe, recipientKeyId: recipient.keyId })
    expect(TypedArrayEncoder.toUtf8String(decrypted.data)).toBe('hello jwe')
    expect(decrypted.protectedHeader.typ).toBe('test+jwe')
  })

  it('encrypts a general JSON JWE with ECDH-ES+A256KW that every recipient can decrypt', async () => {
    const first = await createKey('X25519')
    const second = await createKey('X25519')

    const jwe = await jweService.encryptJwe(agentContext, {
      keyAgreement: {
        algorithm: 'ECDH-ES+A256KW',
        recipients: [
          { publicJwk: first.publicJwk, header: { kid: 'first' } },
          { publicJwk: second.publicJwk, header: { kid: 'second' } },
        ],
      },
      enc: 'A256GCM',
      data,
    })

    expect(jwe.recipients).toEqual([
      { header: { kid: 'first' }, encrypted_key: expect.any(String) },
      { header: { kid: 'second' }, encrypted_key: expect.any(String) },
    ])

    for (const [kid, key] of [
      ['first', first],
      ['second', second],
    ] as const) {
      const decrypted = await jweService.decryptJwe(agentContext, { jwe, recipientKeyId: key.keyId, recipientKid: kid })
      expect(TypedArrayEncoder.toUtf8String(decrypted.data)).toBe('hello jwe')
      expect(decrypted.recipientHeader).toEqual({ kid })
    }

    await expect(jweService.decryptJwe(agentContext, { jwe, recipientKeyId: first.keyId })).rejects.toThrow(
      'a recipient kid is required'
    )
  })

  it('encrypts and decrypts an ECDH-1PU+A256KW JWE with the sender key', async () => {
    const sender = await createKey('X25519')
    const recipient = await createKey('X25519')

    const jwe = await jweService.encryptJwe(agentContext, {
      keyAgreement: {
        algorithm: 'ECDH-1PU+A256KW',
        senderKeyId: sender.keyId,
        recipients: [{ publicJwk: recipient.publicJwk, header: { kid: 'recipient' } }],
      },
      enc: 'A256CBC-HS512',
      apu: TypedArrayEncoder.fromUtf8String('sender'),
      protectedHeaderOptions: { skid: 'sender' },
      data,
    })

    const decrypted = await jweService.decryptJwe(agentContext, {
      jwe,
      recipientKeyId: recipient.keyId,
      senderPublicJwk: sender.publicJwk,
    })
    expect(TypedArrayEncoder.toUtf8String(decrypted.data)).toBe('hello jwe')

    await expect(jweService.decryptJwe(agentContext, { jwe, recipientKeyId: recipient.keyId })).rejects.toThrow(
      'requires the sender public key'
    )
  })

  it('rejects disallowed algorithms and a modified protected header', async () => {
    const recipient = await createKey('P-256')
    const jwe = await jweService.encryptJweCompact(agentContext, {
      keyAgreement: { algorithm: 'ECDH-ES', recipient: { publicJwk: recipient.publicJwk } },
      enc: 'A128GCM',
      data,
    })

    await expect(
      jweService.decryptJwe(agentContext, {
        jwe,
        recipientKeyId: recipient.keyId,
        allowedContentEncryptionAlgorithms: ['A256GCM'],
      })
    ).rejects.toThrow("JWE 'enc' 'A128GCM' is not allowed")

    const [encodedHeader, ...rest] = jwe.split('.')
    const tampered = [
      JsonEncoder.toBase64Url({ ...JsonEncoder.fromBase64Url(encodedHeader), typ: 'other' }),
      ...rest,
    ].join('.')
    await expect(
      jweService.decryptJwe(agentContext, { jwe: tampered, recipientKeyId: recipient.keyId })
    ).rejects.toThrow()
  })

  it('only decrypts for the recipient kid that was asked for', async () => {
    const recipient = await createKey('X25519')
    const jwe = await jweService.encryptJwe(agentContext, {
      keyAgreement: {
        algorithm: 'ECDH-ES+A256KW',
        recipients: [{ publicJwk: recipient.publicJwk, header: { kid: 'recipient' } }],
      },
      enc: 'A256GCM',
      data,
    })

    await expect(
      jweService.decryptJwe(agentContext, { jwe, recipientKeyId: recipient.keyId, recipientKid: 'other' })
    ).rejects.toThrow("No JWE recipient with kid 'other'")

    const compact = await jweService.encryptJweCompact(agentContext, {
      keyAgreement: { algorithm: 'ECDH-ES', recipient: { publicJwk: recipient.publicJwk } },
      enc: 'A256GCM',
      data,
    })
    const decrypted = await jweService.decryptJwe(agentContext, {
      jwe: compact,
      recipientKeyId: recipient.keyId,
      recipientKid: 'any',
    })
    expect(TypedArrayEncoder.toUtf8String(decrypted.data)).toBe('hello jwe')
  })

  it('rejects key agreement parameters outside the protected header', async () => {
    const recipient = await createKey('X25519')
    const jwe = await jweService.encryptJwe(agentContext, {
      keyAgreement: {
        algorithm: 'ECDH-ES+A256KW',
        recipients: [{ publicJwk: recipient.publicJwk, header: { kid: 'recipient' } }],
      },
      enc: 'A256GCM',
      data,
    })

    await expect(
      jweService.decryptJwe(agentContext, {
        jwe: { ...jwe, unprotected: { apu: 'YWxpY2U' } },
        recipientKeyId: recipient.keyId,
      })
    ).rejects.toThrow("JWE header parameters 'apu' must be in the protected header")
    await expect(
      jweService.decryptJwe(agentContext, {
        jwe: { ...jwe, recipients: [{ ...jwe.recipients?.[0], header: { kid: 'recipient', epk: {} } }] },
        recipientKeyId: recipient.keyId,
      })
    ).rejects.toThrow("JWE header parameters 'epk' must be in the protected header")
  })

  it('refuses a compact JWE for several recipients', async () => {
    const first = await createKey('X25519')
    const second = await createKey('X25519')

    await expect(
      jweService.encryptJweCompact(agentContext, {
        keyAgreement: {
          algorithm: 'ECDH-ES+A256KW',
          recipients: [{ publicJwk: first.publicJwk }, { publicJwk: second.publicJwk }],
        },
        enc: 'A256GCM',
        data,
      })
    ).rejects.toThrow('A compact JWE has exactly one recipient')
  })
})
