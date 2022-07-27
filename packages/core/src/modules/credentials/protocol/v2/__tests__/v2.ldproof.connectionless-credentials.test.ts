import type { SubjectMessage } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import type { DidKey } from '../../../../../../src/modules/dids'
import type { SignCredentialOptionsRFC0593 } from '../../../../../../src/modules/vc/models/W3cCredentialServiceOptions'
import type { Wallet } from '../../../../../wallet'
import type { CredentialStateChangedEvent } from '../../../CredentialEvents'
import type { AcceptRequestOptions, CreateOfferOptions } from '../../../CredentialsApiOptions'

import { ReplaySubject, Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../../../tests/transport/SubjectOutboundTransport'
import { JsonTransformer } from '../../../../../../src/utils'
import { getBaseConfig, prepareForIssuance, waitForCredentialRecordSubject } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { Agent } from '../../../../../agent/Agent'
import { InjectionSymbols } from '../../../../../constants'
import { Ed25519Signature2018Fixtures } from '../../../../../modules/vc/__tests__/fixtures'
import { W3cCredential } from '../../../../vc/models/'
import { CredentialEventTypes } from '../../../CredentialEvents'
import { CredentialState } from '../../../models'
import { CredentialExchangeRecord } from '../../../repository'

const faberConfig = getBaseConfig('Faber LD connection-less Credentials V2', {
  endpoints: ['rxjs:faber'],
})

const aliceConfig = getBaseConfig('Alice LD connection-less Credentials V2', {
  endpoints: ['rxjs:alice'],
})

let wallet
let credential: W3cCredential
let signCredentialOptions: SignCredentialOptionsRFC0593

describe('credentials', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let faberReplay: ReplaySubject<CredentialStateChangedEvent>
  let aliceReplay: ReplaySubject<CredentialStateChangedEvent>
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
    wallet = faberAgent.injectionContainer.resolve<Wallet>(InjectionSymbols.Wallet)
    await wallet.createDid({ seed })

    credential = JsonTransformer.fromJSON(Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT, W3cCredential)

    signCredentialOptions = {
      credential,
      options: {
        proofType: 'Ed25519Signature2018',
        proofPurpose: 'assertionMethod',
      },
    }
  })

  afterEach(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Faber starts with V2 W3C connection-less credential offer to Alice', async () => {
    const offerOptions: CreateOfferOptions = {
      comment: 'V2 Out of Band offer (W3C)',
      credentialFormats: {
        jsonld: signCredentialOptions,
      },
      protocolVersion: 'v2',
    }
    testLogger.test('Faber sends credential offer to Alice')

    // eslint-disable-next-line prefer-const
    let { message, credentialRecord: faberCredentialRecord } = await faberAgent.credentials.createOffer(offerOptions)

    const { message: offerMessage } = await faberAgent.oob.createLegacyConnectionlessInvitation({
      recordId: faberCredentialRecord.id,
      message,
      domain: 'https://a-domain.com',
    })
    await aliceAgent.receiveMessage(offerMessage.toJSON())

    let aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    testLogger.test('Alice sends credential request to Faber')

    const credentialRecord = await aliceAgent.credentials.acceptOffer({
      credentialRecordId: aliceCredentialRecord.id,
    })

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
    aliceCredentialRecord = await aliceAgent.credentials.acceptCredential({
      credentialRecordId: aliceCredentialRecord.id,
    })

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
