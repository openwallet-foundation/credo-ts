import { getAgentConfig, mockFunction } from '../../../../../../tests/helpers'
import { Agent } from '../../../../../agent/Agent'
import {
  ConnectionRecord,
  ConnectionRole,
  ConnectionState,
  DidExchangeRole,
  DidExchangeState,
} from '../../../../../modules/connections'
import { ConnectionRepository } from '../../../../../modules/connections/repository/ConnectionRepository'
import { DidDocumentRole } from '../../../../../modules/dids/domain/DidDocumentRole'
import { DidRecord } from '../../../../../modules/dids/repository'
import { DidRepository } from '../../../../../modules/dids/repository/DidRepository'
import { OutOfBandRole } from '../../../../../modules/oob/domain/OutOfBandRole'
import { OutOfBandState } from '../../../../../modules/oob/domain/OutOfBandState'
import { OutOfBandRecord } from '../../../../../modules/oob/repository'
import { OutOfBandRepository } from '../../../../../modules/oob/repository/OutOfBandRepository'
import { JsonTransformer } from '../../../../../utils'
import * as testModule from '../connection'

import didPeer4kgVt6CidfKgo1MoWMqsQX from './__fixtures__/didPeer4kgVt6CidfKgo1MoWMqsQX.json'
import didPeerR1xKJw17sUoXhejEpugMYJ from './__fixtures__/didPeerR1xKJw17sUoXhejEpugMYJ.json'
import legacyDidPeer4kgVt6CidfKgo1MoWMqsQX from './__fixtures__/legacyDidPeer4kgVt6CidfKgo1MoWMqsQX.json'
import legacyDidPeerR1xKJw17sUoXhejEpugMYJ from './__fixtures__/legacyDidPeerR1xKJw17sUoXhejEpugMYJ.json'

const agentConfig = getAgentConfig('Migration ConnectionRecord 0.1-0.2')

jest.mock('../../../../../modules/connections/repository/ConnectionRepository')
const ConnectionRepositoryMock = ConnectionRepository as jest.Mock<ConnectionRepository>
const connectionRepository = new ConnectionRepositoryMock()

jest.mock('../../../../../modules/dids/repository/DidRepository')
const DidRepositoryMock = DidRepository as jest.Mock<DidRepository>
const didRepository = new DidRepositoryMock()

jest.mock('../../../../../modules/oob/repository/OutOfBandRepository')
const OutOfBandRepositoryMock = OutOfBandRepository as jest.Mock<OutOfBandRepository>
const outOfBandRepository = new OutOfBandRepositoryMock()

jest.mock('../../../../../agent/Agent', () => {
  return {
    Agent: jest.fn(() => ({
      config: agentConfig,
      injectionContainer: {
        resolve: jest.fn((cls) => {
          if (cls === ConnectionRepository) {
            return connectionRepository
          } else if (cls === DidRepository) {
            return didRepository
          } else if (cls === OutOfBandRepository) {
            return outOfBandRepository
          }

          throw new Error(`No instance found for ${cls}`)
        }),
      },
    })),
  }
})

const connectionJson = {
  role: 'inviter',
  state: 'invited',
  did: legacyDidPeerR1xKJw17sUoXhejEpugMYJ.id,
  didDoc: legacyDidPeerR1xKJw17sUoXhejEpugMYJ,
  theirDid: legacyDidPeer4kgVt6CidfKgo1MoWMqsQX.id,
  theirDidDoc: legacyDidPeer4kgVt6CidfKgo1MoWMqsQX,
  invitation: {
    '@type': 'https://didcomm.org/connections/1.0/invitation',
    '@id': '04a2c382-999e-4de9-a1d2-9dec0b2fa5e4',
    recipientKeys: ['E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu'],
    serviceEndpoint: 'https://example.com',
    label: 'test',
  },
  createdAt: '2020-04-08T15:51:43.819Z',
}

const connectionJsonNewDidStateRole = {
  role: 'responder',
  state: 'invitation-sent',
  did: didPeerR1xKJw17sUoXhejEpugMYJ.id,
  theirDid: didPeer4kgVt6CidfKgo1MoWMqsQX.id,
  invitation: {
    '@type': 'https://didcomm.org/connections/1.0/invitation',
    '@id': '04a2c382-999e-4de9-a1d2-9dec0b2fa5e4',
    recipientKeys: ['E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu'],
    serviceEndpoint: 'https://example.com',
    label: 'test',
  },
  createdAt: '2020-04-08T15:51:43.819Z',
  autoAcceptConnection: true,
  multiUseInvitation: false,
  mediatorId: 'a-mediator-id',
}

// Mock typed object
const AgentMock = Agent as jest.Mock<Agent>

describe('0.1-0.2 | Connection', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new AgentMock()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('migrateCredentialRecordToV0_2()', () => {
    it('should fetch all records and apply the needed updates', async () => {
      const input = JsonTransformer.fromJSON(connectionJson, ConnectionRecord)
      const records = [input]

      mockFunction(connectionRepository.getAll).mockResolvedValue(records)

      // Not records exist yet
      mockFunction(outOfBandRepository.findByQuery).mockResolvedValue([])
      mockFunction(didRepository.findById).mockResolvedValue(null)

      await testModule.migrateConnectionRecordToV0_2(agent)

      expect(connectionRepository.getAll).toHaveBeenCalledTimes(1)
      expect(connectionRepository.update).toHaveBeenCalledTimes(records.length)
      const [[updatedConnectionRecord]] = mockFunction(connectionRepository.update).mock.calls

      // Check first object is transformed correctly.
      //  - removed invitation, theirDidDoc, didDoc
      //  - Added invitationDid
      //  - Updated did, theirDid
      expect(updatedConnectionRecord.toJSON()).toEqual({
        _tags: {},
        metadata: {},
        createdAt: '2020-04-08T15:51:43.819Z',
        role: 'responder',
        state: 'invitation-sent',
        did: didPeerR1xKJw17sUoXhejEpugMYJ.id,
        invitationDid:
          'did:peer:2.Ez6MksYU4MHtfmNhNm1uGMvANr9j4CBv2FymjiJtRgA36bSVH.SeyJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSJ9',
        theirDid: didPeer4kgVt6CidfKgo1MoWMqsQX.id,
        outOfBandId: expect.any(String),
      })
    })
  })

  describe('updateConnectionRoleAndState', () => {
    it('should update the connection role and state to did exchange values', async () => {
      const connectionRecord = JsonTransformer.fromJSON(
        { ...connectionJson, state: 'requested', role: 'invitee' },
        ConnectionRecord
      )

      await testModule.updateConnectionRoleAndState(agent, connectionRecord)

      expect(connectionRecord.toJSON()).toEqual({
        _tags: {},
        metadata: {},
        createdAt: '2020-04-08T15:51:43.819Z',
        role: 'requester',
        state: 'request-sent',
        did: legacyDidPeerR1xKJw17sUoXhejEpugMYJ.id,
        didDoc: legacyDidPeerR1xKJw17sUoXhejEpugMYJ,
        theirDid: legacyDidPeer4kgVt6CidfKgo1MoWMqsQX.id,
        theirDidDoc: legacyDidPeer4kgVt6CidfKgo1MoWMqsQX,
        invitation: {
          '@type': 'https://didcomm.org/connections/1.0/invitation',
          '@id': '04a2c382-999e-4de9-a1d2-9dec0b2fa5e4',
          recipientKeys: ['E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu'],
          serviceEndpoint: 'https://example.com',
          label: 'test',
        },
      })
    })
  })

  describe('extractDidDocument', () => {
    it('should extract the did document from the connection record and update the did to a did:peer did', async () => {
      const connectionRecord = JsonTransformer.fromJSON(connectionJson, ConnectionRecord)

      // No did record exists yet
      mockFunction(didRepository.findById).mockResolvedValue(null)

      await testModule.extractDidDocument(agent, connectionRecord)

      expect(connectionRecord.toJSON()).toEqual({
        _tags: {},
        metadata: {},
        createdAt: '2020-04-08T15:51:43.819Z',
        role: 'inviter',
        state: 'invited',
        did: didPeerR1xKJw17sUoXhejEpugMYJ.id,
        theirDid: didPeer4kgVt6CidfKgo1MoWMqsQX.id,

        invitation: {
          '@type': 'https://didcomm.org/connections/1.0/invitation',
          '@id': '04a2c382-999e-4de9-a1d2-9dec0b2fa5e4',
          recipientKeys: ['E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu'],
          serviceEndpoint: 'https://example.com',
          label: 'test',
        },
      })
    })

    it('should create a DidRecord for didDoc and theirDidDoc', async () => {
      const connectionRecord = JsonTransformer.fromJSON(connectionJson, ConnectionRecord)

      // No did record exists yet
      mockFunction(didRepository.findById).mockResolvedValue(null)

      await testModule.extractDidDocument(agent, connectionRecord)

      expect(didRepository.save).toHaveBeenCalledTimes(2)

      const [[didRecord], [theirDidRecord]] = mockFunction(didRepository.save).mock.calls

      expect(didRecord.toJSON()).toMatchObject({
        id: didPeerR1xKJw17sUoXhejEpugMYJ.id,
        role: DidDocumentRole.Created,
        didDocument: didPeerR1xKJw17sUoXhejEpugMYJ,
        createdAt: connectionRecord.createdAt.toISOString(),
        metadata: {
          '_internal/legacyDid': {
            unqualifiedDid: legacyDidPeerR1xKJw17sUoXhejEpugMYJ.id,
            didDocumentString: JSON.stringify(legacyDidPeerR1xKJw17sUoXhejEpugMYJ),
          },
        },
        _tags: {
          recipientKeys: ['R1xKJw17sUoXhejEpugMYJ#4', 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu'],
        },
      })

      expect(theirDidRecord.toJSON()).toMatchObject({
        id: didPeer4kgVt6CidfKgo1MoWMqsQX.id,
        role: DidDocumentRole.Received,
        didDocument: didPeer4kgVt6CidfKgo1MoWMqsQX,
        createdAt: connectionRecord.createdAt.toISOString(),
        metadata: {
          '_internal/legacyDid': {
            unqualifiedDid: legacyDidPeer4kgVt6CidfKgo1MoWMqsQX.id,
            didDocumentString: JSON.stringify(legacyDidPeer4kgVt6CidfKgo1MoWMqsQX),
          },
        },
        _tags: {
          recipientKeys: ['4kgVt6CidfKgo1MoWMqsQX#4', '5sD8ttxn9Bd9a1HmueLirJ4HNhs4Q8qzAqDd1UCR9iqD'],
        },
      })
    })

    it('should not extract the did document if it does not exist on the connection record', async () => {
      const connectionRecord = JsonTransformer.fromJSON(
        { ...connectionJson, didDoc: undefined, theirDidDoc: undefined },
        ConnectionRecord
      )

      await testModule.extractDidDocument(agent, connectionRecord)

      expect(didRepository.findById).not.toHaveBeenCalled()
      expect(didRepository.save).not.toHaveBeenCalled()

      // Should be the same as the input
      expect(connectionRecord.toJSON()).toEqual({
        ...connectionJson,
        didDoc: undefined,
        theirDidDoc: undefined,
        metadata: {},
        _tags: {},
      })
    })

    it('should not create a did record if a did record for the did already exists', async () => {
      const connectionRecord = JsonTransformer.fromJSON(connectionJson, ConnectionRecord)

      const didRecord = JsonTransformer.fromJSON(
        {
          id: didPeerR1xKJw17sUoXhejEpugMYJ.id,
          role: DidDocumentRole.Created,
          didDocument: didPeerR1xKJw17sUoXhejEpugMYJ,
          createdAt: connectionRecord.createdAt.toISOString(),
          metadata: {
            '_internal/legacyDid': {
              unqualifiedDid: legacyDidPeerR1xKJw17sUoXhejEpugMYJ.id,
              didDocumentString: JSON.stringify(legacyDidPeerR1xKJw17sUoXhejEpugMYJ),
            },
          },
          _tags: {
            recipientKeys: ['R1xKJw17sUoXhejEpugMYJ#4', 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu'],
          },
        },
        DidRecord
      )

      const theirDidRecord = JsonTransformer.fromJSON(
        {
          id: didPeer4kgVt6CidfKgo1MoWMqsQX.id,
          role: DidDocumentRole.Received,
          didDocument: didPeer4kgVt6CidfKgo1MoWMqsQX,
          createdAt: connectionRecord.createdAt.toISOString(),
          metadata: {
            '_internal/legacyDid': {
              unqualifiedDid: legacyDidPeer4kgVt6CidfKgo1MoWMqsQX.id,
              didDocumentString: JSON.stringify(legacyDidPeer4kgVt6CidfKgo1MoWMqsQX),
            },
          },
          _tags: {
            recipientKeys: ['4kgVt6CidfKgo1MoWMqsQX#4', '5sD8ttxn9Bd9a1HmueLirJ4HNhs4Q8qzAqDd1UCR9iqD'],
          },
        },
        DidRecord
      )

      // Both did records already exist
      mockFunction(didRepository.findById).mockImplementation((id) =>
        Promise.resolve(id === didPeerR1xKJw17sUoXhejEpugMYJ.id ? didRecord : theirDidRecord)
      )

      await testModule.extractDidDocument(agent, connectionRecord)

      expect(didRepository.save).not.toHaveBeenCalled()
      expect(didRepository.findById).toHaveBeenNthCalledWith(1, didPeerR1xKJw17sUoXhejEpugMYJ.id)
      expect(didRepository.findById).toHaveBeenNthCalledWith(2, didPeer4kgVt6CidfKgo1MoWMqsQX.id)

      expect(connectionRecord.toJSON()).toEqual({
        _tags: {},
        metadata: {},
        createdAt: '2020-04-08T15:51:43.819Z',
        role: 'inviter',
        state: 'invited',
        did: didPeerR1xKJw17sUoXhejEpugMYJ.id,
        theirDid: didPeer4kgVt6CidfKgo1MoWMqsQX.id,
        invitation: {
          '@type': 'https://didcomm.org/connections/1.0/invitation',
          '@id': '04a2c382-999e-4de9-a1d2-9dec0b2fa5e4',
          recipientKeys: ['E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu'],
          serviceEndpoint: 'https://example.com',
          label: 'test',
        },
      })
    })
  })

  describe('migrateToOobRecord', () => {
    it('should extract the invitation from the connection record and generate an invitation did', async () => {
      const connectionRecord = JsonTransformer.fromJSON(connectionJsonNewDidStateRole, ConnectionRecord)

      // No did record exists yet
      mockFunction(outOfBandRepository.findByQuery).mockResolvedValue([])

      await testModule.migrateToOobRecord(agent, connectionRecord)

      expect(connectionRecord.toJSON()).toEqual({
        _tags: {},
        metadata: {},
        createdAt: '2020-04-08T15:51:43.819Z',
        role: 'responder',
        state: 'invitation-sent',
        did: didPeerR1xKJw17sUoXhejEpugMYJ.id,
        theirDid: didPeer4kgVt6CidfKgo1MoWMqsQX.id,
        invitationDid:
          'did:peer:2.Ez6MksYU4MHtfmNhNm1uGMvANr9j4CBv2FymjiJtRgA36bSVH.SeyJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSJ9',
        outOfBandId: expect.any(String),
        autoAcceptConnection: true,
        mediatorId: 'a-mediator-id',
        multiUseInvitation: false,
      })
    })

    it('should create an OutOfBandRecord from the invitation and store the outOfBandId in the connection record', async () => {
      const connectionRecord = JsonTransformer.fromJSON(connectionJsonNewDidStateRole, ConnectionRecord)

      // No did record exists yet
      mockFunction(outOfBandRepository.findByQuery).mockResolvedValue([])

      await testModule.migrateToOobRecord(agent, connectionRecord)

      const [[outOfBandRecord]] = mockFunction(outOfBandRepository.save).mock.calls

      expect(outOfBandRepository.save).toHaveBeenCalledTimes(1)
      expect(connectionRecord.outOfBandId).toEqual(outOfBandRecord.id)

      expect(outOfBandRecord.toJSON()).toEqual({
        id: expect.any(String),
        _tags: {},
        metadata: {},
        // Checked below
        outOfBandMessage: {
          '@type': 'https://didcomm.org/out-of-band/1.1/invitation',
          services: [
            {
              id: '#inline',
              serviceEndpoint: 'https://example.com',
              type: 'did-communication',
              priority: 0,
              recipientKeys: ['E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu'],
              routingKeys: [],
            },
          ],
          '@id': '04a2c382-999e-4de9-a1d2-9dec0b2fa5e4',
          label: 'test',
          accept: ['didcomm/aip1', 'didcomm/aip2;env=rfc19'],
          handshake_protocols: ['https://didcomm.org/connections/1.0'],
        },
        role: OutOfBandRole.Sender,
        state: OutOfBandState.AwaitResponse,
        autoAcceptConnection: true,
        did: didPeerR1xKJw17sUoXhejEpugMYJ.id,
        reusable: false,
        mediatorId: 'a-mediator-id',
        createdAt: connectionRecord.createdAt.toISOString(),
      })
    })

    it('should create an OutOfBandRecord if an OutOfBandRecord with the invitation id already exists, but the connection did is different', async () => {
      const connectionRecord = JsonTransformer.fromJSON(connectionJsonNewDidStateRole, ConnectionRecord)

      const outOfBandRecord = JsonTransformer.fromJSON(
        {
          id: '3c52cc26-577d-4200-8753-05f1f425c342',
          _tags: {},
          metadata: {},
          // Checked below
          outOfBandMessage: {
            '@type': 'https://didcomm.org/out-of-band/1.1/invitation',
            services: [
              {
                id: '#inline',
                serviceEndpoint: 'https://example.com',
                type: 'did-communication',
                priority: 0,
                recipientKeys: ['E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu'],
                routingKeys: [],
              },
            ],
            '@id': '04a2c382-999e-4de9-a1d2-9dec0b2fa5e4',
            label: 'test',
            accept: ['didcomm/aip1', 'didcomm/aip2;env=rfc19'],
            handshake_protocols: ['https://didcomm.org/connections/1.0'],
          },
          role: OutOfBandRole.Sender,
          state: OutOfBandState.AwaitResponse,
          autoAcceptConnection: true,
          did: 'some-random-did',
          reusable: false,
          mediatorId: 'a-mediator-id',
          createdAt: connectionRecord.createdAt.toISOString(),
        },
        OutOfBandRecord
      )

      // Out of band record already exists, but not the correct one
      mockFunction(outOfBandRepository.findByQuery).mockResolvedValueOnce([outOfBandRecord])

      await testModule.migrateToOobRecord(agent, connectionRecord)

      expect(outOfBandRepository.findByQuery).toHaveBeenCalledTimes(1)
      expect(outOfBandRepository.findByQuery).toHaveBeenNthCalledWith(1, {
        messageId: '04a2c382-999e-4de9-a1d2-9dec0b2fa5e4',
      })

      // Expect the out of band record to be created
      expect(outOfBandRepository.save).toHaveBeenCalled()
    })

    it('should not create an OutOfBandRecord if an OutOfBandRecord with the invitation id and connection did already exists', async () => {
      const connectionRecord = JsonTransformer.fromJSON(connectionJsonNewDidStateRole, ConnectionRecord)

      const outOfBandRecord = JsonTransformer.fromJSON(
        {
          id: '3c52cc26-577d-4200-8753-05f1f425c342',
          _tags: {},
          metadata: {},
          // Checked below
          outOfBandMessage: {
            '@type': 'https://didcomm.org/out-of-band/1.1/invitation',
            services: [
              {
                id: '#inline',
                serviceEndpoint: 'https://example.com',
                type: 'did-communication',
                priority: 0,
                recipientKeys: ['E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu'],
                routingKeys: [],
              },
            ],
            '@id': '04a2c382-999e-4de9-a1d2-9dec0b2fa5e4',
            label: 'test',
            accept: ['didcomm/aip1', 'didcomm/aip2;env=rfc19'],
            handshake_protocols: ['https://didcomm.org/connections/1.0'],
          },
          role: OutOfBandRole.Sender,
          state: OutOfBandState.AwaitResponse,
          autoAcceptConnection: true,
          did: didPeerR1xKJw17sUoXhejEpugMYJ.id,
          reusable: false,
          mediatorId: 'a-mediator-id',
          createdAt: connectionRecord.createdAt.toISOString(),
        },
        OutOfBandRecord
      )

      // Out of band record already exists
      mockFunction(outOfBandRepository.findByQuery).mockResolvedValueOnce([outOfBandRecord])

      await testModule.migrateToOobRecord(agent, connectionRecord)

      expect(outOfBandRepository.findByQuery).toHaveBeenCalledTimes(1)
      expect(outOfBandRepository.findByQuery).toHaveBeenNthCalledWith(1, {
        messageId: '04a2c382-999e-4de9-a1d2-9dec0b2fa5e4',
      })
      expect(outOfBandRepository.save).not.toHaveBeenCalled()

      expect(connectionRecord.toJSON()).toEqual({
        _tags: {},
        metadata: {},
        createdAt: '2020-04-08T15:51:43.819Z',
        role: 'responder',
        state: 'invitation-sent',
        did: didPeerR1xKJw17sUoXhejEpugMYJ.id,
        theirDid: didPeer4kgVt6CidfKgo1MoWMqsQX.id,
        invitationDid:
          'did:peer:2.Ez6MksYU4MHtfmNhNm1uGMvANr9j4CBv2FymjiJtRgA36bSVH.SeyJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSJ9',
        autoAcceptConnection: true,
        multiUseInvitation: false,
        mediatorId: 'a-mediator-id',
        outOfBandId: outOfBandRecord.id,
      })
    })
  })

  describe('oobStateFromDidExchangeRoleAndState', () => {
    it('should return the correct state for all connection role and state combinations', () => {
      expect(
        testModule.oobStateFromDidExchangeRoleAndState(DidExchangeRole.Responder, DidExchangeState.InvitationSent)
      ).toEqual(OutOfBandState.AwaitResponse)
      expect(
        testModule.oobStateFromDidExchangeRoleAndState(DidExchangeRole.Responder, DidExchangeState.RequestReceived)
      ).toEqual(OutOfBandState.Done)
      expect(
        testModule.oobStateFromDidExchangeRoleAndState(DidExchangeRole.Responder, DidExchangeState.ResponseSent)
      ).toEqual(OutOfBandState.Done)
      expect(
        testModule.oobStateFromDidExchangeRoleAndState(DidExchangeRole.Responder, DidExchangeState.Completed)
      ).toEqual(OutOfBandState.Done)
      expect(
        testModule.oobStateFromDidExchangeRoleAndState(DidExchangeRole.Responder, DidExchangeState.Abandoned)
      ).toEqual(OutOfBandState.Done)
      expect(testModule.oobStateFromDidExchangeRoleAndState(DidExchangeRole.Requester, DidExchangeState.Start)).toEqual(
        OutOfBandState.PrepareResponse
      )

      expect(
        testModule.oobStateFromDidExchangeRoleAndState(DidExchangeRole.Requester, DidExchangeState.InvitationReceived)
      ).toEqual(OutOfBandState.PrepareResponse)
      expect(
        testModule.oobStateFromDidExchangeRoleAndState(DidExchangeRole.Requester, DidExchangeState.RequestSent)
      ).toEqual(OutOfBandState.Done)
      expect(
        testModule.oobStateFromDidExchangeRoleAndState(DidExchangeRole.Requester, DidExchangeState.ResponseReceived)
      ).toEqual(OutOfBandState.Done)
      expect(
        testModule.oobStateFromDidExchangeRoleAndState(DidExchangeRole.Requester, DidExchangeState.Completed)
      ).toEqual(OutOfBandState.Done)
      expect(
        testModule.oobStateFromDidExchangeRoleAndState(DidExchangeRole.Requester, DidExchangeState.Abandoned)
      ).toEqual(OutOfBandState.Done)
      expect(testModule.oobStateFromDidExchangeRoleAndState(DidExchangeRole.Responder, DidExchangeState.Start)).toEqual(
        OutOfBandState.AwaitResponse
      )
    })
  })

  describe('didExchangeStateFromConnectionRoleAndState', () => {
    it('should return the correct state for all connection role and state combinations', () => {
      expect(
        testModule.didExchangeStateFromConnectionRoleAndState(ConnectionRole.Inviter, ConnectionState.Invited)
      ).toEqual(DidExchangeState.InvitationSent)
      expect(
        testModule.didExchangeStateFromConnectionRoleAndState(ConnectionRole.Inviter, ConnectionState.Requested)
      ).toEqual(DidExchangeState.RequestReceived)
      expect(
        testModule.didExchangeStateFromConnectionRoleAndState(ConnectionRole.Inviter, ConnectionState.Responded)
      ).toEqual(DidExchangeState.ResponseSent)
      expect(
        testModule.didExchangeStateFromConnectionRoleAndState(ConnectionRole.Inviter, ConnectionState.Complete)
      ).toEqual(DidExchangeState.Completed)

      expect(
        testModule.didExchangeStateFromConnectionRoleAndState(ConnectionRole.Invitee, ConnectionState.Invited)
      ).toEqual(DidExchangeState.InvitationReceived)
      expect(
        testModule.didExchangeStateFromConnectionRoleAndState(ConnectionRole.Invitee, ConnectionState.Requested)
      ).toEqual(DidExchangeState.RequestSent)
      expect(
        testModule.didExchangeStateFromConnectionRoleAndState(ConnectionRole.Invitee, ConnectionState.Responded)
      ).toEqual(DidExchangeState.ResponseReceived)
      expect(
        testModule.didExchangeStateFromConnectionRoleAndState(ConnectionRole.Invitee, ConnectionState.Complete)
      ).toEqual(DidExchangeState.Completed)
    })

    it('should return the passed state value if the state or role is not a valid connection role or state', () => {
      expect(
        testModule.didExchangeStateFromConnectionRoleAndState(ConnectionRole.Inviter, 'request-sent' as ConnectionState)
      ).toEqual('request-sent')

      expect(
        testModule.didExchangeStateFromConnectionRoleAndState('responder' as ConnectionRole, ConnectionState.Requested)
      ).toEqual('requested')
    })
  })
})
