import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { CredentialStateChangedEvent } from '../src/modules/credentials'
import type { OfferCredentialOptions } from '../src/modules/credentials/CredentialsModuleOptions'
import type { ProofStateChangedEvent } from '../src/modules/proofs'
import type { InputDescriptors } from '../src/modules/proofs/formats/presentation-exchange/models/InputDescriptors'
import type { AcceptPresentationOptions, OutOfBandRequestOptions } from '../src/modules/proofs/models/ModuleOptions'
import type { SignCredentialOptions } from '../src/modules/vc/models/W3cCredentialServiceOptions'

import { ReplaySubject, Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../src/agent/Agent'
import { Key } from '../src/crypto/Key'
import { KeyType } from '../src/crypto/KeyType'
import { HandshakeProtocol } from '../src/modules/connections/models/HandshakeProtocol'
import {
  AutoAcceptCredential,
  CredentialEventTypes,
  CredentialProtocolVersion,
  CredentialState,
} from '../src/modules/credentials'
import { V2CredentialPreview } from '../src/modules/credentials/protocol/v2/V2CredentialPreview'
import { DidKey } from '../src/modules/dids'
import { ProofEventTypes, ProofState, AutoAcceptProof } from '../src/modules/proofs'
import { PresentationDefinition } from '../src/modules/proofs/formats/presentation-exchange/models/RequestPresentation'
import { ProofProtocolVersion } from '../src/modules/proofs/models/ProofProtocolVersion'
import { MediatorPickupStrategy } from '../src/modules/routing/MediatorPickupStrategy'
import { W3cCredential } from '../src/modules/vc/models'
import { JsonTransformer } from '../src/utils/JsonTransformer'
import { uuid } from '../src/utils/uuid'
import { IndyWallet } from '../src/wallet/IndyWallet'

import {
  getBaseConfig,
  makeConnection,
  prepareForIssuance,
  setupV2ProofsTest,
  waitForCredentialRecordSubject,
  waitForProofRecordSubject,
} from './helpers'
import testLogger from './logger'

describe('Present Proof', () => {
  let agents: Agent[]

  afterEach(async () => {
    for (const agent of agents) {
      await agent.shutdown()
      await agent.wallet.delete()
    }
  })

  test('Faber starts with connection-less proof requests to Alice', async () => {
    const { aliceAgent, faberAgent, aliceReplay, faberReplay } = await setupV2ProofsTest(
      'Faber connection-less Proofs',
      'Alice connection-less Proofs',
      AutoAcceptProof.Never
    )
    agents = [aliceAgent, faberAgent]
    testLogger.test('Faber sends presentation request to Alice')

    const inputDescriptors: InputDescriptors[] = [
      {
        id: 'citizenship_input',
        name: 'US Passport',
        group: ['A'],
        schema: [
          {
            uri: 'https://w3id.org/citizenship/v1',
          },
        ],
        constraints: {
          fields: [
            {
              path: ['$.credentialSubject.birth_date', '$.vc.credentialSubject.birth_date', '$.birth_date'],
              filter: {
                type: 'date',
                minimum: '1999-5-16',
              },
            },
          ],
        },
      },
    ]

    const presentationDefinition: PresentationDefinition = new PresentationDefinition({
      inputDescriptors,
      format: {
        ldpVc: {
          proofType: ['Ed25519Signature2018'],
        },
      },
    })

    const outOfBandRequestOptions: OutOfBandRequestOptions = {
      protocolVersion: ProofProtocolVersion.V2,
      proofFormats: {
        presentationExchange: {
          options: {
            challenge: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
            domain: '',
          },
          presentationDefinition,
        },
      },
    }

    // eslint-disable-next-line prefer-const
    let { proofRecord: faberProofRecord, message } = await faberAgent.proofs.createOutOfBandRequest(
      outOfBandRequestOptions
    )

    await aliceAgent.receiveMessage(message.toJSON())

    testLogger.test('Alice waits for presentation request from Faber')
    let aliceProofRecord = await waitForProofRecordSubject(aliceReplay, {
      threadId: faberProofRecord.threadId,
      state: ProofState.RequestReceived,
    })

    testLogger.test('Alice accepts presentation request from Faber')

    const requestedCredentials = await aliceAgent.proofs.autoSelectCredentialsForProofRequest({
      proofRecordId: aliceProofRecord.id,
      config: {
        filterByPresentationPreview: true,
      },
    })

    const acceptPresentationOptions: AcceptPresentationOptions = {
      proofRecordId: aliceProofRecord.id,
      proofFormats: requestedCredentials,
    }

    await aliceAgent.proofs.acceptRequest(acceptPresentationOptions)

    testLogger.test('Faber waits for presentation from Alice')
    faberProofRecord = await waitForProofRecordSubject(faberReplay, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.PresentationReceived,
      timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
    })

    // assert presentation is valid
    expect(faberProofRecord.isVerified).toBe(true)

    // Faber accepts presentation
    await faberAgent.proofs.acceptPresentation(faberProofRecord.id)

    // Alice waits till it receives presentation ack
    aliceProofRecord = await waitForProofRecordSubject(aliceReplay, {
      threadId: aliceProofRecord.threadId,
      state: ProofState.Done,
    })
  })

  test('Faber starts with connection-less proof requests to Alice with auto-accept enabled', async () => {
    testLogger.test('Faber sends presentation request to Alice')

    const { aliceAgent, faberAgent, aliceReplay, faberReplay } = await setupV2ProofsTest(
      'Faber connection-less Proofs - Auto Accept',
      'Alice connection-less Proofs - Auto Accept',
      AutoAcceptProof.Always
    )

    agents = [aliceAgent, faberAgent]

    const inputDescriptors: InputDescriptors[] = [
      {
        id: 'citizenship_input',
        name: 'US Passport',
        group: ['A'],
        schema: [
          {
            uri: 'https://w3id.org/citizenship/v1',
          },
        ],
        constraints: {
          fields: [
            {
              path: ['$.credentialSubject.birth_date', '$.vc.credentialSubject.birth_date', '$.birth_date'],
              filter: {
                type: 'date',
                minimum: '1999-5-16',
              },
            },
          ],
        },
      },
    ]

    const presentationDefinition: PresentationDefinition = new PresentationDefinition({
      inputDescriptors,
      format: {
        ldpVc: {
          proofType: ['Ed25519Signature2018'],
        },
      },
    })

    const outOfBandRequestOptions: OutOfBandRequestOptions = {
      protocolVersion: ProofProtocolVersion.V2,
      proofFormats: {
        presentationExchange: {
          options: {
            challenge: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
            domain: '',
          },
          presentationDefinition,
        },
      },
      autoAcceptProof: AutoAcceptProof.ContentApproved,
    }

    // eslint-disable-next-line prefer-const
    let { proofRecord: faberProofRecord, message } = await faberAgent.proofs.createOutOfBandRequest(
      outOfBandRequestOptions
    )

    await aliceAgent.receiveMessage(message.toJSON())

    await waitForProofRecordSubject(aliceReplay, {
      threadId: faberProofRecord.threadId,
      state: ProofState.Done,
      timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
    })

    await waitForProofRecordSubject(faberReplay, {
      threadId: faberProofRecord.threadId,
      state: ProofState.Done,
      timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
    })
  })

  test('Faber starts with connection-less proof requests to Alice with auto-accept enabled and both agents having a mediator', async () => {
    testLogger.test('Faber sends presentation request to Alice')

    // const credentialPreview = V2CredentialPreview.fromRecord({
    //   name: 'John',
    //   age: '99',
    //   image_0: 'some x-ray',
    //   image_1: 'profile picture',
    // })

    const unique = uuid().substring(0, 4)

    const mediatorConfig = getBaseConfig(`Connectionless proofs with mediator Mediator-${unique}`, {
      autoAcceptMediationRequests: true,
      endpoints: ['rxjs:mediator'],
    })

    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const mediatorMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:mediator': mediatorMessages,
    }

    // Initialize mediator
    const mediatorAgent = new Agent(mediatorConfig.config, mediatorConfig.agentDependencies)
    mediatorAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    mediatorAgent.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    await mediatorAgent.initialize()

    const faberMediationOutOfBandRecord = await mediatorAgent.oob.createInvitation({
      label: 'faber invitation',
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    const aliceMediationOutOfBandRecord = await mediatorAgent.oob.createInvitation({
      label: 'alice invitation',
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    const faberConfig = getBaseConfig(`Connectionless proofs with mediator Faber-${unique}`, {
      autoAcceptCredentials: AutoAcceptCredential.Always,
      autoAcceptProofs: AutoAcceptProof.Always,
      mediatorConnectionsInvite: faberMediationOutOfBandRecord.outOfBandInvitation.toUrl({
        domain: 'https://example.com',
      }),
      mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
    })

    const aliceConfig = getBaseConfig(`Connectionless proofs with mediator Alice-${unique}`, {
      autoAcceptCredentials: AutoAcceptCredential.Always,
      autoAcceptProofs: AutoAcceptProof.Always,
      // logger: new TestLogger(LogLevel.test),
      mediatorConnectionsInvite: aliceMediationOutOfBandRecord.outOfBandInvitation.toUrl({
        domain: 'https://example.com',
      }),
      mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
    })

    const faberAgent = new Agent(faberConfig.config, faberConfig.agentDependencies)
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    await faberAgent.initialize()

    const aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    await aliceAgent.initialize()

    agents = [aliceAgent, faberAgent, mediatorAgent]

    // const { definition } = await prepareForIssuance(faberAgent, ['name', 'age', 'image_0', 'image_1'])

    const [faberConnection, aliceConnection] = await makeConnection(faberAgent, aliceAgent)
    expect(faberConnection.isReady).toBe(true)
    expect(aliceConnection.isReady).toBe(true)

    const wallet: IndyWallet = faberAgent.injectionContainer.resolve(IndyWallet)

    await wallet.initPublicDid({})

    const pubDid = wallet.publicDid
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const key = Key.fromPublicKeyBase58(pubDid!.verkey, KeyType.Ed25519)
    const issuerDidKey: DidKey = new DidKey(key)

    const aliceWallet: IndyWallet = aliceAgent.injectionContainer.resolve(IndyWallet)

    await aliceWallet.initPublicDid({})

    const alicePubDid = aliceWallet.publicDid
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const aliceKey = Key.fromPublicKeyBase58(alicePubDid!.verkey, KeyType.Ed25519)
    const aliceDidKey: DidKey = new DidKey(aliceKey)

    const inputDoc = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/citizenship/v1',
        'https://w3id.org/security/bbs/v1',
      ],
      id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
      type: ['VerifiableCredential', 'PermanentResidentCard'],
      issuer: issuerDidKey.did,
      identifier: '83627465',
      name: 'Permanent Resident Card',
      description: 'Government of Example Permanent Resident Card.',
      issuanceDate: '2019-12-03T12:19:52Z',
      expirationDate: '2029-12-03T12:19:52Z',
      credentialSubject: {
        id: aliceDidKey.did,
        type: ['PermanentResident', 'Person'],
        givenName: 'JOHN',
        familyName: 'SMITH',
        gender: 'Male',
        image: 'data:image/png;base64,iVBORw0KGgokJggg==',
        residentSince: '2015-01-01',
        lprCategory: 'C09',
        lprNumber: '999-999-999',
        commuterClassification: 'C1',
        birthCountry: 'Bahamas',
        birthDate: '1958-07-17',
      },
    }

    const credential: W3cCredential = JsonTransformer.fromJSON(inputDoc, W3cCredential)

    const signCredentialOptions: SignCredentialOptions = {
      credential,
      proofType: 'Ed25519Signature2018',
      verificationMethod: issuerDidKey.keyId,
    }

    const issuerReplay = new ReplaySubject<CredentialStateChangedEvent>()
    const holderReplay = new ReplaySubject<CredentialStateChangedEvent>()

    faberAgent.events
      .observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
      .subscribe(issuerReplay)
    aliceAgent.events
      .observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
      .subscribe(holderReplay)

    const offerOptions: OfferCredentialOptions = {
      comment: 'some comment about credential',
      connectionId: faberConnection.id,
      protocolVersion: CredentialProtocolVersion.V2,
      credentialFormats: {
        jsonld: signCredentialOptions,
      },
    }
    let issuerCredentialRecord = await faberAgent.credentials.offerCredential(offerOptions)

    // Because we use auto-accept it can take a while to have the whole credential flow finished
    // Both parties need to interact with the ledger and sign/verify the credential
    await waitForCredentialRecordSubject(holderReplay, {
      threadId: issuerCredentialRecord.threadId,
      state: CredentialState.Done,
    })
    issuerCredentialRecord = await waitForCredentialRecordSubject(issuerReplay, {
      threadId: issuerCredentialRecord.threadId,
      state: CredentialState.Done,
    })

    const faberReplay = new ReplaySubject<ProofStateChangedEvent>()
    const aliceReplay = new ReplaySubject<ProofStateChangedEvent>()

    faberAgent.events.observable<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged).subscribe(faberReplay)
    aliceAgent.events.observable<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged).subscribe(aliceReplay)

    const inputDescriptors: InputDescriptors[] = [
      {
        id: 'citizenship_input',
        name: 'US Passport',
        group: ['A'],
        schema: [
          {
            uri: 'https://w3id.org/citizenship/v1',
          },
        ],
        constraints: {
          fields: [
            {
              path: ['$.credentialSubject.birth_date', '$.vc.credentialSubject.birth_date', '$.birth_date'],
              filter: {
                type: 'date',
                minimum: '1999-5-16',
              },
            },
          ],
        },
      },
    ]

    const presentationDefinition: PresentationDefinition = new PresentationDefinition({
      inputDescriptors,
      format: {
        ldpVc: {
          proofType: ['Ed25519Signature2018'],
        },
      },
    })

    const outOfBandRequestOptions: OutOfBandRequestOptions = {
      protocolVersion: ProofProtocolVersion.V2,
      proofFormats: {
        presentationExchange: {
          options: {
            challenge: 'e950bfe5-d7ec-4303-ad61-6983fb976ac9',
            domain: '',
          },
          presentationDefinition,
        },
      },
      autoAcceptProof: AutoAcceptProof.ContentApproved,
    }
    // eslint-disable-next-line prefer-const
    let { proofRecord: faberProofRecord, message } = await faberAgent.proofs.createOutOfBandRequest(
      outOfBandRequestOptions
    )

    const mediationRecord = await faberAgent.mediationRecipient.findDefaultMediator()
    if (!mediationRecord) {
      throw new Error('Faber agent has no default mediator')
    }

    expect(message).toMatchObject({
      service: {
        recipientKeys: [expect.any(String)],
        routingKeys: mediationRecord.routingKeys,
        serviceEndpoint: mediationRecord.endpoint,
      },
    })

    await aliceAgent.receiveMessage(message.toJSON())

    await waitForProofRecordSubject(aliceReplay, {
      threadId: faberProofRecord.threadId,
      state: ProofState.Done,
      timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
    })

    await waitForProofRecordSubject(faberReplay, {
      threadId: faberProofRecord.threadId,
      state: ProofState.Done,
      timeoutMs: 200000, // Temporary I have increased timeout as, verify presentation takes time to fetch the data from documentLoader
    })
  })
})
