import { Agent, TypedArrayEncoder } from '@credo-ts/core'
import { DidCommEnvelopeService } from '@credo-ts/didcomm'
import { transformPrivateKeyToPrivateJwk } from '../src'
import { getAskarSqliteAgentOptions } from './helpers'

const askarAgentOptions = getAskarSqliteAgentOptions('Askar', {}, {}, true)

describe('Askar KMS | DIDComm Credo 0.5 Interop', () => {
  let agent: Agent<(typeof askarAgentOptions)['modules']>

  beforeAll(async () => {
    agent = new Agent(askarAgentOptions)
    await agent.initialize()

    const privateJwk = transformPrivateKeyToPrivateJwk({
      type: {
        kty: 'OKP',
        crv: 'Ed25519',
      },
      privateKey: TypedArrayEncoder.fromHex('226e10dad834f65c4e2b4bed1c29db06908f225eaa27ca7ebe2b74258fd6f1eb'),
    }).privateJwk
    privateJwk.kid = 'BTfNVH1CK5G7oGFdpnAER3Zi4swrksbuEk1f3WMUxqhf'

    await agent.kms.importKey({
      privateJwk,
    })
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  test('decrypts DIDComm v1 Authcrypt message from Credo 0.5', async () => {
    const encryptedMessage = {
      protected:
        'eyJlbmMiOiJ4Y2hhY2hhMjBwb2x5MTMwNV9pZXRmIiwidHlwIjoiSldNLzEuMCIsImFsZyI6IkF1dGhjcnlwdCIsInJlY2lwaWVudHMiOlt7ImVuY3J5cHRlZF9rZXkiOiJfWm5YYkdYLVFwTG8xVEllY1BnbDFFZUhiZEpyMUMteWNvc25fWWVDZm9BeUlzUVk4UmFBTG1IMFZlcEhQcnMwIiwiaGVhZGVyIjp7ImtpZCI6IkJUZk5WSDFDSzVHN29HRmRwbkFFUjNaaTRzd3Jrc2J1RWsxZjNXTVV4cWhmIiwic2VuZGVyIjoiWjBBZXZVYkRsand4YzJsdVhpYWI5M1Z2OUw1YzBGdm4tV3ljaUpHc0RYcWlobVdtTEg1R1JtQjVaN2FTRVNfQXFsMDByUllQMDRkaWg1YjVSTG9ydEg1N2JUSER3QnhGallZTElMSE9ValI4NUZJeHdsSnNhM1NKUXY0IiwiaXYiOiJjYjJlaDdYRHdFSVU0WFNrWDduOFl6cVVNSXRMUWlUbyJ9fV19',
      ciphertext: 'ZN9MbaJYFEIcIsjS7RJL0-J8QvuJCRgfUyunQPlN2FTa88HfCFyJfwCWeN1RbZs',
      iv: 't2rSkBzjq8uu7-ji',
      tag: 'bOflaQwnOsUngIeoh9adww',
    }

    const envelopeService = agent.context.resolve(DidCommEnvelopeService)
    const decrypted = await envelopeService.unpackMessage(agent.context, encryptedMessage)

    expect(decrypted.plaintextMessage).toEqual({
      '@type': 'https://didcomm.org/connections/1.0',
    })
    expect(decrypted.recipientKey.toJson({ includeKid: false })).toEqual({
      kty: 'OKP',
      crv: 'Ed25519',
      x: 'm2lbHnBNuvMlBnJrV1tPKLc-Jdabzd_GWXs1Ft39U_4',
    })
    expect(decrypted.senderKey?.toJson({ includeKid: false })).toEqual({
      kty: 'OKP',
      crv: 'Ed25519',
      x: 'R0s2NusuG1Yth0izz5kNzd1_-vLb4m5sUoSUBVDOOcY',
    })
  })

  test('decrypts DIDComm v1 Anoncrypt message from Credo 0.5', async () => {
    const encryptedMessage = {
      protected:
        'eyJlbmMiOiJ4Y2hhY2hhMjBwb2x5MTMwNV9pZXRmIiwidHlwIjoiSldNLzEuMCIsImFsZyI6IkFub25jcnlwdCIsInJlY2lwaWVudHMiOlt7ImVuY3J5cHRlZF9rZXkiOiJZME9uTUNGZ2VIQUpEV1Y4NkVhWEpQWXN5RUVlWXVfZVNQX2ltX3VDMUFkYkpRalI4RkRTUFZxd1RrUU5GcDc1X2RwemZpX2pqcGlUVTZhQ2VobThTdzMwS3B5bmJHemNROWdsUnFxY1NnQSIsImhlYWRlciI6eyJraWQiOiJCVGZOVkgxQ0s1RzdvR0ZkcG5BRVIzWmk0c3dya3NidUVrMWYzV01VeHFoZiJ9fV19',

      ciphertext: 'GTzzcCSkcofiC2dH2LRChTxikb9Nn8ZAesGY6iJWzeLNQea5SgEqM0zw-cwVSbFlPSq5_w',
      iv: 'EF6uHk2lUSoayxV7',
      tag: 'op_xOrKdtJVhCa0u1hBJ7A',
    }

    const envelopeService = agent.context.resolve(DidCommEnvelopeService)
    const decrypted = await envelopeService.unpackMessage(agent.context, encryptedMessage)

    expect(decrypted.plaintextMessage).toEqual({
      '@type': 'https://didcomm.org/another-protocol/1.0',
    })
    expect(decrypted.recipientKey.toJson({ includeKid: false })).toEqual({
      kty: 'OKP',
      crv: 'Ed25519',
      x: 'm2lbHnBNuvMlBnJrV1tPKLc-Jdabzd_GWXs1Ft39U_4',
    })
    expect(decrypted.senderKey).toBeUndefined()
  })
})
