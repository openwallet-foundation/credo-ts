import {
  getAnonCredsIndyModules,
  prepareForAnonCredsIssuance,
} from '../../../../../../../anoncreds/tests/legacyAnonCredsSetup'
import { transformPrivateKeyToPrivateJwk } from '../../../../../../../askar/src'
import { Agent } from '../../../../../../../core/src/agent/Agent'
import { CacheModule, InMemoryLruCache } from '../../../../../../../core/src/modules/cache'
import { W3cCredentialsModule } from '../../../../../../../core/src/modules/vc'
import { customDocumentLoader } from '../../../../../../../core/src/modules/vc/data-integrity/__tests__/documentLoader'
import { TypedArrayEncoder } from '../../../../../../../core/src/utils'
import { JsonTransformer } from '../../../../../../../core/src/utils/JsonTransformer'
import type { EventReplaySubject } from '../../../../../../../core/tests'
import {
  getAgentOptions,
  makeConnection,
  setupEventReplaySubjects,
  setupSubjectTransports,
  testLogger,
  waitForCredentialRecordSubject,
} from '../../../../../../../core/tests'
import { DidCommProofEventTypes } from '../../../../proofs'
import { DidCommCredentialEventTypes } from '../../../DidCommCredentialEvents'
import { DidCommJsonLdCredentialFormatService } from '../../../formats'
import { DidCommCredentialState } from '../../../models'
import { DidCommCredentialExchangeRecord } from '../../../repository/DidCommCredentialExchangeRecord'
import { DidCommCredentialV2Preview } from '../messages'

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

const jsonLdCredentialFormat = new DidCommJsonLdCredentialFormatService()

const getIndyJsonLdModules = () =>
  ({
    ...getAnonCredsIndyModules({
      extraCredentialFormatServices: [jsonLdCredentialFormat],
    }),
    cache: new CacheModule({
      cache: new InMemoryLruCache({ limit: 100 }),
    }),
    w3cCredentials: new W3cCredentialsModule({
      documentLoader: customDocumentLoader,
    }),
  }) as const

// TODO: extract these very specific tests to the jsonld format
describe('V2 Credentials - JSON-LD - Ed25519', () => {
  let faberAgent: Agent<ReturnType<typeof getIndyJsonLdModules>>
  let faberReplay: EventReplaySubject
  let aliceAgent: Agent<ReturnType<typeof getIndyJsonLdModules>>
  let aliceReplay: EventReplaySubject
  let aliceConnectionId: string
  let credentialDefinitionId: string

  beforeAll(async () => {
    faberAgent = new Agent(
      getAgentOptions(
        'Faber Agent Indy/JsonLD',
        {
          endpoints: ['rxjs:faber'],
        },
        {},
        getIndyJsonLdModules(),
        { requireDidcomm: true }
      )
    )
    aliceAgent = new Agent(
      getAgentOptions(
        'Alice Agent Indy/JsonLD',
        {
          endpoints: ['rxjs:alice'],
        },
        {},
        getIndyJsonLdModules(),
        { requireDidcomm: true }
      )
    )

    setupSubjectTransports([faberAgent, aliceAgent])
    ;[faberReplay, aliceReplay] = setupEventReplaySubjects(
      [faberAgent, aliceAgent],
      [DidCommCredentialEventTypes.DidCommCredentialStateChanged, DidCommProofEventTypes.ProofStateChanged]
    )
    await faberAgent.initialize()
    await aliceAgent.initialize()
    ;[, { id: aliceConnectionId }] = await makeConnection(faberAgent, aliceAgent)

    const { credentialDefinition } = await prepareForAnonCredsIssuance(faberAgent, {
      attributeNames: ['name', 'age', 'profile_picture', 'x-ray'],
    })
    credentialDefinitionId = credentialDefinition.credentialDefinitionId

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

  test('Alice starts with V2 (ld format, Ed25519 signature) credential proposal to Faber', async () => {
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
      comment: 'V2 Indy Credential',
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
      threadId: faberCredentialRecord.threadId,
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
      comment: 'V2 Indy Credential',
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

  test('Multiple Formats: Alice starts with V2 (both ld and indy formats) credential proposal to Faber', async () => {
    testLogger.test('Alice sends (v2 jsonld) credential proposal to Faber')
    // set the propose options - using both indy and ld credential formats here
    const credentialPreview = DidCommCredentialV2Preview.fromRecord({
      name: 'John',
      age: '99',
      'x-ray': 'some x-ray',
      profile_picture: 'profile picture',
    })

    testLogger.test('Alice sends (v2, Indy) credential proposal to Faber')

    const credentialExchangeRecord = await aliceAgent.didcomm.credentials.proposeCredential({
      connectionId: aliceConnectionId,
      protocolVersion: 'v2',
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          schemaIssuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
          schemaName: 'ahoy',
          schemaVersion: '1.0',
          schemaId: 'q7ATwTYbQDgiigVijUAej:2:test:1.0',
          issuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
          credentialDefinitionId: 'GMm4vMw8LLrLJjp81kRRLp:3:CL:12:tag',
        },
        jsonld: signCredentialOptions,
      },
      comment: 'v2 propose credential test',
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
      comment: 'V2 W3C & INDY Proposals',
      credentialFormats: {
        indy: {
          credentialDefinitionId,
          attributes: credentialPreview.attributes,
        },
        jsonld: {}, // this is to ensure both services are formatted
      },
    })

    testLogger.test('Alice waits for credential offer from Faber')
    let aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.OfferReceived,
    })

    const offerMessage = await faberAgent.didcomm.credentials.findOfferMessage(faberCredentialRecord.id)
    const credentialOfferJson = offerMessage?.offerAttachments[1].getDataAsJson()
    expect(credentialOfferJson).toMatchObject({
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
          type: expect.any(Array),
          givenName: 'JOHN',
          familyName: 'SMITH',
          gender: 'Male',
          image: 'data:image/png;base64,iVBORw0KGgokJggg==',
          description: 'Government of Example Permanent Resident Card.',
          residentSince: '2015-01-01',
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
    })
    expect(JsonTransformer.toJSON(offerMessage)).toMatchObject({
      '@type': 'https://didcomm.org/issue-credential/2.0/offer-credential',
      '@id': expect.any(String),
      comment: 'V2 W3C & INDY Proposals',
      formats: [
        {
          attach_id: expect.any(String),
          format: 'hlindy/cred-abstract@v2.0',
        },
        {
          attach_id: expect.any(String),
          format: 'aries/ld-proof-vc-detail@v1.0',
        },
      ],
      credential_preview: {
        '@type': 'https://didcomm.org/issue-credential/2.0/credential-preview',
        attributes: expect.any(Array),
      },
      'offers~attach': [
        {
          '@id': expect.any(String),
          'mime-type': 'application/json',
          data: expect.any(Object),
          lastmod_time: undefined,
          byte_count: undefined,
        },
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
      replacement_id: undefined,
    })
    expect(aliceCredentialRecord.id).not.toBeNull()
    expect(aliceCredentialRecord.type).toBe(DidCommCredentialExchangeRecord.type)

    const offerCredentialExchangeRecord = await aliceAgent.didcomm.credentials.acceptOffer({
      credentialExchangeRecordId: aliceCredentialRecord.id,
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
      comment: 'V2 Indy Credential',
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
      threadId: faberCredentialRecord.threadId,
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
    const w3cCredential = credentialMessage?.credentialAttachments[1].getDataAsJson()
    expect(w3cCredential).toMatchObject({
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
      proof: {
        type: 'Ed25519Signature2018',
        created: expect.any(String),
        verificationMethod:
          'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
        proofPurpose: 'assertionMethod',
      },
    })

    expect(JsonTransformer.toJSON(credentialMessage)).toMatchObject({
      '@type': 'https://didcomm.org/issue-credential/2.0/issue-credential',
      '@id': expect.any(String),
      comment: 'V2 Indy Credential',
      formats: [
        {
          attach_id: expect.any(String),
          format: 'hlindy/cred@v2.0',
        },
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
