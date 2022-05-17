import type { W3cVerifiableCredential } from '../../../../../../src/modules/vc/models'
import type { SignCredentialOptions } from '../../../../../../src/modules/vc/models/W3cCredentialServiceOptions'
import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections'
import type { ServiceAcceptOfferOptions } from '../../../CredentialServiceOptions'
import type {
  AcceptProposalOptions,
  AcceptRequestOptions,
  ProposeCredentialOptions,
} from '../../../CredentialsModuleOptions'

import { AnonymousSubject } from 'rxjs/internal/Subject'

import { DidKey } from '../../../../../../src/modules/dids'
import { IndyWallet } from '../../../../../../src/wallet/IndyWallet'
import { setupCredentialTests, waitForCredentialRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { KeyType } from '../../../../../crypto/KeyType'
import { DidCommMessageRepository } from '../../../../../storage'
import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { W3cCredential } from '../../../../vc/models/credential/W3cCredential'
import { CredentialProtocolVersion } from '../../../CredentialProtocolVersion'
import { CredentialState } from '../../../CredentialState'
import { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import { V2CredentialPreview } from '../V2CredentialPreview'
import { V2IssueCredentialMessage } from '../messages/V2IssueCredentialMessage'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'

let faberAgent: Agent
let aliceAgent: Agent
let aliceConnection: ConnectionRecord
let aliceCredentialRecord: CredentialExchangeRecord
let faberCredentialRecord: CredentialExchangeRecord
let wallet: IndyWallet
let issuerDidKey: DidKey
let didCommMessageRepository: DidCommMessageRepository
let credential: W3cCredential
let signCredentialOptions: SignCredentialOptions

describe('credentials, BBS+ signature', () => {
  const inputDoc = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/citizenship/v1',
      'https://w3id.org/security/bbs/v1',
    ],
    id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
    type: ['VerifiableCredential', 'PermanentResidentCard'],
    // issuer: issuerDidKey.did,
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
    proofType: 'BbsBlsSignature2020',
    verificationMethod: '',
  }

  beforeAll(async () => {
    ;({ faberAgent, aliceAgent, aliceConnection } = await setupCredentialTests(
      'Faber Agent Credentials LD BBS+',
      'Alice Agent Credentials LD BBS+'
    ))
    wallet = faberAgent.injectionContainer.resolve(IndyWallet)
    await wallet.initPublicDid({})
    const pubDid = wallet.publicDid

    const key = await wallet.createKey({ keyType: KeyType.Bls12381g2 })
    issuerDidKey = new DidKey(key)

    credential.issuer = issuerDidKey.did
    signCredentialOptions.verificationMethod = issuerDidKey.keyId
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Alice starts with V2 (ld format, BbsBlsSignature2020 signature) credential proposal to Faber', async () => {
    testLogger.test('Alice sends (v2 jsonld) credential proposal to Faber')
    // set the propose options

    const proposeOptions: ProposeCredentialOptions = {
      connectionId: aliceConnection.id,
      protocolVersion: CredentialProtocolVersion.V2,
      credentialFormats: {
        jsonld: signCredentialOptions,
      },
      comment: 'v2 propose credential test for W3C Credentials',
    }
    testLogger.test('Alice sends (v2, Indy) credential proposal to Faber')

    const credentialExchangeRecord: CredentialExchangeRecord = await aliceAgent.credentials.proposeCredential(
      proposeOptions
    )

    expect(credentialExchangeRecord.connectionId).toEqual(proposeOptions.connectionId)
    expect(credentialExchangeRecord.protocolVersion).toEqual(CredentialProtocolVersion.V2)
    expect(credentialExchangeRecord.state).toEqual(CredentialState.ProposalSent)
    expect(credentialExchangeRecord.threadId).not.toBeNull()

    testLogger.test('Faber waits for credential proposal from Alice')
    faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
      threadId: credentialExchangeRecord.threadId,
      state: CredentialState.ProposalReceived,
    })

    const options: AcceptProposalOptions = {
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V2 W3C Offer',
      credentialFormats: {
        jsonld: signCredentialOptions,
      },
      protocolVersion: CredentialProtocolVersion.V2,
    }
    testLogger.test('Faber sends credential offer to Alice')
    await faberAgent.credentials.acceptProposal(options)

    testLogger.test('Alice waits for credential offer from Faber')
    aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    didCommMessageRepository = faberAgent.injectionContainer.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    const offerMessage = await didCommMessageRepository.findAgentMessage({
      associatedRecordId: faberCredentialRecord.id,
      messageClass: V2OfferCredentialMessage,
    })

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

    if (aliceCredentialRecord.connectionId) {
      const acceptOfferOptions: ServiceAcceptOfferOptions = {
        credentialRecordId: aliceCredentialRecord.id,
        credentialFormats: {
          jsonld: undefined,
        },
      }
      const offerCredentialExchangeRecord: CredentialExchangeRecord = await aliceAgent.credentials.acceptOffer(
        acceptOfferOptions
      )

      expect(offerCredentialExchangeRecord.connectionId).toEqual(proposeOptions.connectionId)
      expect(offerCredentialExchangeRecord.protocolVersion).toEqual(CredentialProtocolVersion.V2)
      expect(offerCredentialExchangeRecord.state).toEqual(CredentialState.RequestSent)
      expect(offerCredentialExchangeRecord.threadId).not.toBeNull()

      testLogger.test('Faber waits for credential request from Alice')
      await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.RequestReceived,
      })

      testLogger.test('Faber sends credential to Alice')

      const options: AcceptRequestOptions = {
        credentialRecordId: faberCredentialRecord.id,
        comment: 'V2 Indy Credential',
      }
      await faberAgent.credentials.acceptRequest(options)

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Alice sends credential ack to Faber')
      await aliceAgent.credentials.acceptCredential(aliceCredentialRecord.id)

      testLogger.test('Faber waits for credential ack from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
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

      const credentialMessage = await didCommMessageRepository.findAgentMessage({
        associatedRecordId: faberCredentialRecord.id,
        messageClass: V2IssueCredentialMessage,
      })

      const data = credentialMessage?.messageAttachment[0].getDataAsJson<W3cVerifiableCredential>()

      expect(JsonTransformer.toJSON(credentialMessage)).toMatchObject({
        '@type': 'https://didcomm.org/issue-credential/2.0/issue-credential',
        '@id': expect.any(String),
        comment: 'V2 Indy Credential',
        formats: [
          {
            attach_id: expect.any(String),
            format: 'aries/ld-proof-vc@1.0',
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
    } else {
      throw new Error('Missing Connection Id')
    }
  })
})
