import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections'
import type { W3cCredential } from '../../../../vc/models/credential/W3cCredential'
import type { AcceptProposalOptions, ProposeCredentialOptions } from '../../../CredentialsModuleOptions'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'

import { DidCommMessageRepository } from '../../../../../../src/storage'
import { setupCredentialTests, waitForCredentialRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { CredentialProtocolVersion } from '../../../CredentialProtocolVersion'
import { CredentialState } from '../../../CredentialState'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'

describe('credentials', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: string
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let aliceCredentialRecord: CredentialExchangeRecord
  let faberCredentialRecord: CredentialExchangeRecord

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
    testLogger.test('Alice sends (v2 jsonld) credential proposal to Faber')
    // set the propose options

    const ldProofVcDetail: W3cCredential = {
      context: ['https://www.w3.org/2018/'],
      issuer: 'did:key:z6MkodKV3mnjQQMB9jhMZtKD9Sm75ajiYq51JDLuRSPZTXrr',
      type: ['VerifiableCredential', 'UniversityDegreeCredential'],
      issuanceDate: '2020-01-01T19:23:24Z',
      expirationDate: '2021-01-01T19:23:24Z',
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

    const proposeOptions: ProposeCredentialOptions = {
      connectionId: aliceConnection.id,
      protocolVersion: CredentialProtocolVersion.V2,
      credentialFormats: {
        jsonld: ldProofVcDetail,
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
      connectionId: faberConnection.id,
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V2 W3C Offer',
      credentialFormats: {
        jsonld: ldProofVcDetail,
      },
    }
    // testLogger.test('Faber sends credential offer to Alice')
    await faberAgent.credentials.acceptCredentialProposal(options)

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
