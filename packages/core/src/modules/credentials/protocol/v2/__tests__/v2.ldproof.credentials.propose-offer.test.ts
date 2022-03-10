import type { DidCommMessageRepository } from '../../../../../../src/storage'
import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections'
import type { ServiceAcceptOfferOptions } from '../../../CredentialServiceOptions'
import type {
  AcceptOfferOptions,
  AcceptProposalOptions,
  AcceptRequestOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
} from '../../../interfaces'
import type { CredentialExchangeRecord } from '../../../repository/CredentialRecord'

import { AriesFrameworkError } from '../../../../../../src/error/AriesFrameworkError'
import { setupCredentialTests, waitForCredentialRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { Attachment, AttachmentData } from '../../../../../decorators/attachment/Attachment'
import { JsonTransformer } from '../../../../../utils'
import { LinkedAttachment } from '../../../../../utils/LinkedAttachment'
import { CredentialProtocolVersion } from '../../../CredentialProtocolVersion'
import { CredentialState } from '../../../CredentialState'
import { ProofType } from '../../../formats/models/CredentialFormatServiceOptions'
import { V1CredentialPreview } from '../../v1/V1CredentialPreview'
import { V1OfferCredentialMessage } from '../../v1/messages/V1OfferCredentialMessage'
import { V2CredentialPreview } from '../V2CredentialPreview'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'

describe('credentials', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: string
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let aliceCredentialRecord: CredentialExchangeRecord
  let faberCredentialRecord: CredentialExchangeRecord

  const TEST_DID_SOV = 'did:sov:LjgpST2rjsoxYegQDRm7EL'
  const TEST_DID_KEY = 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL'

  // const LD_PROOF_VC_DETAIL = {
  //   credential: {
  //     '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
  //     type: ['VerifiableCredential', 'UniversityDegreeCredential'],
  //     credentialSubject: { test: 'key' },
  //     issuanceDate: '2021-04-12',
  //     issuer: TEST_DID_KEY,
  //   },
  //   options: {
  //     proofType: 'Ed25519Signature2018',
  //     created: '2019-12-11T03:50:55',
  //   },
  // }
  let didCommMessageRepository: DidCommMessageRepository
  beforeAll(async () => {
    ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection } = await setupCredentialTests(
      'Faber Agent Credentials',
      'Alice Agent Credential'
    ))
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  // -------------------------- V2 TEST BEGIN --------------------------------------------

  test('Alice starts with V2 (ld format) credential proposal to Faber', async () => {
    const credentialPreview = V2CredentialPreview.fromRecord({
      name: 'John',
      age: '99',
    })

    testLogger.test('Alice sends (v2 jsonld) credential proposal to Faber')
    // set the propose options
    // we should set the version to V1.0 and V2.0 in separate tests, one as a regression test

    // this is the aca-py definition of ld proof object...

    const ldProofVcDetail = {
      credential: {
        '@context': 'https://www.w3.org/2018/',
        issuer: 'did:key:z6MkodKV3mnjQQMB9jhMZtKD9Sm75ajiYq51JDLuRSPZTXrr',
        type: ['VerifiableCredential', 'UniversityDegreeCredential'],
        issuanceDate: new Date('2020-01-01T19:23:24Z'),
        expirationDate: new Date('2021-01-01T19:23:24Z'),
        credentialSubject: {
          id: 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH',
          degree: {
            type: 'BachelorDegree',
            name: 'Bachelor of Science and Arts',
          },
        },
      },
      options: {
        proofPurpose: 'assertionMethod',
        created: new Date('2020-04-02T18:48:36Z'),
        domain: 'example.com',
        challenge: '9450a9c1-4db5-4ab9-bc0c-b7a9b2edac38',
        proofType: ProofType.Ed,
      },
    }

    const proposeOptions: ProposeCredentialOptions = {
      connectionId: aliceConnection.id,
      protocolVersion: CredentialProtocolVersion.V2,
      credentialFormats: {
        jsonld: ldProofVcDetail,
      },
      comment: 'v2 propose credential test',
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
    const faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
      threadId: credentialExchangeRecord.threadId,
      state: CredentialState.ProposalReceived,
    })

    const options: AcceptProposalOptions = {
      connectionId: faberConnection.id,
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Offer',
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: credDefId,
        },
      },
    }
    // testLogger.test('Faber sends credential offer to Alice')
    // await faberAgent.credentials.acceptCredentialProposal(options)

    // testLogger.test('Alice waits for credential offer from Faber')
    // aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
    //   threadId: faberCredentialRecord.threadId,
    //   state: CredentialState.OfferReceived,
    // })

    // didCommMessageRepository = faberAgent.injectionContainer.resolve<DidCommMessageRepository>(DidCommMessageRepository)

    // const offerMessage = await didCommMessageRepository.findAgentMessage({
    //   associatedRecordId: faberCredentialRecord.id,
    //   messageClass: V2OfferCredentialMessage,
    // })

    // expect(JsonTransformer.toJSON(offerMessage)).toMatchObject({
    //   '@type': 'https://didcomm.org/issue-credential/2.0/offer-credential',
    //   comment: 'V2 Indy Offer',
    //   credential_preview: {
    //     '@type': 'https://didcomm.org/issue-credential/2.0/credential-preview',
    //     attributes: [
    //       {
    //         name: 'name',
    //         'mime-type': 'text/plain',
    //         value: 'John',
    //       },
    //       {
    //         name: 'age',
    //         'mime-type': 'text/plain',
    //         value: '99',
    //       },
    //       {
    //         name: 'profile_picture',
    //         'mime-type': 'image/png',
    //         value: 'hl:zQmcKEWE6eZWpVqGKhbmhd8SxWBa9fgLX7aYW8RJzeHQMZg',
    //       },
    //     ],
    //   },
    // })
    // expect(aliceCredentialRecord.id).not.toBeNull()
    // expect(aliceCredentialRecord.getTags()).toEqual({
    //   threadId: faberCredentialRecord.threadId,
    //   connectionId: aliceCredentialRecord.connectionId,
    //   state: aliceCredentialRecord.state,
    // })
    // expect(aliceCredentialRecord.type).toBe(CredentialExchangeRecord.name)

    // if (aliceCredentialRecord.connectionId) {
    //   const acceptOfferOptions: ServiceAcceptOfferOptions = {
    //     credentialRecordId: aliceCredentialRecord.id,
    //     credentialFormats: {
    //       indy: undefined,
    //       w3c: undefined,
    //     },
    //   }
    //   const offerCredentialExchangeRecord: CredentialExchangeRecord =
    //     await aliceAgent.credentials.acceptCredentialOffer(acceptOfferOptions)

    //   expect(offerCredentialExchangeRecord.connectionId).toEqual(proposeOptions.connectionId)
    //   expect(offerCredentialExchangeRecord.protocolVersion).toEqual(CredentialProtocolVersion.V2)
    //   expect(offerCredentialExchangeRecord.state).toEqual(CredentialState.RequestSent)
    //   expect(offerCredentialExchangeRecord.threadId).not.toBeNull()

    //   testLogger.test('Faber waits for credential request from Alice')
    //   await waitForCredentialRecord(faberAgent, {
    //     threadId: aliceCredentialRecord.threadId,
    //     state: CredentialState.RequestReceived,
    //   })

    //   testLogger.test('Faber sends credential to Alice')

    //   const options: AcceptRequestOptions = {
    //     credentialRecordId: faberCredentialRecord.id,
    //     comment: 'V2 Indy Credential',
    //   }
    //   await faberAgent.credentials.acceptCredentialRequest(options)

    //   testLogger.test('Alice waits for credential from Faber')
    //   aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
    //     threadId: faberCredentialRecord.threadId,
    //     state: CredentialState.CredentialReceived,
    //   })

    //   // testLogger.test('Alice sends credential ack to Faber')
    //   await aliceAgent.credentials.acceptCredential(aliceCredentialRecord.id, CredentialProtocolVersion.V2)

    //   testLogger.test('Faber waits for credential ack from Alice')
    //   faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
    //     threadId: faberCredentialRecord.threadId,
    //     state: CredentialState.Done,
    //   })
    //   expect(aliceCredentialRecord).toMatchObject({
    //     type: CredentialExchangeRecord.name,
    //     id: expect.any(String),
    //     createdAt: expect.any(Date),
    //     threadId: expect.any(String),
    //     connectionId: expect.any(String),
    //     state: CredentialState.CredentialReceived,
    //   })
    // } else {
    //   throw new AriesFrameworkError('Missing Connection Id')
    // }
  })
})
// -------------------------- V2 TEST END --------------------------------------------
