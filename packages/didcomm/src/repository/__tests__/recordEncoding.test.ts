import path from 'node:path'
import { JsonEncoder, JsonTransformer } from '@credo-ts/core'
import { testRecordEncoding } from '../../../../core/tests/recordEncoding'
import { DidCommBasicMessageRole } from '../../modules/basic-messages/DidCommBasicMessageRole'
import { DidCommBasicMessageRecord } from '../../modules/basic-messages/repository/DidCommBasicMessageRecord'
import {
  DidCommConnectionType,
  DidCommDidExchangeRole,
  DidCommDidExchangeState,
  DidCommHandshakeProtocol,
} from '../../modules/connections/models'
import { DidCommConnectionMetadataKeys } from '../../modules/connections/repository/DidCommConnectionMetadataTypes'
import { DidCommConnectionRecord } from '../../modules/connections/repository/DidCommConnectionRecord'
import { DidCommAutoAcceptCredential } from '../../modules/credentials/models/DidCommCredentialAutoAcceptType'
import { DidCommCredentialPreviewAttribute } from '../../modules/credentials/models/DidCommCredentialPreviewAttribute'
import { DidCommCredentialRole } from '../../modules/credentials/models/DidCommCredentialRole'
import { DidCommCredentialState } from '../../modules/credentials/models/DidCommCredentialState'
import { DidCommRevocationNotification } from '../../modules/credentials/models/DidCommRevocationNotification'
import { DidCommCredentialExchangeRecord } from '../../modules/credentials/repository/DidCommCredentialExchangeRecord'
import { DidCommOutOfBandRole } from '../../modules/oob/domain/DidCommOutOfBandRole'
import { DidCommOutOfBandState } from '../../modules/oob/domain/DidCommOutOfBandState'
import {
  DidCommInvitationType,
  DidCommOutOfBandInvitation,
} from '../../modules/oob/messages/DidCommOutOfBandInvitation'
import { DidCommOutOfBandRecord } from '../../modules/oob/repository/DidCommOutOfBandRecord'
import { DidCommOutOfBandRecordMetadataKeys } from '../../modules/oob/repository/outOfBandRecordMetadataTypes'
import { DidCommAutoAcceptProof } from '../../modules/proofs/models/DidCommProofAutoAcceptType'
import { DidCommProofRole } from '../../modules/proofs/models/DidCommProofRole'
import { DidCommProofState } from '../../modules/proofs/models/DidCommProofState'
import { DidCommProofExchangeRecord } from '../../modules/proofs/repository/DidCommProofExchangeRecord'
import { DidCommMediatorPickupStrategy } from '../../modules/routing/DidCommMediatorPickupStrategy'
import { DidCommMediationRole } from '../../modules/routing/models/DidCommMediationRole'
import { DidCommMediationState } from '../../modules/routing/models/DidCommMediationState'
import { DidCommMediationRecord } from '../../modules/routing/repository/DidCommMediationRecord'
import { DidCommMediatorRoutingRecord } from '../../modules/routing/repository/DidCommMediatorRoutingRecord'
import { DidCommMessageRecord } from '../DidCommMessageRecord'
import { DidCommMessageRole } from '../DidCommMessageRole'

const createdAt = new Date('2026-01-01T00:00:00.000Z')
const updatedAt = new Date('2026-01-02T00:00:00.000Z')

const recipientDidKey = 'did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'
const routingDidKey = 'did:key:z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv'

const requestMessage = {
  '@type': 'https://didcomm.org/issue-credential/2.0/offer-credential',
  '@id': 'f1ed5be5-7b2b-4e0c-a1d8-6b3e8c0e8d1a',
  comment: 'Offer for the Faber College Graduate credential',
  credential_preview: {
    '@type': 'https://didcomm.org/issue-credential/2.0/credential-preview',
    attributes: [{ name: 'name', 'mime-type': 'text/plain', value: 'Alice' }],
  },
  formats: [{ attach_id: 'offer-attachment-id', format: 'hlindy/cred-abstract@v2.0' }],
  'offers~attach': [
    {
      '@id': 'offer-attachment-id',
      'mime-type': 'application/json',
      data: { base64: 'eyJzY2hlbWFfaWQiOiJzY2hlbWEtaWQifQ==' },
    },
  ],
  '~thread': { thid: 'ea24e14a-4fc4-40f4-85a0-f6fcf02bfc1c' },
}

const fixturesDirectory = path.join(__dirname, '__fixtures__/records')

const outOfBandInvitationJson = {
  '@type': 'https://didcomm.org/out-of-band/1.1/invitation',
  '@id': '69212a3a-d068-4f9d-a2dd-4741bca89af3',
  label: 'Faber College',
  goal_code: 'issue-vc',
  goal: 'To issue a Faber College Graduate credential',
  accept: ['didcomm/aip1', 'didcomm/aip2;env=rfc19'],
  handshake_protocols: ['https://didcomm.org/didexchange/1.x', 'https://didcomm.org/connections/1.x'],
  services: [
    {
      id: '#inline',
      type: 'did-communication',
      recipientKeys: [recipientDidKey],
      routingKeys: [routingDidKey],
      serviceEndpoint: 'https://example.com/ssi',
      accept: ['didcomm/aip1'],
    },
  ],
  imageUrl: 'https://example.com/faber.png',
  'requests~attach': [
    {
      '@id': 'request-attachment-id',
      'mime-type': 'application/json',
      data: { base64: JsonEncoder.toBase64(requestMessage) },
    },
  ],
  '~attach': [
    {
      '@id': 'appended-attachment-id',
      description: 'Appended attachment',
      filename: 'attachment.json',
      'mime-type': 'application/json',
      lastmod_time: '2026-01-01T00:00:00.000Z',
      byte_count: 17,
      data: { json: { key: 'value' } },
    },
  ],
  '~thread': { pthid: 'c4b5e8f2-3d1a-4b6c-9e7f-1a2b3c4d5e6f' },
  '~l10n': { locale: 'en' },
}

function createOutOfBandRecord(invitationJson: Record<string, unknown>) {
  const record = new DidCommOutOfBandRecord({
    id: 'out-of-band-record-id',
    createdAt,
    tags: {
      recipientKeyFingerprints: ['z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'],
      recipientRoutingKeyFingerprint: 'z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv',
      custom: 'tag',
    },
    outOfBandInvitation: JsonTransformer.fromJSON(invitationJson, DidCommOutOfBandInvitation),
    role: DidCommOutOfBandRole.Receiver,
    state: DidCommOutOfBandState.PrepareResponse,
    alias: 'Faber',
    autoAcceptConnection: true,
    reusable: true,
    mediatorId: 'mediator-id',
    reuseConnectionId: 'reuse-connection-id',
    invitationInlineServiceKeys: [
      { recipientKeyFingerprint: 'z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th', kmsKeyId: 'kms-key-id' },
    ],
  })
  record.updatedAt = updatedAt
  record.metadata.set(DidCommOutOfBandRecordMetadataKeys.RecipientRouting, {
    recipientKeyFingerprint: 'z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th',
    recipientKeyId: 'recipient-key-id',
    routingKeyFingerprints: ['z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv'],
    endpoints: ['https://example.com/ssi'],
    mediatorId: 'mediator-id',
  })
  record.metadata.set(DidCommOutOfBandRecordMetadataKeys.LegacyInvitation, {
    legacyInvitationType: DidCommInvitationType.Connectionless,
  })
  return record
}

testRecordEncoding(fixturesDirectory, {
  DidCommBasicMessageRecord: () => {
    const record = new DidCommBasicMessageRecord({
      id: 'basic-message-record-id',
      createdAt,
      tags: { custom: 'tag' },
      connectionId: 'connection-id',
      role: DidCommBasicMessageRole.Receiver,
      threadId: 'thread-id',
      parentThreadId: 'parent-thread-id',
      content: 'Hello, world!',
      sentTime: '2026-01-01T00:00:00.000Z',
    })
    record.updatedAt = updatedAt
    record.metadata.set('meta', { key: 'value' })
    return record
  },

  DidCommConnectionRecord: () => {
    const record = new DidCommConnectionRecord({
      id: 'connection-record-id',
      createdAt,
      did: 'did:peer:1zQmZMygzYqNwU6Uhmewx5Xepf2VLp5S4HLSwwgf2aiKZuwa',
      theirDid: 'did:peer:1zQmP96nW6vbNjzwPt19z1NYqhnAfgnAFqfLHcktkmdUFzhT',
      theirLabel: 'Faber College',
      state: DidCommDidExchangeState.Completed,
      role: DidCommDidExchangeRole.Requester,
      alias: 'Faber',
      autoAcceptConnection: true,
      threadId: 'thread-id',
      tags: { custom: 'tag' },
      imageUrl: 'https://example.com/faber.png',
      mediatorId: 'mediator-id',
      errorMessage: 'error message',
      protocol: DidCommHandshakeProtocol.DidExchange,
      outOfBandId: 'out-of-band-id',
      invitationDid: 'did:peer:2.SeyJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSIsInQiOiJkaWQtY29tbXVuaWNhdGlvbiJ9',
      connectionTypes: [DidCommConnectionType.Mediator, 'custom-type'],
      previousDids: ['did:peer:1zQmPreviousDid'],
      previousTheirDids: ['did:peer:1zQmPreviousTheirDid'],
    })
    record.updatedAt = updatedAt
    record.metadata.set(DidCommConnectionMetadataKeys.UseDidKeysForProtocol, {
      'https://didcomm.org/coordinate-mediation/1.0': true,
    })
    record.metadata.set(DidCommConnectionMetadataKeys.DidRotate, {
      did: 'did:peer:1zQmRotatedDid',
      threadId: 'did-rotate-thread-id',
      mediatorId: 'mediator-id',
    })
    return record
  },

  DidCommCredentialExchangeRecord: () => {
    const record = new DidCommCredentialExchangeRecord({
      id: 'credential-exchange-record-id',
      createdAt,
      state: DidCommCredentialState.Done,
      role: DidCommCredentialRole.Holder,
      connectionId: 'connection-id',
      threadId: 'thread-id',
      parentThreadId: 'parent-thread-id',
      protocolVersion: 'v2',
      tags: { custom: 'tag' },
      credentialAttributes: [
        new DidCommCredentialPreviewAttribute({ name: 'name', mimeType: 'text/plain', value: 'Alice' }),
        new DidCommCredentialPreviewAttribute({ name: 'picture', mimeType: 'image/png', value: 'aGVsbG8=' }),
      ],
      autoAcceptCredential: DidCommAutoAcceptCredential.ContentApproved,
      revocationNotification: new DidCommRevocationNotification(
        'Credential has been revoked',
        new Date('2026-01-03T00:00:00.000Z')
      ),
      errorMessage: 'error message',
      credentials: [
        { credentialRecordType: 'w3c', credentialRecordId: 'w3c-credential-record-id' },
        { credentialRecordType: 'anoncreds', credentialRecordId: 'anoncreds-credential-record-id' },
      ],
    })
    record.updatedAt = updatedAt
    record.metadata.set('_anoncreds/credential', { schemaId: 'schema-id', credentialDefinitionId: 'cred-def-id' })
    return record
  },

  DidCommOutOfBandRecord: () => createOutOfBandRecord(outOfBandInvitationJson),
  'DidCommOutOfBandRecord.didServices': () =>
    createOutOfBandRecord({
      ...outOfBandInvitationJson,
      services: [...outOfBandInvitationJson.services, 'did:sov:LjgpST2rjsoxYegQDRm7EL'],
    }),

  DidCommProofExchangeRecord: () => {
    const record = new DidCommProofExchangeRecord({
      id: 'proof-exchange-record-id',
      createdAt,
      protocolVersion: 'v2',
      isVerified: true,
      state: DidCommProofState.Done,
      role: DidCommProofRole.Verifier,
      connectionId: 'connection-id',
      threadId: 'thread-id',
      parentThreadId: 'parent-thread-id',
      tags: { custom: 'tag' },
      autoAcceptProof: DidCommAutoAcceptProof.Always,
      errorMessage: 'error message',
    })
    record.updatedAt = updatedAt
    record.metadata.set('meta', { key: 'value' })
    return record
  },

  DidCommMediationRecord: () => {
    const record = new DidCommMediationRecord({
      id: 'mediation-record-id',
      state: DidCommMediationState.Granted,
      role: DidCommMediationRole.Recipient,
      createdAt,
      connectionId: 'connection-id',
      threadId: 'thread-id',
      endpoint: 'https://mediator.example.com',
      recipientKeys: ['did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'],
      routingKeys: ['did:key:z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv'],
      pickupStrategy: DidCommMediatorPickupStrategy.PickUpV2LiveMode,
      tags: { default: true },
    })
    record.updatedAt = updatedAt
    record.metadata.set('meta', { key: 'value' })
    return record
  },

  DidCommMediatorRoutingRecord: () => {
    const record = new DidCommMediatorRoutingRecord({
      id: 'mediator-routing-record-id',
      createdAt,
      routingKeys: [
        { routingKeyFingerprint: 'z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th', kmsKeyId: 'kms-key-id' },
      ],
    })
    // Legacy base58 encoded routing key, still supported next to the new format
    record.routingKeys.push('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K')
    record.setTag('custom', 'tag')
    record.updatedAt = updatedAt
    record.metadata.set('meta', { key: 'value' })
    return record
  },

  DidCommMessageRecord: () => {
    const record = new DidCommMessageRecord({
      id: 'didcomm-message-record-id',
      createdAt,
      role: DidCommMessageRole.Receiver,
      message: requestMessage,
      associatedRecordId: 'credential-exchange-record-id',
    })
    record.setTag('custom', 'tag')
    record.updatedAt = updatedAt
    record.metadata.set('meta', { key: 'value' })
    return record
  },
})

describe('legacy stored formats', () => {
  test('DidCommMediationRecord upgrades the Explicit pickup strategy to PickUpV1', () => {
    const record = JsonTransformer.fromJSON(
      {
        id: 'mediation-record-id',
        createdAt: '2026-01-01T00:00:00.000Z',
        state: 'granted',
        role: 'RECIPIENT',
        connectionId: 'connection-id',
        threadId: 'thread-id',
        recipientKeys: [],
        routingKeys: [],
        pickupStrategy: 'Explicit',
        metadata: {},
        _tags: {},
      },
      DidCommMediationRecord
    )

    expect(record.pickupStrategy).toEqual(DidCommMediatorPickupStrategy.PickUpV1)
    expect(JsonTransformer.toJSON(record).pickupStrategy).toEqual('PickUpV1')
  })

  test('DidCommCredentialExchangeRecord defaults a missing credential attribute mime-type to text/plain', () => {
    const record = JsonTransformer.fromJSON(
      {
        id: 'credential-exchange-record-id',
        createdAt: '2026-01-01T00:00:00.000Z',
        state: 'done',
        role: 'holder',
        threadId: 'thread-id',
        protocolVersion: 'v1',
        credentialAttributes: [{ name: 'name', value: 'Alice' }],
        credentials: [],
        metadata: {},
        _tags: {},
      },
      DidCommCredentialExchangeRecord
    )

    expect(record.credentialAttributes?.[0]).toBeInstanceOf(DidCommCredentialPreviewAttribute)
    expect(JsonTransformer.toJSON(record).credentialAttributes).toEqual([
      { name: 'name', 'mime-type': 'text/plain', value: 'Alice' },
    ])
  })

  test('DidCommOutOfBandRecord replaces the legacy did:sov message type prefix in the invitation', () => {
    const record = JsonTransformer.fromJSON(
      {
        id: 'out-of-band-record-id',
        createdAt: '2026-01-01T00:00:00.000Z',
        role: 'receiver',
        state: 'prepare-response',
        reusable: false,
        outOfBandInvitation: {
          '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/out-of-band/1.1/invitation',
          '@id': '69212a3a-d068-4f9d-a2dd-4741bca89af3',
          handshake_protocols: ['did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0'],
          services: ['did:sov:LjgpST2rjsoxYegQDRm7EL'],
        },
        metadata: {},
        _tags: { recipientKeyFingerprints: [] },
      },
      DidCommOutOfBandRecord
    )

    expect(record.outOfBandInvitation).toBeInstanceOf(DidCommOutOfBandInvitation)
    expect(JsonTransformer.toJSON(record).outOfBandInvitation).toEqual({
      '@type': 'https://didcomm.org/out-of-band/1.1/invitation',
      '@id': '69212a3a-d068-4f9d-a2dd-4741bca89af3',
      handshake_protocols: ['https://didcomm.org/connections/1.0'],
      services: ['did:sov:LjgpST2rjsoxYegQDRm7EL'],
    })
    expect(record.getTags()).toEqual({
      recipientKeyFingerprints: [],
      role: 'receiver',
      state: 'prepare-response',
      invitationId: '69212a3a-d068-4f9d-a2dd-4741bca89af3',
      threadId: '69212a3a-d068-4f9d-a2dd-4741bca89af3',
      invitationRequestsThreadIds: undefined,
    })
  })
})
