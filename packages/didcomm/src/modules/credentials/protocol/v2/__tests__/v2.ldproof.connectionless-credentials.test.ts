import type { EventReplaySubject, JsonLdTestsAgent } from '../../../../../../../core/tests'
import type { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'

import { KeyType } from '../../../../../../../core/src/crypto'
import { CREDENTIALS_CONTEXT_V1_URL } from '../../../../../../../core/src/modules/vc/constants'
import { TypedArrayEncoder } from '../../../../../../../core/src/utils'
import { setupJsonLdTests, waitForCredentialRecordSubject } from '../../../../../../../core/tests'
import testLogger from '../../../../../../../core/tests/logger'
import { MessageReceiver } from '../../../../../MessageReceiver'
import { CredentialState } from '../../../models'
import { CredentialExchangeRecord } from '../../../repository'

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

describe('credentials', () => {
  let faberAgent: JsonLdTestsAgent
  let faberReplay: EventReplaySubject
  let aliceAgent: JsonLdTestsAgent
  let aliceReplay: EventReplaySubject

  beforeEach(async () => {
    ;({
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
    } = await setupJsonLdTests({
      issuerName: 'Faber LD connection-less Credentials V2',
      holderName: 'Alice LD connection-less Credentials V2',
      createConnections: false,
    }))

    await faberAgent.context.wallet.createKey({
      privateKey: TypedArrayEncoder.fromString('testseed000000000000000000000001'),
      keyType: KeyType.Ed25519,
    })
  })

  afterEach(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Faber starts with V2 W3C connection-less credential offer to Alice', async () => {
    testLogger.test('Faber sends credential offer to Alice')

    // eslint-disable-next-line prefer-const
    let { message, credentialRecord: faberCredentialRecord } = await faberAgent.modules.credentials.createOffer({
      comment: 'V2 Out of Band offer (W3C)',
      credentialFormats: {
        jsonld: signCredentialOptions,
      },
      protocolVersion: 'v2',
    })

    const offerMessage = message as V2OfferCredentialMessage
    const attachment = offerMessage?.offerAttachments[0]

    expect(attachment?.getDataAsJson()).toMatchObject({
      credential: {
        '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
        type: ['VerifiableCredential', 'UniversityDegreeCredential'],
        issuer: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
        issuanceDate: '2017-10-22T12:23:48Z',
        credentialSubject: {
          degree: {
            name: 'Bachelor of Science and Arts',
            type: 'BachelorDegree',
          },
        },
      },
      options: {
        proofType: 'Ed25519Signature2018',
        proofPurpose: 'assertionMethod',
      },
    })

    const { message: connectionlessOfferMessage } = await faberAgent.modules.oob.createLegacyConnectionlessInvitation({
      recordId: faberCredentialRecord.id,
      message,
      domain: 'https://a-domain.com',
    })
    await aliceAgent.context.dependencyManager
      .resolve(MessageReceiver)
      .receiveMessage(connectionlessOfferMessage.toJSON())

    let aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    testLogger.test('Alice sends credential request to Faber')

    const credentialRecord = await aliceAgent.modules.credentials.acceptOffer({
      credentialRecordId: aliceCredentialRecord.id,
    })

    testLogger.test('Faber waits for credential request from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: credentialRecord.threadId,
      state: CredentialState.RequestReceived,
    })

    testLogger.test('Faber sends credential to Alice')
    faberCredentialRecord = await faberAgent.modules.credentials.acceptRequest({
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Credential',
    })

    testLogger.test('Alice waits for credential from Faber')
    aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.CredentialReceived,
    })

    testLogger.test('Alice sends credential ack to Faber')
    aliceCredentialRecord = await aliceAgent.modules.credentials.acceptCredential({
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
