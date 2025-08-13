import type { EventReplaySubject } from '../../core/tests'
import type { AnonCredsTestsAgent } from './anoncredsSetup'

import { JsonTransformer } from '@credo-ts/core'
import {
  DidCommCredentialExchangeRecord,
  DidCommCredentialRole,
  DidCommCredentialState,
  DidCommMessageRepository,
  V2CredentialPreview,
  V2OfferCredentialMessage,
} from '@credo-ts/didcomm'

import { waitForCredentialRecordSubject } from '../../core/tests'
import { waitForRevocationNotification } from '../../core/tests/helpers'
import testLogger from '../../core/tests/logger'

import { InMemoryAnonCredsRegistry } from './InMemoryAnonCredsRegistry'
import { setupAnonCredsTests } from './anoncredsSetup'

const credentialPreview = V2CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
  'x-ray': 'some x-ray',
  profile_picture: 'profile picture',
})

describe('IC v2 credential revocation', () => {
  let faberAgent: AnonCredsTestsAgent
  let aliceAgent: AnonCredsTestsAgent
  let credentialDefinitionId: string
  let revocationRegistryDefinitionId: string | null
  let aliceConnectionId: string

  let faberReplay: EventReplaySubject
  let aliceReplay: EventReplaySubject

  const inMemoryRegistry = new InMemoryAnonCredsRegistry()

  const issuerId = 'did:indy:local:LjgpST2rjsoxYegQDRm7EL'

  beforeAll(async () => {
    ;({
      issuerAgent: faberAgent,
      issuerReplay: faberReplay,
      holderAgent: aliceAgent,
      holderReplay: aliceReplay,
      credentialDefinitionId,
      revocationRegistryDefinitionId,
      holderIssuerConnectionId: aliceConnectionId,
    } = await setupAnonCredsTests({
      issuerId,
      issuerName: 'Faber Agent Credentials v2',
      holderName: 'Alice Agent Credentials v2',
      attributeNames: ['name', 'age', 'x-ray', 'profile_picture'],
      supportRevocation: true,
      registries: [inMemoryRegistry],
    }))
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  test('Alice starts with V2 credential proposal to Faber', async () => {
    testLogger.test('Alice sends (v2) credential proposal to Faber')

    const credentialExchangeRecord = await aliceAgent.modules.credentials.proposeCredential({
      connectionId: aliceConnectionId,
      protocolVersion: 'v2',
      credentialFormats: {
        anoncreds: {
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
      comment: 'V2 AnonCreds Proposal',
      credentialFormats: {
        anoncreds: {
          credentialDefinitionId: credentialDefinitionId,
          attributes: credentialPreview.attributes,
          revocationRegistryDefinitionId: revocationRegistryDefinitionId ?? undefined,
          revocationRegistryIndex: 1,
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
      messageClass: V2OfferCredentialMessage,
    })

    expect(JsonTransformer.toJSON(offerMessage)).toMatchObject({
      '@id': expect.any(String),
      '@type': 'https://didcomm.org/issue-credential/2.0/offer-credential',
      comment: 'V2 AnonCreds Proposal',
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
      threadId: faberCredentialRecord.threadId,
      connectionId: aliceCredentialRecord.connectionId,
      role: DidCommCredentialRole.Holder,
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
      comment: 'V2 AnonCreds Credential',
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
    const doneCredentialRecord = await waitForCredentialRecordSubject(faberReplay, {
      threadId: faberCredentialRecord.threadId,
      state: DidCommCredentialState.Done,
    })

    // Now revoke the credential
    const credentialRevocationRegistryDefinitionId = doneCredentialRecord.getTag(
      'anonCredsRevocationRegistryId'
    ) as string
    const credentialRevocationIndex = doneCredentialRecord.getTag('anonCredsCredentialRevocationId') as string

    expect(credentialRevocationRegistryDefinitionId).toBeDefined()
    expect(credentialRevocationIndex).toBeDefined()
    expect(credentialRevocationRegistryDefinitionId).toEqual(revocationRegistryDefinitionId)

    await faberAgent.modules.anoncreds.updateRevocationStatusList({
      revocationStatusList: {
        revocationRegistryDefinitionId: credentialRevocationRegistryDefinitionId,
        revokedCredentialIndexes: [Number(credentialRevocationIndex)],
      },
      options: {},
    })

    await faberAgent.modules.credentials.sendRevocationNotification({
      credentialExchangeRecordId: doneCredentialRecord.id,
      revocationFormat: 'anoncreds',
      revocationId: `${credentialRevocationRegistryDefinitionId}::${credentialRevocationIndex}`,
    })

    testLogger.test('Alice waits for credential revocation notification from Faber')
    await waitForRevocationNotification(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
    })
  })
})
