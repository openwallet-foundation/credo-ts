import { transformPrivateKeyToPrivateJwk } from '../../../../../../../askar/src'
import { CredoError } from '../../../../../../../core/src/error/CredoError'
import { CREDENTIALS_CONTEXT_V1_URL } from '../../../../../../../core/src/modules/vc/constants'
import { TypedArrayEncoder } from '../../../../../../../core/src/utils'
import type { JsonLdTestsAgent } from '../../../../../../../core/tests'
import { setupJsonLdTests } from '../../../../../../../core/tests'
import { waitForCredentialRecord } from '../../../../../../../core/tests/helpers'
import testLogger from '../../../../../../../core/tests/logger'
import { DidCommAutoAcceptCredential, DidCommCredentialRole, DidCommCredentialState } from '../../../models'
import { DidCommCredentialExchangeRecord } from '../../../repository/DidCommCredentialExchangeRecord'

const signCredentialOptions = {
  credential: {
    '@context': [CREDENTIALS_CONTEXT_V1_URL, 'https://www.w3.org/2018/credentials/examples/v1'],
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    issuer: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
    issuanceDate: '2017-10-22T12:23:48Z',
    credentialSubject: {
      degree: {
        type: 'BachelorDegree',
        name: 'Bachelor of Science and Arts',
      },
    },
  },
  options: {
    proofType: 'Ed25519Signature2018',
    proofPurpose: 'assertionMethod',
  },
}

describe('V2 Credentials - JSON-LD - Auto Accept Always', () => {
  let faberAgent: JsonLdTestsAgent
  let aliceAgent: JsonLdTestsAgent
  let faberConnectionId: string
  let aliceConnectionId: string

  describe("Auto accept on 'always'", () => {
    beforeAll(async () => {
      ;({
        issuerAgent: faberAgent,
        holderAgent: aliceAgent,
        issuerHolderConnectionId: faberConnectionId,
        holderIssuerConnectionId: aliceConnectionId,
      } = await setupJsonLdTests({
        issuerName: 'faber agent: always v2 jsonld',
        holderName: 'alice agent: always v2 jsonld',
        autoAcceptCredentials: DidCommAutoAcceptCredential.Always,
      }))

      const key = await faberAgent.kms.importKey({
        privateJwk: transformPrivateKeyToPrivateJwk({
          privateKey: TypedArrayEncoder.fromString('testseed000000000000000000000001'),
          type: {
            crv: 'Ed25519',
            kty: 'OKP',
          },
        }).privateJwk,
      })

      await faberAgent.dids.import({
        did: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
        keys: [
          {
            didDocumentRelativeKeyId: '#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
            kmsKeyId: key.keyId,
          },
        ],
      })
    })

    afterAll(async () => {
      await faberAgent.shutdown()
      await aliceAgent.shutdown()
    })

    test("Alice starts with V2 credential proposal to Faber, both with autoAcceptCredential on 'always'", async () => {
      testLogger.test('Alice sends credential proposal to Faber')

      const aliceCredentialExchangeRecord = await aliceAgent.modules.credentials.proposeCredential({
        connectionId: aliceConnectionId,
        protocolVersion: 'v2',
        credentialFormats: {
          jsonld: signCredentialOptions,
        },
        comment: 'v2 propose credential test',
      })

      testLogger.test('Alice waits for credential from Faber')

      let aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: aliceCredentialExchangeRecord.threadId,
        state: DidCommCredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')
      aliceCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: DidCommCredentialState.Done,
      })
      expect(aliceCredentialRecord).toMatchObject({
        type: DidCommCredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {},
        state: DidCommCredentialState.Done,
      })
    })
    test("Faber starts with V2 credential offer to Alice, both with autoAcceptCredential on 'always'", async () => {
      testLogger.test('Faber sends V2 credential offer to Alice as start of protocol process')

      const faberCredentialExchangeRecord: DidCommCredentialExchangeRecord =
        await faberAgent.modules.credentials.offerCredential({
          comment: 'some comment about credential',
          connectionId: faberConnectionId,
          credentialFormats: {
            jsonld: signCredentialOptions,
          },
          protocolVersion: 'v2',
        })
      testLogger.test('Alice waits for credential from Faber')
      let aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: DidCommCredentialState.OfferReceived,
      })
      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: DidCommCredentialState.CredentialReceived,
      })
      testLogger.test('Faber waits for credential ack from Alice')
      const faberCredentialRecord: DidCommCredentialExchangeRecord = await waitForCredentialRecord(faberAgent, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: DidCommCredentialState.Done,
      })

      expect(aliceCredentialRecord).toMatchObject({
        type: DidCommCredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {},
        state: DidCommCredentialState.CredentialReceived,
      })
      expect(faberCredentialRecord).toMatchObject({
        type: DidCommCredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        state: DidCommCredentialState.Done,
      })
    })
  })

  describe("Auto accept on 'contentApproved'", () => {
    beforeAll(async () => {
      ;({
        issuerAgent: faberAgent,
        holderAgent: aliceAgent,
        issuerHolderConnectionId: faberConnectionId,
        holderIssuerConnectionId: aliceConnectionId,
      } = await setupJsonLdTests({
        issuerName: 'faber agent: ContentApproved v2 jsonld',
        holderName: 'alice agent: ContentApproved v2 jsonld',
        autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
      }))

      const key = await faberAgent.kms.importKey({
        privateJwk: transformPrivateKeyToPrivateJwk({
          privateKey: TypedArrayEncoder.fromString('testseed000000000000000000000001'),
          type: {
            crv: 'Ed25519',
            kty: 'OKP',
          },
        }).privateJwk,
      })

      await faberAgent.dids.import({
        did: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
        keys: [
          {
            didDocumentRelativeKeyId: '#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
            kmsKeyId: key.keyId,
          },
        ],
      })
    })

    afterAll(async () => {
      await faberAgent.shutdown()
      await aliceAgent.shutdown()
    })

    test("Alice starts with V2 credential proposal to Faber, both with autoAcceptCredential on 'contentApproved'", async () => {
      testLogger.test('Alice sends credential proposal to Faber')
      const aliceCredentialExchangeRecord = await aliceAgent.modules.credentials.proposeCredential({
        connectionId: aliceConnectionId,
        protocolVersion: 'v2',
        credentialFormats: {
          jsonld: signCredentialOptions,
        },
        comment: 'v2 propose credential test',
      })

      testLogger.test('Faber waits for credential proposal from Alice')
      let faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialExchangeRecord.threadId,
        state: DidCommCredentialState.ProposalReceived,
      })

      testLogger.test('Faber sends credential offer to Alice')
      const faberCredentialExchangeRecord = await faberAgent.modules.credentials.acceptProposal({
        credentialExchangeRecordId: faberCredentialRecord.id,
        comment: 'V2 JsonLd Offer',
      })

      testLogger.test('Alice waits for credential from Faber')
      const aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: DidCommCredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')

      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: faberCredentialRecord.threadId,
        state: DidCommCredentialState.Done,
      })

      expect(aliceCredentialRecord).toMatchObject({
        type: DidCommCredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {},
        state: DidCommCredentialState.CredentialReceived,
      })

      expect(faberCredentialRecord).toMatchObject({
        type: DidCommCredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {},
        state: DidCommCredentialState.Done,
      })
    })
    test("Faber starts with V2 credential offer to Alice, both with autoAcceptCredential on 'contentApproved'", async () => {
      testLogger.test('Faber sends credential offer to Alice')

      let faberCredentialExchangeRecord = await faberAgent.modules.credentials.offerCredential({
        comment: 'some comment about credential',
        connectionId: faberConnectionId,
        credentialFormats: {
          jsonld: signCredentialOptions,
        },
        protocolVersion: 'v2',
      })

      testLogger.test('Alice waits for credential offer from Faber')
      let aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: DidCommCredentialState.OfferReceived,
      })

      // below values are not in json object
      expect(aliceCredentialRecord.id).not.toBeNull()
      expect(aliceCredentialRecord.getTags()).toEqual({
        threadId: aliceCredentialRecord.threadId,
        state: aliceCredentialRecord.state,
        connectionId: aliceConnectionId,
        role: DidCommCredentialRole.Holder,
        credentialIds: [],
      })
      expect(aliceCredentialRecord.type).toBe(DidCommCredentialExchangeRecord.type)
      if (!aliceCredentialRecord.connectionId) {
        throw new CredoError('missing alice connection id')
      }

      // we do not need to specify connection id in this object
      // it is either connectionless or included in the offer message
      testLogger.test('Alice sends credential request to faber')
      faberCredentialExchangeRecord = await aliceAgent.modules.credentials.acceptOffer({
        credentialExchangeRecordId: aliceCredentialRecord.id,
      })

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: DidCommCredentialState.CredentialReceived,
      })

      testLogger.test('Faber waits for credential ack from Alice')

      const faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: DidCommCredentialState.Done,
      })

      expect(aliceCredentialRecord).toMatchObject({
        type: DidCommCredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        metadata: {},
        state: DidCommCredentialState.CredentialReceived,
      })

      expect(faberCredentialRecord).toMatchObject({
        type: DidCommCredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        state: DidCommCredentialState.Done,
      })
    })
    test("Faber starts with V2 credential offer to Alice, both have autoAcceptCredential on 'contentApproved' and attributes did change", async () => {
      testLogger.test('Faber sends credential offer to Alice')

      const faberCredentialExchangeRecord: DidCommCredentialExchangeRecord =
        await faberAgent.modules.credentials.offerCredential({
          comment: 'some comment about credential',
          connectionId: faberConnectionId,
          credentialFormats: {
            jsonld: signCredentialOptions,
          },
          protocolVersion: 'v2',
        })
      testLogger.test('Alice waits for credential from Faber')
      let aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialExchangeRecord.threadId,
        state: DidCommCredentialState.OfferReceived,
      })

      // below values are not in json object
      expect(aliceCredentialRecord.id).not.toBeNull()
      expect(aliceCredentialRecord.getTags()).toEqual({
        threadId: aliceCredentialRecord.threadId,
        state: aliceCredentialRecord.state,
        connectionId: aliceConnectionId,
        role: DidCommCredentialRole.Holder,
        credentialIds: [],
      })
      expect(aliceCredentialRecord.type).toBe(DidCommCredentialExchangeRecord.type)

      testLogger.test('Alice sends credential request to Faber')

      const aliceExchangeCredentialRecord = await aliceAgent.modules.credentials.negotiateOffer({
        credentialExchangeRecordId: aliceCredentialRecord.id,
        credentialFormats: {
          // Send a different object
          jsonld: {
            ...signCredentialOptions,
            credential: {
              ...signCredentialOptions.credential,
              credentialSubject: {
                ...signCredentialOptions.credential.credentialSubject,
                name: 'Different Property',
              },
            },
          },
        },
        comment: 'v2 propose credential test',
      })

      testLogger.test('Faber waits for credential proposal from Alice')
      const faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceExchangeCredentialRecord.threadId,
        state: DidCommCredentialState.ProposalReceived,
      })

      // Check if the state of faber credential record did not change
      const faberRecord = await faberAgent.modules.credentials.getById(faberCredentialRecord.id)
      faberRecord.assertState(DidCommCredentialState.ProposalReceived)

      aliceCredentialRecord = await aliceAgent.modules.credentials.getById(aliceCredentialRecord.id)
      aliceCredentialRecord.assertState(DidCommCredentialState.ProposalSent)
    })

    test("Alice starts with V2 credential proposal to Faber, both have autoAcceptCredential on 'contentApproved' and attributes did change", async () => {
      testLogger.test('Alice sends credential proposal to Faber')
      const aliceCredentialExchangeRecord = await aliceAgent.modules.credentials.proposeCredential({
        connectionId: aliceConnectionId,
        protocolVersion: 'v2',
        credentialFormats: {
          jsonld: signCredentialOptions,
        },
        comment: 'v2 propose credential test',
      })

      testLogger.test('Faber waits for credential proposal from Alice')
      let faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialExchangeRecord.threadId,
        state: DidCommCredentialState.ProposalReceived,
      })

      await faberAgent.modules.credentials.negotiateProposal({
        credentialExchangeRecordId: faberCredentialRecord.id,
        credentialFormats: {
          // Send a different object
          jsonld: {
            ...signCredentialOptions,
            credential: {
              ...signCredentialOptions.credential,
              credentialSubject: {
                ...signCredentialOptions.credential.credentialSubject,
                name: 'Different Property',
              },
            },
          },
        },
      })

      testLogger.test('Alice waits for credential offer from Faber')

      const record = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: DidCommCredentialState.OfferReceived,
      })

      // below values are not in json object
      expect(record.id).not.toBeNull()
      expect(record.getTags()).toEqual({
        threadId: record.threadId,
        state: record.state,
        connectionId: aliceConnectionId,
        role: DidCommCredentialRole.Holder,
        credentialIds: [],
      })
      expect(record.type).toBe(DidCommCredentialExchangeRecord.type)

      // Check if the state of the credential records did not change
      faberCredentialRecord = await faberAgent.modules.credentials.getById(faberCredentialRecord.id)
      faberCredentialRecord.assertState(DidCommCredentialState.OfferSent)

      const aliceRecord = await aliceAgent.modules.credentials.getById(record.id)
      aliceRecord.assertState(DidCommCredentialState.OfferReceived)
    })
  })
})
