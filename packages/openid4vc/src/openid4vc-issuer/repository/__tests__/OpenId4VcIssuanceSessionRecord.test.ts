import { JsonTransformer, Kms } from '@credo-ts/core'
import { OpenId4VcIssuanceSessionState } from '../../OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuanceSessionRecord } from '../OpenId4VcIssuanceSessionRecord'

const jwk = {
  kty: 'OKP',
  crv: 'Ed25519',
  x: '11qYAYdk9Jtz7bQHmbT5D_Iy_fqpI6bD7Z2p1l9tUoQ',
} as const

const issuanceSessionJson = {
  id: 'session-id',
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-02T00:00:00.000Z',
  issuerId: 'issuer-id',
  state: OpenId4VcIssuanceSessionState.CredentialRequestReceived,
  issuedCredentials: [],
  credentialOfferId: 'offer-id',
  credentialOfferPayload: {
    credential_issuer: 'https://issuer.example.com',
    credential_configuration_ids: ['credential'],
  },
  authorization: {
    code: 'code',
    codeExpiresAt: '2026-01-01T00:10:00.000Z',
  },
  chainedIdentity: {
    externalAuthorizationServerUrl: 'https://auth.example.com',
    requestUriExpiresAt: '2026-01-01T00:20:00.000Z',
  },
  transactions: [
    {
      transactionId: 'transaction-id',
      numberOfCredentials: 1,
      credentialConfigurationId: 'credential',
      deferredUntil: '2026-01-01T01:00:00.000Z',
      holderBinding: {
        proofType: 'jwt',
        bindingMethod: 'jwk',
        keys: [{ method: 'jwk', jwk }],
      },
    },
  ],
  metadata: {},
  _tags: {},
}

describe('OpenId4VcIssuanceSessionRecord', () => {
  test('decodes nested dates and jwks', () => {
    const record = JsonTransformer.fromJSON(issuanceSessionJson, OpenId4VcIssuanceSessionRecord)

    expect(record.expiresAt).toEqual(new Date('2026-01-02T00:00:00.000Z'))
    expect(record.authorization?.codeExpiresAt).toEqual(new Date('2026-01-01T00:10:00.000Z'))
    expect(record.chainedIdentity?.requestUriExpiresAt).toEqual(new Date('2026-01-01T00:20:00.000Z'))

    const [transaction] = record.transactions
    expect(transaction.deferredUntil).toEqual(new Date('2026-01-01T01:00:00.000Z'))
    expect(transaction.holderBinding?.keys[0].jwk).toBeInstanceOf(Kms.PublicJwk)
  })

  test('encodes to the stored format', () => {
    const record = JsonTransformer.fromJSON(issuanceSessionJson, OpenId4VcIssuanceSessionRecord)

    expect(JsonTransformer.toJSON(record)).toEqual(issuanceSessionJson)
    expect(JsonTransformer.toJSON(record.clone())).toEqual(issuanceSessionJson)
  })

  test('maps the legacy CredentialIssued state to Error', () => {
    const record = JsonTransformer.fromJSON(
      { ...issuanceSessionJson, state: 'CredentialIssued' },
      OpenId4VcIssuanceSessionRecord
    )

    expect(record.state).toEqual(OpenId4VcIssuanceSessionState.Error)
  })
})
