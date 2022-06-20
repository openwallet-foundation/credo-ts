import type { Agent } from '../../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../connections'
import type { CredentialStateChangedEvent } from '../../../CredentialEvents'
import type { IndyCredPropose } from '../../../formats/indy/models/IndyCredPropose'
import type { ReplaySubject } from 'rxjs'

import {
  issueCredential,
  setupCredentialTests,
  waitForCredentialRecord,
  waitForCredentialRecordSubject,
} from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { DidCommMessageRepository } from '../../../../../storage'
import { JsonTransformer } from '../../../../../utils'
import { IndyHolderService } from '../../../../indy/services/IndyHolderService'
import { CredentialState } from '../../../models/CredentialState'
import { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import { V2CredentialPreview } from '../messages/V2CredentialPreview'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'

const credentialPreview = V2CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
  'x-ray': 'some x-ray',
  profile_picture: 'profile picture',
})

describe('v2 credentials', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: string
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord
  let aliceCredentialRecord: CredentialExchangeRecord
  let faberCredentialRecord: CredentialExchangeRecord
  let faberReplay: ReplaySubject<CredentialStateChangedEvent>
  let aliceReplay: ReplaySubject<CredentialStateChangedEvent>

  let credPropose: IndyCredPropose

  const newCredentialPreview = V2CredentialPreview.fromRecord({
    name: 'John',
    age: '99',
    'x-ray': 'another x-ray value',
    profile_picture: 'another profile picture',
  })

  beforeAll(async () => {
    ;({ faberAgent, aliceAgent, credDefId, faberConnection, aliceConnection, faberReplay, aliceReplay } =
      await setupCredentialTests('Faber Agent Credentials v2', 'Alice Agent Credentials v2'))

    credPropose = {
      credentialDefinitionId: credDefId,
      schemaIssuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
      schemaName: 'ahoy',
      schemaVersion: '1.0',
      schemaId: 'q7ATwTYbQDgiigVijUAej:2:test:1.0',
      issuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
    }
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Alice starts with V2 credential proposal to Faber', async () => {
    testLogger.test('Alice sends (v2) credential proposal to Faber')

    const credentialExchangeRecord = await aliceAgent.credentials.proposeCredential({
      connectionId: aliceConnection.id,
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
      },
      comment: 'v2 propose credential test',
    })

    expect(credentialExchangeRecord).toMatchObject({
      connectionId: aliceConnection.id,
      protocolVersion: 'v2',
      state: CredentialState.ProposalSent,
      threadId: expect.any(String),
    })

    testLogger.test('Faber waits for credential proposal from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: credentialExchangeRecord.threadId,
      state: CredentialState.ProposalReceived,
    })

    testLogger.test('Faber sends credential offer to Alice')
    await faberAgent.credentials.acceptProposal({
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Proposal',
      credentialFormats: {
        indy: {
          credentialDefinitionId: credDefId,
          attributes: credentialPreview.attributes,
        },
      },
    })

    testLogger.test('Alice waits for credential offer from Faber')
    aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    const didCommMessageRepository = faberAgent.injectionContainer.resolve(DidCommMessageRepository)
    const offerMessage = await didCommMessageRepository.findAgentMessage({
      associatedRecordId: faberCredentialRecord.id,
      messageClass: V2OfferCredentialMessage,
    })

    expect(JsonTransformer.toJSON(offerMessage)).toMatchObject({
      '@id': expect.any(String),
      '@type': 'https://didcomm.org/issue-credential/2.0/offer-credential',
      comment: 'V2 Indy Proposal',
      credential_preview: {
        '@type': 'https://didcomm.org/issue-credential/2.0/credential-preview',
        attributes: [
          {
            name: 'name',
            'mime-type': 'text/plain',
            value: 'John',
          },
          {
            name: 'age',
            'mime-type': 'text/plain',
            value: '99',
          },
          {
            name: 'x-ray',
            'mime-type': 'text/plain',
            value: 'some x-ray',
          },
          {
            name: 'profile_picture',
            'mime-type': 'text/plain',
            value: 'profile picture',
          },
        ],
      },
      'offers~attach': expect.any(Array),
    })

    expect(aliceCredentialRecord).toMatchObject({
      id: expect.any(String),
      connectionId: expect.any(String),
      type: CredentialExchangeRecord.type,
    })

    // below values are not in json object
    expect(aliceCredentialRecord.getTags()).toEqual({
      threadId: faberCredentialRecord.threadId,
      connectionId: aliceCredentialRecord.connectionId,
      state: aliceCredentialRecord.state,
      credentialIds: [],
    })

    const offerCredentialExchangeRecord = await aliceAgent.credentials.acceptOffer({
      credentialRecordId: aliceCredentialRecord.id,
    })

    expect(offerCredentialExchangeRecord).toMatchObject({
      connectionId: aliceConnection.id,
      protocolVersion: 'v2',
      state: CredentialState.RequestSent,
      threadId: expect.any(String),
    })

    testLogger.test('Faber waits for credential request from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
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

    await aliceAgent.credentials.acceptCredential({
      credentialRecordId: aliceCredentialRecord.id,
    })

    testLogger.test('Faber waits for state done')
    await waitForCredentialRecordSubject(faberReplay, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.Done,
    })
  })

  test('Faber issues credential which is then deleted from Alice`s wallet', async () => {
    const { holderCredential } = await issueCredential({
      issuerAgent: faberAgent,
      issuerConnectionId: faberConnection.id,
      holderAgent: aliceAgent,
      credentialTemplate: {
        credentialDefinitionId: credDefId,
        attributes: credentialPreview.attributes,
      },
    })

    // test that delete credential removes from both repository and wallet
    // latter is tested by spying on holder service (Indy) to
    // see if deleteCredential is called
    const holderService = aliceAgent.injectionContainer.resolve(IndyHolderService)

    const deleteCredentialSpy = jest.spyOn(holderService, 'deleteCredential')
    await aliceAgent.credentials.deleteById(holderCredential.id, {
      deleteAssociatedCredentials: true,
      deleteAssociatedDidCommMessages: true,
    })
    expect(deleteCredentialSpy).toHaveBeenNthCalledWith(1, holderCredential.credentials[0].credentialRecordId)

    return expect(aliceAgent.credentials.getById(holderCredential.id)).rejects.toThrowError(
      `CredentialRecord: record with id ${holderCredential.id} not found.`
    )
  })

  test('Alice starts with proposal, faber sends a counter offer, alice sends second proposal, faber sends second offer', async () => {
    // proposeCredential -> negotiateProposal -> negotiateOffer -> negotiateProposal -> acceptOffer -> acceptRequest -> DONE (credential issued)

    let faberCredentialRecordPromise = waitForCredentialRecord(faberAgent, {
      state: CredentialState.ProposalReceived,
    })

    testLogger.test('Alice sends credential proposal to Faber')
    let aliceCredentialExchangeRecord = await aliceAgent.credentials.proposeCredential({
      connectionId: aliceConnection.id,
      protocolVersion: 'v2',
      credentialFormats: {
        indy: {
          ...credPropose,
          attributes: credentialPreview.attributes,
        },
      },
      comment: 'v2 propose credential test',
    })
    expect(aliceCredentialExchangeRecord.state).toBe(CredentialState.ProposalSent)

    testLogger.test('Faber waits for credential proposal from Alice')
    let faberCredentialRecord = await faberCredentialRecordPromise

    let aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    faberCredentialRecord = await faberAgent.credentials.negotiateProposal({
      credentialRecordId: faberCredentialRecord.id,
      credentialFormats: {
        indy: {
          credentialDefinitionId: credDefId,
          attributes: newCredentialPreview.attributes,
        },
      },
    })

    testLogger.test('Alice waits for credential offer from Faber')
    let aliceCredentialRecord = await aliceCredentialRecordPromise

    // Check if the state of the credential records did not change
    faberCredentialRecord = await faberAgent.credentials.getById(faberCredentialRecord.id)
    faberCredentialRecord.assertState(CredentialState.OfferSent)

    aliceCredentialRecord = await aliceAgent.credentials.getById(aliceCredentialRecord.id)
    aliceCredentialRecord.assertState(CredentialState.OfferReceived)

    faberCredentialRecordPromise = waitForCredentialRecord(faberAgent, {
      threadId: aliceCredentialExchangeRecord.threadId,
      state: CredentialState.ProposalReceived,
    })

    // second proposal
    aliceCredentialExchangeRecord = await aliceAgent.credentials.negotiateOffer({
      credentialRecordId: aliceCredentialRecord.id,
      credentialFormats: {
        indy: {
          ...credPropose,
          attributes: newCredentialPreview.attributes,
        },
      },
    })

    expect(aliceCredentialExchangeRecord.state).toBe(CredentialState.ProposalSent)

    testLogger.test('Faber waits for credential proposal from Alice')
    faberCredentialRecord = await faberCredentialRecordPromise

    aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    faberCredentialRecord = await faberAgent.credentials.negotiateProposal({
      credentialRecordId: faberCredentialRecord.id,
      credentialFormats: {
        indy: {
          credentialDefinitionId: credDefId,
          attributes: newCredentialPreview.attributes,
        },
      },
    })

    testLogger.test('Alice waits for credential offer from Faber')

    aliceCredentialRecord = await aliceCredentialRecordPromise

    const offerCredentialExchangeRecord = await aliceAgent.credentials.acceptOffer({
      credentialRecordId: aliceCredentialExchangeRecord.id,
    })

    expect(offerCredentialExchangeRecord).toMatchObject({
      connectionId: aliceConnection.id,
      state: CredentialState.RequestSent,
      protocolVersion: 'v2',
      threadId: aliceCredentialExchangeRecord.threadId,
    })

    testLogger.test('Faber waits for credential request from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: aliceCredentialExchangeRecord.threadId,
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
  })

  test('Faber starts with offer, alice sends counter proposal, faber sends second offer, alice sends second proposal', async () => {
    let aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
      state: CredentialState.OfferReceived,
    })

    testLogger.test('Faber sends credential offer to Alice')
    let faberCredentialRecord = await faberAgent.credentials.offerCredential({
      comment: 'some comment about credential',
      connectionId: faberConnection.id,
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: credDefId,
        },
      },
      protocolVersion: 'v2',
    })

    testLogger.test('Alice waits for credential offer from Faber')
    aliceCredentialRecord = await aliceCredentialRecordPromise

    let faberCredentialRecordPromise = waitForCredentialRecord(faberAgent, {
      threadId: aliceCredentialRecord.threadId,
      state: CredentialState.ProposalReceived,
    })

    aliceCredentialRecord = await aliceAgent.credentials.negotiateOffer({
      credentialRecordId: aliceCredentialRecord.id,
      credentialFormats: {
        indy: {
          ...credPropose,
          attributes: newCredentialPreview.attributes,
        },
      },
    })

    expect(aliceCredentialRecord.state).toBe(CredentialState.ProposalSent)

    testLogger.test('Faber waits for credential proposal from Alice')
    faberCredentialRecord = await faberCredentialRecordPromise

    aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    faberCredentialRecord = await faberAgent.credentials.negotiateProposal({
      credentialRecordId: faberCredentialRecord.id,
      credentialFormats: {
        indy: {
          credentialDefinitionId: credDefId,
          attributes: newCredentialPreview.attributes,
        },
      },
    })

    testLogger.test('Alice waits for credential offer from Faber')

    aliceCredentialRecord = await aliceCredentialRecordPromise

    faberCredentialRecordPromise = waitForCredentialRecord(faberAgent, {
      threadId: aliceCredentialRecord.threadId,
      state: CredentialState.ProposalReceived,
    })

    aliceCredentialRecord = await aliceAgent.credentials.negotiateOffer({
      credentialRecordId: aliceCredentialRecord.id,
      credentialFormats: {
        indy: {
          ...credPropose,
          attributes: newCredentialPreview.attributes,
        },
      },
    })

    expect(aliceCredentialRecord.state).toBe(CredentialState.ProposalSent)

    testLogger.test('Faber waits for credential proposal from Alice')
    faberCredentialRecord = await faberCredentialRecordPromise

    aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    testLogger.test('Faber sends credential offer to Alice')
    await faberAgent.credentials.acceptProposal({
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Proposal',
      credentialFormats: {
        indy: {
          credentialDefinitionId: credDefId,
          attributes: credentialPreview.attributes,
        },
      },
    })

    testLogger.test('Alice waits for credential offer from Faber')
    aliceCredentialRecord = await aliceCredentialRecordPromise

    faberCredentialRecordPromise = waitForCredentialRecord(faberAgent, {
      threadId: aliceCredentialRecord.threadId,
      state: CredentialState.RequestReceived,
    })

    const offerCredentialExchangeRecord = await aliceAgent.credentials.acceptOffer({
      credentialRecordId: aliceCredentialRecord.id,
    })

    expect(offerCredentialExchangeRecord).toMatchObject({
      connectionId: aliceConnection.id,
      state: CredentialState.RequestSent,
      protocolVersion: 'v2',
    })

    testLogger.test('Faber waits for credential request from Alice')
    faberCredentialRecord = await faberCredentialRecordPromise

    aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.CredentialReceived,
    })

    testLogger.test('Faber sends credential to Alice')
    await faberAgent.credentials.acceptRequest({
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Credential',
    })

    testLogger.test('Alice waits for credential from Faber')
    aliceCredentialRecord = await aliceCredentialRecordPromise

    const formatData = await aliceAgent.credentials.getFormatData(aliceCredentialRecord.id)

    expect(formatData).toMatchObject({
      proposalAttributes: [
        {
          name: 'name',
          mimeType: 'text/plain',
          value: 'John',
        },
        {
          name: 'age',
          mimeType: 'text/plain',
          value: '99',
        },
        {
          name: 'x-ray',
          mimeType: 'text/plain',
          value: 'another x-ray value',
        },
        {
          name: 'profile_picture',
          mimeType: 'text/plain',
          value: 'another profile picture',
        },
      ],
      proposal: {
        indy: {
          schema_issuer_did: expect.any(String),
          schema_id: expect.any(String),
          schema_name: expect.any(String),
          schema_version: expect.any(String),
          cred_def_id: expect.any(String),
          issuer_did: expect.any(String),
        },
      },
      offer: {
        indy: {
          schema_id: expect.any(String),
          cred_def_id: expect.any(String),
          key_correctness_proof: expect.any(Object),
          nonce: expect.any(String),
        },
      },
      offerAttributes: [
        {
          name: 'name',
          mimeType: 'text/plain',
          value: 'John',
        },
        {
          name: 'age',
          mimeType: 'text/plain',
          value: '99',
        },
        {
          name: 'x-ray',
          mimeType: 'text/plain',
          value: 'some x-ray',
        },
        {
          name: 'profile_picture',
          mimeType: 'text/plain',
          value: 'profile picture',
        },
      ],
      request: {
        indy: {
          prover_did: expect.any(String),
          cred_def_id: expect.any(String),
          blinded_ms: expect.any(Object),
          blinded_ms_correctness_proof: expect.any(Object),
          nonce: expect.any(String),
        },
      },
      credential: {
        indy: {
          schema_id: expect.any(String),
          cred_def_id: expect.any(String),
          rev_reg_id: null,
          values: {
            age: { raw: '99', encoded: '99' },
            profile_picture: {
              raw: 'profile picture',
              encoded: '28661874965215723474150257281172102867522547934697168414362313592277831163345',
            },
            name: {
              raw: 'John',
              encoded: '76355713903561865866741292988746191972523015098789458240077478826513114743258',
            },
            'x-ray': {
              raw: 'some x-ray',
              encoded: '43715611391396952879378357808399363551139229809726238083934532929974486114650',
            },
          },
          signature: expect.any(Object),
          signature_correctness_proof: expect.any(Object),
          rev_reg: null,
          witness: null,
        },
      },
    })
  })

  test('Faber starts with V2 offer, alice declines the offer', async () => {
    testLogger.test('Faber sends credential offer to Alice')
    const faberCredentialExchangeRecord = await faberAgent.credentials.offerCredential({
      comment: 'some comment about credential',
      connectionId: faberConnection.id,
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: credDefId,
        },
      },
      protocolVersion: 'v2',
    })

    testLogger.test('Alice waits for credential offer from Faber')
    aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialExchangeRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    expect(aliceCredentialRecord).toMatchObject({
      id: expect.any(String),
      type: CredentialExchangeRecord.type,
    })

    testLogger.test('Alice declines offer')
    aliceCredentialRecord = await aliceAgent.credentials.declineOffer(aliceCredentialRecord.id)

    expect(aliceCredentialRecord.state).toBe(CredentialState.Declined)
  })
})
