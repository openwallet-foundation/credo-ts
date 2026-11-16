import { generateKeyPairSync } from 'node:crypto'
import { JsonEncoder, Jwt, Kms, RecordNotFoundError, utils } from '@credo-ts/core'
import type { TransactionDataEntry } from '@openid4vc/openid4vp'
import { InMemoryWalletModule } from '../../../../../tests/InMemoryWalletModule'
import { type AgentType, createAgentFromModules } from '../../../tests/utils'
import { openBadgeDcqlQuery, universityDegreePresentationDefinition } from '../../../tests/utilsVp'
import { OpenId4VcModule } from '../../OpenId4VcModule'
import { OpenId4VcVerificationSessionRepository } from '../repository'

const modules = {
  openid4vc: new OpenId4VcModule({
    verifier: {
      baseUrl: 'http://redirect-uri',
    },
  }),
  inMemory: new InMemoryWalletModule(),
}

describe('OpenId4VcVerifier', () => {
  let verifier: AgentType<typeof modules>

  beforeAll(async () => {
    verifier = await createAgentFromModules(modules, '96213c3d7fc8d4d6754c7a0fd969598f')
  })

  afterAll(async () => {
    await verifier.agent.shutdown()
  })

  describe('Verification', () => {
    it('check openid proof request format (vp token)', async () => {
      const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()
      const { authorizationRequest, verificationSession } =
        await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
          requestSigner: {
            method: 'did',
            didUrl: verifier.kid,
          },
          verifierId: openIdVerifier.verifierId,
          presentationExchange: {
            definition: universityDegreePresentationDefinition,
          },
          version: 'v1.draft24',
        })

      expect(
        authorizationRequest.startsWith(
          `openid4vp://?client_id=${encodeURIComponent(verifier.did)}&request_uri=http%3A%2F%2Fredirect-uri%2F${
            openIdVerifier.verifierId
          }%2Fauthorization-requests%2F`
        )
      ).toBe(true)

      const jwt = Jwt.fromSerializedJwt(verificationSession.authorizationRequestJwt as string)

      expect(jwt.header.kid)

      expect(jwt.header.kid).toEqual(verifier.kid)
      expect(jwt.header.alg).toEqual('EdDSA')
      expect(jwt.header.typ).toEqual('oauth-authz-req+jwt')
      expect(jwt.payload.additionalClaims.scope).toEqual(undefined)
      expect(jwt.payload.additionalClaims.client_id).toEqual(verifier.did)
      expect(jwt.payload.additionalClaims.response_uri).toEqual(
        `http://redirect-uri/${openIdVerifier.verifierId}/authorize?session=${verificationSession.authorizationRequestId}`
      )
      expect(jwt.payload.additionalClaims.response_mode).toEqual('direct_post.jwt')
      expect(jwt.payload.additionalClaims.nonce).toBeDefined()
      expect(jwt.payload.additionalClaims.state).toBeDefined()
      expect(jwt.payload.additionalClaims.response_type).toEqual('vp_token')
    })

    it('custom expiration is correctly applied', async () => {
      const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()
      const { verificationSession } = await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        requestSigner: {
          method: 'did',
          didUrl: verifier.kid,
        },
        verifierId: openIdVerifier.verifierId,
        dcql: {
          query: openBadgeDcqlQuery,
        },
        expirationInSeconds: 60 * 60,
      })

      expect(verificationSession.expiresAt).toEqual(utils.addSecondsToDate(verificationSession.createdAt, 60 * 60))
    })

    it('throws when creating a draft 21 request with the x509_hash client id prefix', async () => {
      const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()
      const certificate = await verifier.agent.x509.createCertificate({
        issuer: { commonName: 'Credo', countryName: 'NL' },
        authorityKey: Kms.PublicJwk.fromPublicJwk(
          (await verifier.agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })).publicJwk
        ),
        extensions: { subjectAlternativeName: { name: [{ type: 'dns', value: 'redirect-uri' }] } },
      })

      await expect(
        verifier.agent.openid4vc.verifier.createAuthorizationRequest({
          requestSigner: {
            method: 'x5c',
            x5c: [certificate],
            clientIdPrefix: 'x509_hash',
          },
          verifierId: openIdVerifier.verifierId,
          presentationExchange: {
            definition: universityDegreePresentationDefinition,
          },
          version: 'v1.draft21',
        })
      ).rejects.toThrow(
        "OpenID4VP version 'v1.draft21' cannot be used with clientIdPrefix 'x509_hash'. Use clientIdPrefix 'x509_san_dns', or version 'v1' instead."
      )
    })

    it('throws when transaction data references credential ids that are not in the dcql query', async () => {
      const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()

      await expect(
        verifier.agent.openid4vc.verifier.createAuthorizationRequest({
          requestSigner: { method: 'did', didUrl: verifier.kid },
          verifierId: openIdVerifier.verifierId,
          dcql: { query: openBadgeDcqlQuery },
          transactionData: [
            {
              type: 'OpenBadgeTx',
              credential_ids: ['UnknownCredentialId', 'OpenBadgeCredentialDescriptor', 'OtherUnknownCredentialId'],
            },
            { type: 'OpenBadgeTx', credential_ids: ['OpenBadgeCredentialDescriptor'] },
            { type: 'OpenBadgeTx', credential_ids: ['ThirdUnknownCredentialId'] },
          ],
        })
      ).rejects.toThrow(
        "Transaction data references credential ids that are not present in the query: entry with index 0 references 'UnknownCredentialId', 'OtherUnknownCredentialId'; entry with index 2 references 'ThirdUnknownCredentialId'."
      )
    })

    it('throws when transaction data references credential ids that are not in the presentation definition', async () => {
      const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()

      await expect(
        verifier.agent.openid4vc.verifier.createAuthorizationRequest({
          requestSigner: { method: 'did', didUrl: verifier.kid },
          verifierId: openIdVerifier.verifierId,
          presentationExchange: { definition: universityDegreePresentationDefinition },
          transactionData: [{ type: 'UniversityDegreeTx', credential_ids: ['UniversityDegreeCredential'] }],
          version: 'v1.draft24',
        })
      ).rejects.toThrow(
        "Transaction data references credential ids that are not present in the query: entry with index 0 references 'UniversityDegreeCredential'."
      )
    })

    it('includes transaction data that references input descriptor ids from the presentation definition', async () => {
      const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()
      const transactionData: TransactionDataEntry[] = [
        { type: 'UniversityDegreeTx', credential_ids: ['UniversityDegree'] },
      ]

      const { verificationSession } = await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        requestSigner: { method: 'did', didUrl: verifier.kid },
        verifierId: openIdVerifier.verifierId,
        presentationExchange: { definition: universityDegreePresentationDefinition },
        transactionData,
        version: 'v1.draft24',
      })

      const jwt = Jwt.fromSerializedJwt(verificationSession.authorizationRequestJwt as string)
      expect(jwt.payload.additionalClaims.transaction_data).toEqual(
        transactionData.map((entry) => JsonEncoder.toBase64Url(entry))
      )
    })

    it('includes transaction data that only references credential ids from the query', async () => {
      const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()
      const transactionData: TransactionDataEntry[] = [
        { type: 'OpenBadgeTx', credential_ids: ['OpenBadgeCredentialDescriptor', 'OptionalCredential'] },
        { type: 'OpenBadgeTx', credential_ids: ['OptionalCredential'] },
      ]

      const { verificationSession } = await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        requestSigner: { method: 'did', didUrl: verifier.kid },
        verifierId: openIdVerifier.verifierId,
        dcql: {
          query: {
            credentials: [
              ...openBadgeDcqlQuery.credentials,
              { id: 'OptionalCredential', format: 'dc+sd-jwt', meta: { vct_values: ['OptionalCredential'] } },
            ],
            credential_sets: [
              { options: [['OpenBadgeCredentialDescriptor']] },
              { options: [['OptionalCredential']], required: false },
            ],
          },
        },
        transactionData,
      })

      const jwt = Jwt.fromSerializedJwt(verificationSession.authorizationRequestJwt as string)
      expect(jwt.payload.additionalClaims.transaction_data).toEqual(
        transactionData.map((entry) => JsonEncoder.toBase64Url(entry))
      )
    })

    it('stores the verification session metadata with the session', async () => {
      const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()
      const { verificationSession } = await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        requestSigner: { method: 'did', didUrl: verifier.kid },
        verifierId: openIdVerifier.verifierId,
        dcql: { query: openBadgeDcqlQuery },
        recordMetadata: { 'custom/key': { templateId: 'abc' } },
      })

      const storedSession = await verifier.agent.openid4vc.verifier.getVerificationSessionById(verificationSession.id)
      expect(storedSession.metadata.get('custom/key')).toEqual({ templateId: 'abc' })
    })

    it('deletes a verification session by id', async () => {
      const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()
      const { verificationSession } = await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        requestSigner: {
          method: 'did',
          didUrl: verifier.kid,
        },
        verifierId: openIdVerifier.verifierId,
        dcql: {
          query: openBadgeDcqlQuery,
        },
      })

      const keyId = verificationSession.responseEncryptionKey?.keyId as string
      await expect(verifier.agent.kms.getPublicKey({ keyId })).resolves.toBeDefined()

      await verifier.agent.openid4vc.verifier.deleteVerificationSessionById(verificationSession.id)

      await expect(
        verifier.agent.openid4vc.verifier.getVerificationSessionById(verificationSession.id)
      ).rejects.toThrow(RecordNotFoundError)
      await expect(verifier.agent.kms.getPublicKey({ keyId })).rejects.toThrow('not found')
    })

    it('deletes the response encryption key of a session that published the KMS key id as kid', async () => {
      const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()
      const { verificationSession } = await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        requestSigner: { method: 'none' },
        verifierId: openIdVerifier.verifierId,
        responseMode: 'direct_post.jwt',
        dcql: { query: openBadgeDcqlQuery },
        version: 'v1',
      })
      const keyId = verificationSession.responseEncryptionKey?.keyId as string
      const requestPayload = verificationSession.authorizationRequestPayload
      const encryptionJwk = requestPayload?.client_metadata?.jwks?.keys[0]
      if (!requestPayload || !encryptionJwk) throw new Error('Expected an encryption key')

      // A session created before the thumbprint was used published the KMS key id as kid, and stored no key
      verificationSession.responseEncryptionKey = undefined
      verificationSession.authorizationRequestPayload = {
        ...requestPayload,
        client_metadata: { ...requestPayload.client_metadata, jwks: { keys: [{ ...encryptionJwk, kid: keyId }] } },
      }
      await verifier.agent.dependencyManager
        .resolve(OpenId4VcVerificationSessionRepository)
        .update(verifier.agent.context, verificationSession)

      await verifier.agent.openid4vc.verifier.deleteVerificationSessionById(verificationSession.id)

      await expect(verifier.agent.kms.getPublicKey({ keyId })).rejects.toThrow('not found')
    })

    it('deletes the response encryption key of a session from before Credo 0.6 that published the fingerprint as kid', async () => {
      const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()
      const { verificationSession } = await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        requestSigner: { method: 'none' },
        verifierId: openIdVerifier.verifierId,
        responseMode: 'direct_post.jwt',
        dcql: { query: openBadgeDcqlQuery },
        version: 'v1',
      })
      const requestPayload = verificationSession.authorizationRequestPayload
      if (!requestPayload) throw new Error('Expected a request payload')

      // Before Credo 0.6 the key was stored under its legacy key id and published with the fingerprint as kid
      const { d, ...publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({
        format: 'jwk',
      })
      const publicJwk = Kms.PublicJwk.fromUnknown(publicKey)
      const { keyId } = await verifier.agent.kms.importKey({
        privateJwk: { ...publicKey, d, kid: publicJwk.legacyKeyId } as Kms.KmsJwkPrivate,
      })
      verificationSession.responseEncryptionKey = undefined
      verificationSession.authorizationRequestPayload = {
        ...requestPayload,
        client_metadata: {
          ...requestPayload.client_metadata,
          jwks: { keys: [{ ...publicJwk.toJson(), kid: publicJwk.fingerprint, use: 'enc' }] },
        },
      }
      await verifier.agent.dependencyManager
        .resolve(OpenId4VcVerificationSessionRepository)
        .update(verifier.agent.context, verificationSession)

      await verifier.agent.openid4vc.verifier.deleteVerificationSessionById(verificationSession.id)

      await expect(verifier.agent.kms.getPublicKey({ keyId })).rejects.toThrow('not found')
    })

    it('keeps the response encryption key when deleteAssociatedKey is false', async () => {
      const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()
      const { verificationSession } = await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        requestSigner: { method: 'did', didUrl: verifier.kid },
        verifierId: openIdVerifier.verifierId,
        dcql: { query: openBadgeDcqlQuery },
      })

      await verifier.agent.openid4vc.verifier.deleteVerificationSessionById(verificationSession.id, {
        deleteAssociatedKey: false,
      })

      const keyId = verificationSession.responseEncryptionKey?.keyId as string
      await expect(verifier.agent.kms.getPublicKey({ keyId })).resolves.toBeDefined()
    })

    it('deletes the response encryption key when creating the authorization request fails', async () => {
      const openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()
      const createKeySpy = vi.spyOn(Kms.KeyManagementApi.prototype, 'createKey')
      vi.spyOn(OpenId4VcVerificationSessionRepository.prototype, 'save').mockRejectedValueOnce(new Error('save failed'))

      await expect(
        verifier.agent.openid4vc.verifier.createAuthorizationRequest({
          requestSigner: { method: 'did', didUrl: verifier.kid },
          verifierId: openIdVerifier.verifierId,
          dcql: { query: openBadgeDcqlQuery },
        })
      ).rejects.toThrow('save failed')

      const { keyId } = await (createKeySpy.mock.results[0].value as ReturnType<Kms.KeyManagementApi['createKey']>)
      vi.restoreAllMocks()
      await expect(verifier.agent.kms.getPublicKey({ keyId })).rejects.toThrow('not found')
    })

    it('throws an error when deleting a non-existent verification session', async () => {
      await expect(verifier.agent.openid4vc.verifier.deleteVerificationSessionById('non-existent-id')).rejects.toThrow(
        RecordNotFoundError
      )
    })
  })
})
