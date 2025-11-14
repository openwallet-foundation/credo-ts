import type { EventReplaySubject } from '../../core/tests'
import type { CheqdDidCreateOptions } from '../src'
import type { Key } from '@credo-ts/core'

import {
  DidDocumentBuilder,
  getEd25519VerificationKey2018,
  KeyType,
  utils,
  Agent,
  TypedArrayEncoder,
  DifPresentationExchangeProofFormatService,
  JsonLdCredentialFormatService,
  CredentialsModule,
  V2CredentialProtocol,
  ProofsModule,
  V2ProofProtocol,
  CacheModule,
  InMemoryLruCache,
  W3cCredentialsModule,
  CredentialState,
  CredentialExchangeRecord,
  JsonTransformer,
  ProofEventTypes,
  CredentialEventTypes,
} from '@credo-ts/core'

import { setupEventReplaySubjects, setupSubjectTransports, testLogger } from '../../core/tests'
import { getInMemoryAgentOptions, makeConnection, waitForCredentialRecordSubject } from '../../core/tests/helpers'

import { cheqdPayerSeeds, getCheqdModules } from './setupCheqdModule'

const did = `did:cheqd:testnet:${utils.uuid()}`
let ed25519Key: Key

const signCredentialOptions = {
  credential: {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/citizenship/v1',
      'https://w3id.org/security/bbs/v1',
    ],
    id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
    type: ['VerifiableCredential', 'PermanentResidentCard'],
    issuer: did,
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

const jsonLdCredentialFormat = new JsonLdCredentialFormatService()
const jsonLdProofFormat = new DifPresentationExchangeProofFormatService()

const getCheqdJsonLdModules = () =>
  ({
    ...getCheqdModules(cheqdPayerSeeds[4]),
    credentials: new CredentialsModule({
      credentialProtocols: [
        new V2CredentialProtocol({
          credentialFormats: [jsonLdCredentialFormat],
        }),
      ],
    }),
    proofs: new ProofsModule({
      proofProtocols: [
        new V2ProofProtocol({
          proofFormats: [jsonLdProofFormat],
        }),
      ],
    }),
    cache: new CacheModule({
      cache: new InMemoryLruCache({ limit: 100 }),
    }),
    w3cCredentials: new W3cCredentialsModule({}),
  } as const)

// TODO: extract these very specific tests to the jsonld format
describe('Cheqd V2 Credentials - JSON-LD - Ed25519', () => {
  let faberAgent: Agent<ReturnType<typeof getCheqdJsonLdModules>>
  let faberReplay: EventReplaySubject
  let aliceAgent: Agent<ReturnType<typeof getCheqdJsonLdModules>>
  let aliceReplay: EventReplaySubject
  let aliceConnectionId: string

  beforeAll(async () => {
    faberAgent = new Agent(
      getInMemoryAgentOptions(
        'Faber Agent Indy/JsonLD',
        {
          endpoints: ['rxjs:faber'],
        },
        getCheqdJsonLdModules()
      )
    )
    aliceAgent = new Agent(
      getInMemoryAgentOptions(
        'Alice Agent Indy/JsonLD',
        {
          endpoints: ['rxjs:alice'],
        },
        getCheqdJsonLdModules()
      )
    )

    setupSubjectTransports([faberAgent, aliceAgent])
    ;[faberReplay, aliceReplay] = setupEventReplaySubjects(
      [faberAgent, aliceAgent],
      [CredentialEventTypes.CredentialStateChanged, ProofEventTypes.ProofStateChanged]
    )
    await faberAgent.initialize()
    await aliceAgent.initialize()
    ;[, { id: aliceConnectionId }] = await makeConnection(faberAgent, aliceAgent)

    await faberAgent.context.wallet.createKey({
      privateKey: TypedArrayEncoder.fromString('testseed000000000000000000000001'),
      keyType: KeyType.Ed25519,
    })
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  it('should create a did:cheqd did using custom did document containing Ed25519 key', async () => {
    ed25519Key = await faberAgent.wallet.createKey({
      keyType: KeyType.Ed25519,
    })

    const createResult = await faberAgent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      didDocument: new DidDocumentBuilder(did)
        .addController(did)
        .addVerificationMethod(
          getEd25519VerificationKey2018({
            key: ed25519Key,
            controller: did,
            id: `${did}#${ed25519Key.fingerprint}`,
          })
        )
        .addAssertionMethod(`${did}#${ed25519Key.fingerprint}`)
        .addAuthentication(`${did}#${ed25519Key.fingerprint}`)
        .build(),
    })

    expect(createResult).toMatchObject({
      didState: {
        state: 'finished',
      },
    })

    expect(createResult.didState.didDocument?.toJSON()).toMatchObject({
      '@context': [
        'https://w3id.org/did/v1',
        'https://w3id.org/security/suites/ed25519-2018/v1',
        'https://www.w3.org/ns/did/v1',
      ],
      verificationMethod: [
        {
          controller: did,
          type: 'Ed25519VerificationKey2018',
          publicKeyBase58: ed25519Key.publicKeyBase58,
        },
      ],
    })
  })

  test('Alice starts with V2 (ld format, Ed25519 signature) credential proposal to Faber', async () => {
    testLogger.test('Alice sends (v2 jsonld) credential proposal to Faber')

    const credentialExchangeRecord = await aliceAgent.credentials.proposeCredential({
      connectionId: aliceConnectionId,
      protocolVersion: 'v2',
      credentialFormats: {
        jsonld: signCredentialOptions,
      },
      comment: 'v2 propose credential test for W3C Credentials',
    })

    expect(credentialExchangeRecord.connectionId).toEqual(aliceConnectionId)
    expect(credentialExchangeRecord.protocolVersion).toEqual('v2')
    expect(credentialExchangeRecord.state).toEqual(CredentialState.ProposalSent)
    expect(credentialExchangeRecord.threadId).not.toBeNull()

    testLogger.test('Faber waits for credential proposal from Alice')
    let faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: credentialExchangeRecord.threadId,
      state: CredentialState.ProposalReceived,
    })

    testLogger.test('Faber sends credential offer to Alice')
    await faberAgent.credentials.acceptProposal({
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V2 W3C Offer',
    })

    testLogger.test('Alice waits for credential offer from Faber')
    let aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    const offerMessage = await aliceAgent.credentials.findOfferMessage(aliceCredentialRecord.id)
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
    expect(aliceCredentialRecord.type).toBe(CredentialExchangeRecord.type)

    const offerCredentialExchangeRecord = await aliceAgent.credentials.acceptOffer({
      credentialRecordId: aliceCredentialRecord.id,
      credentialFormats: {
        jsonld: {},
      },
    })

    expect(offerCredentialExchangeRecord.connectionId).toEqual(aliceConnectionId)
    expect(offerCredentialExchangeRecord.protocolVersion).toEqual('v2')
    expect(offerCredentialExchangeRecord.state).toEqual(CredentialState.RequestSent)
    expect(offerCredentialExchangeRecord.threadId).not.toBeNull()

    testLogger.test('Faber waits for credential request from Alice')
    await waitForCredentialRecordSubject(faberReplay, {
      threadId: aliceCredentialRecord.threadId,
      state: CredentialState.RequestReceived,
    })

    testLogger.test('Faber sends credential to Alice')

    await faberAgent.credentials.acceptRequest({
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Credential',
    })

    testLogger.test('Alice waits for credential from Faber')
    aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.CredentialReceived,
    })

    testLogger.test('Alice sends credential ack to Faber')
    await aliceAgent.credentials.acceptCredential({ credentialRecordId: aliceCredentialRecord.id })

    testLogger.test('Faber waits for credential ack from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.Done,
    })
    expect(aliceCredentialRecord).toMatchObject({
      type: CredentialExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      threadId: expect.any(String),
      connectionId: expect.any(String),
      state: CredentialState.CredentialReceived,
    })

    const credentialMessage = await faberAgent.credentials.findCredentialMessage(faberCredentialRecord.id)
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
})
