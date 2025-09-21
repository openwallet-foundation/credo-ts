import type { EventReplaySubject } from '@credo-ts/core/tests'
import type { AnonCredsHolderService } from '../../../../../../../anoncreds/src'
import type { LegacyIndyProposeCredentialFormat } from '../../../../../../../anoncreds/src/formats/LegacyIndyCredentialFormat'
import type { AnonCredsTestsAgent } from '../../../../../../../anoncreds/tests/legacyAnonCredsSetup'

import { JsonTransformer } from '@credo-ts/core/src/utils'
import { waitForCredentialRecord, waitForCredentialRecordSubject } from '@credo-ts/core/tests'
import testLogger from '@credo-ts/core/tests/logger'
import { AnonCredsHolderServiceSymbol } from '../../../../../../../anoncreds/src'
import {
  issueLegacyAnonCredsCredential,
  setupAnonCredsTests,
} from '../../../../../../../anoncreds/tests/legacyAnonCredsSetup'
import { DidCommMessageRepository } from '../../../../../repository'
import { DidCommCredentialRole } from '../../../models'
import { DidCommCredentialState } from '../../../models/DidCommCredentialState'
import { DidCommCredentialExchangeRecord } from '../../../repository/DidCommCredentialExchangeRecord'
import {
  DidCommCredentialV2Preview,
  DidCommIssueCredentialV2Message,
  DidCommOfferCredentialV2Message,
  DidCommProposeCredentialV2Message,
  DidCommRequestCredentialV2Message,
} from '../messages'

const credentialPreview = DidCommCredentialV2Preview.fromRecord({
  name: 'John',
  age: '99',
  'x-ray': 'some x-ray',
  profile_picture: 'profile picture',
})

describe('v2 credentials', () => {
  let faberAgent: AnonCredsTestsAgent
  let aliceAgent: AnonCredsTestsAgent
  let credentialDefinitionId: string
  let faberConnectionId: string
  let aliceConnectionId: string
  let teardown: () => Promise<void>

  let faberReplay: EventReplaySubject
  let aliceReplay: EventReplaySubject

  let indyCredentialProposal: LegacyIndyProposeCredentialFormat

  const newCredentialPreview = DidCommCredentialV2Preview.fromRecord({
    name: 'John',
    age: '99',
    'x-ray': 'another x-ray value',
    profile_picture: 'another profile picture',
  })

  beforeAll(async () => {
    ;({
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      credentialDefinitionId,
      issuerHolderConnectionId: faberConnectionId,
      holderIssuerConnectionId: aliceConnectionId,
      teardown,
    } = await setupAnonCredsTests({
      issuerName: 'Faber Agent Credentials v2',
      holderName: 'Alice Agent Credentials v2',
      attributeNames: ['name', 'age', 'x-ray', 'profile_picture'],
      useDrizzleStorage: 'postgres',
    }))

    indyCredentialProposal = {
      credentialDefinitionId: credentialDefinitionId,
      schemaIssuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
      schemaName: 'ahoy',
      schemaVersion: '1.0',
      schemaId: 'q7ATwTYbQDgiigVijUAej:2:test:1.0',
      issuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
    }
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
    await teardown()
  })

  test('Alice starts with V2 credential proposal to Faber', async () => {
    testLogger.test('Alice sends (v2) credential proposal to Faber')

    const credentialExchangeRecord = await aliceAgent.modules.credentials.proposeCredential({
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
      },
      comment: 'v2 propose credential test',
    })

    expect(credentialExchangeRecord).toMatchObject({
      connectionId: aliceConnectionId,
      protocolVersion: 'v2',
      state: DidCommCredentialState.ProposalSent,
      threadId: expect.any(String),
    })

    testLogger.test('Faber waits for credential proposal from Alice')
    let faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: credentialExchangeRecord.threadId,
      state: DidCommCredentialState.ProposalReceived,
    })

    testLogger.test('Faber sends credential offer to Alice')
    await faberAgent.modules.credentials.acceptProposal({
      credentialExchangeRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Proposal',
      credentialFormats: {
        indy: {
          credentialDefinitionId: credentialDefinitionId,
          attributes: credentialPreview.attributes,
        },
      },
    })

    testLogger.test('Alice waits for credential offer from Faber')
    let aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.OfferReceived,
    })

    const didCommMessageRepository = faberAgent.dependencyManager.resolve(DidCommMessageRepository)
    const offerMessage = await didCommMessageRepository.findAgentMessage(faberAgent.context, {
      associatedRecordId: faberCredentialRecord.id,
      messageClass: DidCommOfferCredentialV2Message,
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
      type: DidCommCredentialExchangeRecord.type,
    })

    // below values are not in json object
    expect(aliceCredentialRecord.getTags()).toEqual({
      role: DidCommCredentialRole.Holder,
      parentThreadId: undefined,
      threadId: faberCredentialRecord.threadId,
      connectionId: aliceCredentialRecord.connectionId,
      state: aliceCredentialRecord.state,
      credentialIds: [],
    })

    const offerCredentialExchangeRecord = await aliceAgent.modules.credentials.acceptOffer({
      credentialExchangeRecordId: aliceCredentialRecord.id,
    })

    expect(offerCredentialExchangeRecord).toMatchObject({
      connectionId: aliceConnectionId,
      protocolVersion: 'v2',
      state: DidCommCredentialState.RequestSent,
      threadId: expect.any(String),
    })

    testLogger.test('Faber waits for credential request from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: aliceCredentialRecord.threadId,
      state: DidCommCredentialState.RequestReceived,
    })

    testLogger.test('Faber sends credential to Alice')
    await faberAgent.modules.credentials.acceptRequest({
      credentialExchangeRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Credential',
    })

    testLogger.test('Alice waits for credential from Faber')
    aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.CredentialReceived,
    })

    await aliceAgent.modules.credentials.acceptCredential({
      credentialExchangeRecordId: aliceCredentialRecord.id,
    })

    testLogger.test('Faber waits for state done')
    await waitForCredentialRecordSubject(faberReplay, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.Done,
    })
  })

  test('Faber issues credential which is then deleted from Alice`s wallet', async () => {
    const { holderCredentialExchangeRecord } = await issueLegacyAnonCredsCredential({
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      issuerHolderConnectionId: faberConnectionId,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      offer: {
        credentialDefinitionId: credentialDefinitionId,
        attributes: credentialPreview.attributes,
      },
    })

    // test that delete credential removes from both repository and wallet
    // latter is tested by spying on holder service to
    // see if deleteCredential is called
    const holderService = aliceAgent.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    const deleteCredentialSpy = jest.spyOn(holderService, 'deleteCredential')
    await aliceAgent.modules.credentials.deleteById(holderCredentialExchangeRecord.id, {
      deleteAssociatedCredentials: true,
      deleteAssociatedDidCommMessages: true,
    })
    expect(deleteCredentialSpy).toHaveBeenNthCalledWith(
      1,
      aliceAgent.context,
      holderCredentialExchangeRecord.credentials[0].credentialRecordId
    )

    return expect(aliceAgent.modules.credentials.getById(holderCredentialExchangeRecord.id)).rejects.toThrow(
      `CredentialRecord: record with id ${holderCredentialExchangeRecord.id} not found.`
    )
  })

  test('Alice starts with proposal, faber sends a counter offer, alice sends second proposal, faber sends second offer', async () => {
    // proposeCredential -> negotiateProposal -> negotiateOffer -> negotiateProposal -> acceptOffer -> acceptRequest -> DONE (credential issued)

    let faberCredentialRecordPromise = waitForCredentialRecord(faberAgent, {
      state: DidCommCredentialState.ProposalReceived,
    })

    testLogger.test('Alice sends credential proposal to Faber')
    let aliceCredentialExchangeRecord = await aliceAgent.modules.credentials.proposeCredential({
      connectionId: aliceConnectionId,
      protocolVersion: 'v2',
      credentialFormats: {
        indy: {
          ...indyCredentialProposal,
          attributes: credentialPreview.attributes,
        },
      },
      comment: 'v2 propose credential test',
    })
    expect(aliceCredentialExchangeRecord.state).toBe(DidCommCredentialState.ProposalSent)

    testLogger.test('Faber waits for credential proposal from Alice')
    let faberCredentialRecord = await faberCredentialRecordPromise

    let aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.OfferReceived,
    })

    faberCredentialRecord = await faberAgent.modules.credentials.negotiateProposal({
      credentialExchangeRecordId: faberCredentialRecord.id,
      credentialFormats: {
        indy: {
          credentialDefinitionId: credentialDefinitionId,
          attributes: newCredentialPreview.attributes,
        },
      },
    })

    testLogger.test('Alice waits for credential offer from Faber')
    let aliceCredentialRecord = await aliceCredentialRecordPromise

    // Check if the state of the credential records did not change
    faberCredentialRecord = await faberAgent.modules.credentials.getById(faberCredentialRecord.id)
    faberCredentialRecord.assertState(DidCommCredentialState.OfferSent)

    aliceCredentialRecord = await aliceAgent.modules.credentials.getById(aliceCredentialRecord.id)
    aliceCredentialRecord.assertState(DidCommCredentialState.OfferReceived)

    faberCredentialRecordPromise = waitForCredentialRecord(faberAgent, {
      threadId: aliceCredentialExchangeRecord.threadId,
      state: DidCommCredentialState.ProposalReceived,
    })

    // second proposal
    aliceCredentialExchangeRecord = await aliceAgent.modules.credentials.negotiateOffer({
      credentialExchangeRecordId: aliceCredentialRecord.id,
      credentialFormats: {
        indy: {
          ...indyCredentialProposal,
          attributes: newCredentialPreview.attributes,
        },
      },
    })

    expect(aliceCredentialExchangeRecord.state).toBe(DidCommCredentialState.ProposalSent)

    testLogger.test('Faber waits for credential proposal from Alice')
    faberCredentialRecord = await faberCredentialRecordPromise

    aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.OfferReceived,
    })

    faberCredentialRecord = await faberAgent.modules.credentials.negotiateProposal({
      credentialExchangeRecordId: faberCredentialRecord.id,
      credentialFormats: {
        indy: {
          credentialDefinitionId: credentialDefinitionId,
          attributes: newCredentialPreview.attributes,
        },
      },
    })

    testLogger.test('Alice waits for credential offer from Faber')

    aliceCredentialRecord = await aliceCredentialRecordPromise

    const offerCredentialExchangeRecord = await aliceAgent.modules.credentials.acceptOffer({
      credentialExchangeRecordId: aliceCredentialExchangeRecord.id,
    })

    expect(offerCredentialExchangeRecord).toMatchObject({
      connectionId: aliceConnectionId,
      state: DidCommCredentialState.RequestSent,
      protocolVersion: 'v2',
      threadId: aliceCredentialExchangeRecord.threadId,
    })

    testLogger.test('Faber waits for credential request from Alice')
    faberCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: aliceCredentialExchangeRecord.threadId,
      state: DidCommCredentialState.RequestReceived,
    })
    testLogger.test('Faber sends credential to Alice')

    await faberAgent.modules.credentials.acceptRequest({
      credentialExchangeRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Credential',
    })

    testLogger.test('Alice waits for credential from Faber')
    aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.CredentialReceived,
    })

    // testLogger.test('Alice sends credential ack to Faber')
    await aliceAgent.modules.credentials.acceptCredential({ credentialExchangeRecordId: aliceCredentialRecord.id })

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
  })

  test('Faber starts with offer, alice sends counter proposal, faber sends second offer, alice sends second proposal', async () => {
    let aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
      state: DidCommCredentialState.OfferReceived,
    })

    testLogger.test('Faber sends credential offer to Alice')
    let faberCredentialRecord = await faberAgent.modules.credentials.offerCredential({
      comment: 'some comment about credential',
      connectionId: faberConnectionId,
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: credentialDefinitionId,
        },
      },
      protocolVersion: 'v2',
    })

    testLogger.test('Alice waits for credential offer from Faber')
    let aliceCredentialRecord = await aliceCredentialRecordPromise

    let faberCredentialRecordPromise = waitForCredentialRecord(faberAgent, {
      threadId: aliceCredentialRecord.threadId,
      state: DidCommCredentialState.ProposalReceived,
    })

    aliceCredentialRecord = await aliceAgent.modules.credentials.negotiateOffer({
      credentialExchangeRecordId: aliceCredentialRecord.id,
      credentialFormats: {
        indy: {
          ...indyCredentialProposal,
          attributes: newCredentialPreview.attributes,
        },
      },
    })

    expect(aliceCredentialRecord.state).toBe(DidCommCredentialState.ProposalSent)

    testLogger.test('Faber waits for credential proposal from Alice')
    faberCredentialRecord = await faberCredentialRecordPromise

    aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.OfferReceived,
    })
    faberCredentialRecord = await faberAgent.modules.credentials.negotiateProposal({
      credentialExchangeRecordId: faberCredentialRecord.id,
      credentialFormats: {
        indy: {
          credentialDefinitionId: credentialDefinitionId,
          attributes: newCredentialPreview.attributes,
        },
      },
    })

    testLogger.test('Alice waits for credential offer from Faber')

    aliceCredentialRecord = await aliceCredentialRecordPromise

    faberCredentialRecordPromise = waitForCredentialRecord(faberAgent, {
      threadId: aliceCredentialRecord.threadId,
      state: DidCommCredentialState.ProposalReceived,
    })

    aliceCredentialRecord = await aliceAgent.modules.credentials.negotiateOffer({
      credentialExchangeRecordId: aliceCredentialRecord.id,
      credentialFormats: {
        indy: {
          ...indyCredentialProposal,
          attributes: newCredentialPreview.attributes,
        },
      },
    })

    expect(aliceCredentialRecord.state).toBe(DidCommCredentialState.ProposalSent)

    testLogger.test('Faber waits for credential proposal from Alice')
    faberCredentialRecord = await faberCredentialRecordPromise

    aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.OfferReceived,
    })

    testLogger.test('Faber sends credential offer to Alice')
    await faberAgent.modules.credentials.acceptProposal({
      credentialExchangeRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Proposal',
      credentialFormats: {
        indy: {
          credentialDefinitionId: credentialDefinitionId,
          attributes: credentialPreview.attributes,
        },
      },
    })

    testLogger.test('Alice waits for credential offer from Faber')
    aliceCredentialRecord = await aliceCredentialRecordPromise

    faberCredentialRecordPromise = waitForCredentialRecord(faberAgent, {
      threadId: aliceCredentialRecord.threadId,
      state: DidCommCredentialState.RequestReceived,
    })

    const offerCredentialExchangeRecord = await aliceAgent.modules.credentials.acceptOffer({
      credentialExchangeRecordId: aliceCredentialRecord.id,
    })

    expect(offerCredentialExchangeRecord).toMatchObject({
      connectionId: aliceConnectionId,
      state: DidCommCredentialState.RequestSent,
      protocolVersion: 'v2',
    })

    testLogger.test('Faber waits for credential request from Alice')
    faberCredentialRecord = await faberCredentialRecordPromise

    aliceCredentialRecordPromise = waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.CredentialReceived,
    })

    testLogger.test('Faber sends credential to Alice')
    await faberAgent.modules.credentials.acceptRequest({
      credentialExchangeRecordId: faberCredentialRecord.id,
      comment: 'V2 Indy Credential',
    })

    testLogger.test('Alice waits for credential from Faber')
    aliceCredentialRecord = await aliceCredentialRecordPromise

    const proposalMessage = await aliceAgent.modules.credentials.findProposalMessage(aliceCredentialRecord.id)
    const offerMessage = await aliceAgent.modules.credentials.findOfferMessage(aliceCredentialRecord.id)
    const requestMessage = await aliceAgent.modules.credentials.findRequestMessage(aliceCredentialRecord.id)
    const credentialMessage = await aliceAgent.modules.credentials.findCredentialMessage(aliceCredentialRecord.id)

    expect(proposalMessage).toBeInstanceOf(DidCommProposeCredentialV2Message)
    expect(offerMessage).toBeInstanceOf(DidCommOfferCredentialV2Message)
    expect(requestMessage).toBeInstanceOf(DidCommRequestCredentialV2Message)
    expect(credentialMessage).toBeInstanceOf(DidCommIssueCredentialV2Message)

    const formatData = await aliceAgent.modules.credentials.getFormatData(aliceCredentialRecord.id)
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
    const faberCredentialExchangeRecord = await faberAgent.modules.credentials.offerCredential({
      comment: 'some comment about credential',
      connectionId: faberConnectionId,
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: credentialDefinitionId,
        },
      },
      protocolVersion: 'v2',
    })

    testLogger.test('Alice waits for credential offer from Faber')
    let aliceCredentialRecord = await waitForCredentialRecordSubject(aliceReplay, {
      threadId: faberCredentialExchangeRecord.threadId,
      state: DidCommCredentialState.OfferReceived,
    })

    expect(aliceCredentialRecord).toMatchObject({
      id: expect.any(String),
      type: DidCommCredentialExchangeRecord.type,
    })

    testLogger.test('Alice declines offer')
    aliceCredentialRecord = await aliceAgent.modules.credentials.declineOffer({
      credentialExchangeRecordId: aliceCredentialRecord.id,
    })

    expect(aliceCredentialRecord.state).toBe(DidCommCredentialState.Declined)
  })
})
