import type { SubjectMessage } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import type { SignCredentialOptions } from '../../../../../../src/modules/vc/models/W3cCredentialServiceOptions'
import type { CredentialStateChangedEvent } from '../../../CredentialEvents'
import type {
  AcceptOfferOptions,
  AcceptRequestOptions,
  OfferCredentialOptions,
} from '../../../CredentialsModuleOptions'

import { ReplaySubject, Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../../../tests/transport/SubjectOutboundTransport'
import { KeyType } from '../../../../../../src/crypto'
import { Key } from '../../../../../../src/crypto/Key'
import { DidKey } from '../../../../../../src/modules/dids'
import { JsonTransformer } from '../../../../../../src/utils'
import { IndyWallet } from '../../../../../../src/wallet/IndyWallet'
import { getBaseConfig, prepareForIssuance, waitForCredentialRecordSubject } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { Agent } from '../../../../../agent/Agent'
import { W3cCredential } from '../../../../vc/models/'
import { CredentialEventTypes } from '../../../CredentialEvents'
import { CredentialProtocolVersion } from '../../../CredentialProtocolVersion'
import { CredentialState } from '../../../CredentialState'
import { CredentialExchangeRecord } from '../../../repository'

const faberConfig = getBaseConfig('Faber LD connection-less Credentials V2', {
  endpoints: ['rxjs:faber'],
})

const aliceConfig = getBaseConfig('Alice LD connection-less Credentials V2', {
  endpoints: ['rxjs:alice'],
})

let wallet: IndyWallet
let credential: W3cCredential
let signCredentialOptions: SignCredentialOptions

describe('credentials', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let faberReplay: ReplaySubject<CredentialStateChangedEvent>
  let aliceReplay: ReplaySubject<CredentialStateChangedEvent>
  let issuerDidKey: DidKey
  const seed = 'testseed000000000000000000000001'

  beforeEach(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }
    faberAgent = new Agent(faberConfig.config, faberConfig.agentDependencies)
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()

    await prepareForIssuance(faberAgent, ['name', 'age'])

    faberReplay = new ReplaySubject<CredentialStateChangedEvent>()
    aliceReplay = new ReplaySubject<CredentialStateChangedEvent>()

    faberAgent.events
      .observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
      .subscribe(faberReplay)
    aliceAgent.events
      .observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
      .subscribe(aliceReplay)

    wallet = faberAgent.injectionContainer.resolve(IndyWallet)
    // await wallet.initPublicDid({})
    // const pubDid = wallet.publicDid
    // // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    // const key = Key.fromPublicKeyBase58(pubDid!.verkey, KeyType.Ed25519)
    // issuerDidKey = new DidKey(key)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const issuerDidInfo = await wallet.createDid({ seed })
    const issuerKey = Key.fromPublicKeyBase58(issuerDidInfo.verkey, KeyType.Ed25519)
    issuerDidKey = new DidKey(issuerKey)

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
        id: 'did:example:b34ca6cd37bbf23',
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

    credential = JsonTransformer.fromJSON(inputDoc, W3cCredential)

    signCredentialOptions = {
      credential,
      proofType: 'Ed25519Signature2018',
      verificationMethod: issuerDidKey.keyId,
    }
  })

  afterEach(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Faber starts with V2 W3C connection-less credential offer to Alice', async () => {
    testLogger.test('Faber sends credential offer to Alice')

    const offerOptions: OfferCredentialOptions = {
      comment: 'V2 Out of Band offer (W3C)',
      credentialFormats: {
        jsonld: signCredentialOptions,
      },
      protocolVersion: CredentialProtocolVersion.V2,
      connectionId: '',
    }
    // eslint-disable-next-line prefer-const
    let { message, credentialRecord: faberCredentialRecord } = await faberAgent.credentials.createOutOfBandOffer(
      offerOptions
    )

    await aliceAgent.receiveMessage(message.toJSON())

    let aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    testLogger.test('Alice sends credential request to Faber')
    const acceptOfferOptions: AcceptOfferOptions = {
      credentialRecordId: aliceCredentialRecord.id,
    }
    aliceCredentialRecord.protocolVersion = CredentialProtocolVersion.V2

    const credentialRecord = await aliceAgent.credentials.acceptOffer(acceptOfferOptions)

    testLogger.test('Faber waits for credential request from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: credentialRecord.threadId,
      state: CredentialState.RequestReceived,
    })

    testLogger.test('Faber sends credential to Alice')
    const options: AcceptRequestOptions = {
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Credential',
    }
    faberCredentialRecord = await faberAgent.credentials.acceptRequest(options)

    testLogger.test('Alice waits for credential from Faber')
    aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.CredentialReceived,
    })

    testLogger.test('Alice sends credential ack to Faber')
    aliceCredentialRecord = await aliceAgent.credentials.acceptCredential(aliceCredentialRecord.id)

    testLogger.test('Faber waits for credential ack from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.Done,
    })

    expect(aliceCredentialRecord).toMatchObject({
      type: CredentialExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      state: CredentialState.Done,
      threadId: expect.any(String),
    })

    expect(faberCredentialRecord).toMatchObject({
      type: CredentialExchangeRecord.type,
      id: expect.any(String),
      createdAt: expect.any(Date),
      state: CredentialState.Done,
      threadId: expect.any(String),
    })
  })
})
