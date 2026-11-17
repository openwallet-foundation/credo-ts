import { transformPrivateKeyToPrivateJwk } from '../../../../../../../askar/src'
import { TypedArrayEncoder } from '../../../../../../../core/src/utils'
import { JsonTransformer } from '../../../../../../../core/src/utils/JsonTransformer'
import type { EventReplaySubject, JsonLdTestsAgent } from '../../../../../../../core/tests'
import {
  setupJsonLdTests,
  testLogger,
  trustDids,
  waitForCredentialRecordSubject,
} from '../../../../../../../core/tests'
import { DidCommCredentialState } from '../../../models'
import { DidCommCredentialExchangeRecord } from '../../../repository/DidCommCredentialExchangeRecord'

const signCredentialOptions = {
  credential: {
    '@context': ['https://www.w3.org/2018/credentials/v1', 'https://w3id.org/citizenship/v1'],
    id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
    type: ['VerifiableCredential', 'PermanentResidentCard'],
    issuer: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
    issuanceDate: '2019-12-03T12:19:52Z',
    expirationDate: '2029-12-03T12:19:52Z',
    identifier: '83627465',
    name: 'Permanent Resident Card',
    credentialSubject: {
      id: 'did:example:b34ca6cd37bbf23',
      type: ['PermanentResident', 'Person'],
      givenName: 'JOHN',
      familyName: 'SMITH',
      gender: 'Male',
      image: 'data:image/png;base64,iVBORw0KGgokJggg==',
      residentSince: '2015-01-01',
      description: 'Government of Example Permanent Resident Card.',
      lprCategory: 'C09',
      lprNumber: '999-999-999',
      commuterClassification: 'C1',
      birthCountry: 'Bahamas',
      birthDate: '1958-07-17',
    },
  },
  options: {
    proofType: 'Ed25519Signature2018',
    proofPurpose: 'assertionMethod',
  },
}

describe('V2 JSON-LD credentials - Ed25519', () => {
  let faberAgent: JsonLdTestsAgent
  let faberReplay: EventReplaySubject
  let aliceAgent: JsonLdTestsAgent
  let aliceReplay: EventReplaySubject
  let aliceConnectionId: string

  beforeAll(async () => {
    const setup = await setupJsonLdTests({
      issuerName: 'Faber Agent JSON-LD',
      holderName: 'Alice Agent JSON-LD',
    })
    faberAgent = setup.issuerAgent
    faberReplay = setup.issuerReplay
    aliceAgent = setup.holderAgent
    aliceReplay = setup.holderReplay
    aliceConnectionId = setup.holderIssuerConnectionId
    aliceAgent.config.setTrustedIssuersForVerification(trustDids(signCredentialOptions.credential.issuer))

    const key = await faberAgent.kms.importKey({
      privateJwk: transformPrivateKeyToPrivateJwk({
        privateKey: TypedArrayEncoder.fromUtf8String('testseed000000000000000000000001'),
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

  test('Alice starts with V2 JSON-LD credential proposal to Faber', async () => {
    testLogger.test('Alice sends (v2 jsonld) credential proposal to Faber')

    const credentialExchangeRecord = await aliceAgent.didcomm.credentials.proposeCredential({
      connectionId: aliceConnectionId,
      protocolVersion: 'v2',
      credentialFormats: {
        jsonld: signCredentialOptions,
      },
      comment: 'v2 propose credential test for W3C Credentials',
    })

    expect(credentialExchangeRecord.connectionId).toEqual(aliceConnectionId)
    expect(credentialExchangeRecord.protocolVersion).toEqual('v2')
    expect(credentialExchangeRecord.state).toEqual(DidCommCredentialState.ProposalSent)
    expect(credentialExchangeRecord.threadId).not.toBeNull()

    testLogger.test('Faber waits for credential proposal from Alice')
    let faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: credentialExchangeRecord.threadId,
      state: DidCommCredentialState.ProposalReceived,
    })

    testLogger.test('Faber sends credential offer to Alice')
    await faberAgent.didcomm.credentials.acceptProposal({
      credentialExchangeRecordId: faberCredentialRecord.id,
      comment: 'V2 W3C Offer',
    })

    testLogger.test('Alice waits for credential offer from Faber')
    let aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.OfferReceived,
    })

    const offerMessage = await aliceAgent.didcomm.credentials.findOfferMessage(aliceCredentialRecord.id)
    expect(JsonTransformer.toJSON(offerMessage)).toMatchObject({
      '@type': 'https://didcomm.org/issue-credential/2.0/offer-credential',
      '@id': expect.any(String),
      comment: 'V2 W3C Offer',
      formats: [
        {
          attach_id: expect.any(String),
          format: 'aries/ld-proof-vc-detail@v1.0',
        },
      ],
      'offers~attach': [
        {
          '@id': expect.any(String),
          'mime-type': 'application/json',
          data: expect.any(Object),
          lastmod_time: undefined,
          byte_count: undefined,
        },
      ],
      '~thread': {
        thid: expect.any(String),
        pthid: undefined,
        sender_order: undefined,
        received_orders: undefined,
      },
      '~service': undefined,
      '~attach': undefined,
      '~please_ack': undefined,
      '~timing': undefined,
      '~transport': undefined,
      '~l10n': undefined,
      credential_preview: expect.any(Object),
      replacement_id: undefined,
    })
    expect(aliceCredentialRecord.id).not.toBeNull()
    expect(aliceCredentialRecord.type).toBe(DidCommCredentialExchangeRecord.type)

    const offerCredentialExchangeRecord = await aliceAgent.didcomm.credentials.acceptOffer({
      credentialExchangeRecordId: aliceCredentialRecord.id,
      credentialFormats: {
        jsonld: {},
      },
    })

    expect(offerCredentialExchangeRecord.connectionId).toEqual(aliceConnectionId)
    expect(offerCredentialExchangeRecord.protocolVersion).toEqual('v2')
    expect(offerCredentialExchangeRecord.state).toEqual(DidCommCredentialState.RequestSent)
    expect(offerCredentialExchangeRecord.threadId).not.toBeNull()

    testLogger.test('Faber waits for credential request from Alice')
    await waitForCredentialRecordSubject(faberReplay, {
      threadId: aliceCredentialRecord.threadId,
      state: DidCommCredentialState.RequestReceived,
    })

    testLogger.test('Faber sends credential to Alice')
    await faberAgent.didcomm.credentials.acceptRequest({
      credentialExchangeRecordId: faberCredentialRecord.id,
      comment: 'V2 JSON-LD Credential',
    })

    testLogger.test('Alice waits for credential from Faber')
    aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.CredentialReceived,
    })

    testLogger.test('Alice sends credential ack to Faber')
    await aliceAgent.didcomm.credentials.acceptCredential({ credentialExchangeRecordId: aliceCredentialRecord.id })

    testLogger.test('Faber waits for credential ack from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: aliceCredentialRecord.threadId,
      state: DidCommCredentialState.Done,
    })
    expect(aliceCredentialRecord).toMatchObject({
      type: DidCommCredentialExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: expect.any(String),
      connectionId: expect.any(String),
      state: DidCommCredentialState.CredentialReceived,
    })

    const credentialMessage = await faberAgent.didcomm.credentials.findCredentialMessage(faberCredentialRecord.id)
    expect(JsonTransformer.toJSON(credentialMessage)).toMatchObject({
      '@type': 'https://didcomm.org/issue-credential/2.0/issue-credential',
      '@id': expect.any(String),
      comment: 'V2 JSON-LD Credential',
      formats: [
        {
          attach_id: expect.any(String),
          format: 'aries/ld-proof-vc@v1.0',
        },
      ],
      'credentials~attach': [
        {
          '@id': expect.any(String),
          'mime-type': 'application/json',
          data: expect.any(Object),
          lastmod_time: undefined,
          byte_count: undefined,
        },
      ],
      '~thread': {
        thid: expect.any(String),
        pthid: undefined,
        sender_order: undefined,
        received_orders: undefined,
      },
      '~please_ack': { on: ['RECEIPT'] },
      '~service': undefined,
      '~attach': undefined,
      '~timing': undefined,
      '~transport': undefined,
      '~l10n': undefined,
    })
  })
})
