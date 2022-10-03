import type { RevocationNotificationReceivedEvent } from '../../../../CredentialEvents'

import { CredentialExchangeRecord, CredentialState, InboundMessageContext } from '../../../../../..'
import { getAgentConfig, getMockConnection, mockFunction } from '../../../../../../../tests/helpers'
import { Dispatcher } from '../../../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../../../agent/EventEmitter'
import { DidExchangeState } from '../../../../../connections'
import { CredentialEventTypes } from '../../../../CredentialEvents'
import { CredentialMetadataKeys } from '../../../../repository'
import { CredentialRepository } from '../../../../repository/CredentialRepository'
import { V1RevocationNotificationMessage, V2RevocationNotificationMessage } from '../../messages'
import { RevocationNotificationService } from '../RevocationNotificationService'

jest.mock('../../../../repository/CredentialRepository')
const CredentialRepositoryMock = CredentialRepository as jest.Mock<CredentialRepository>
const credentialRepository = new CredentialRepositoryMock()

jest.mock('../../../../../../agent/Dispatcher')
const DispatcherMock = Dispatcher as jest.Mock<Dispatcher>
const dispatcher = new DispatcherMock()

const connection = getMockConnection({
  state: DidExchangeState.Completed,
})

describe('RevocationNotificationService', () => {
  let revocationNotificationService: RevocationNotificationService
  let eventEmitter: EventEmitter

  beforeEach(() => {
    const agentConfig = getAgentConfig('RevocationNotificationService', {
      indyLedgers: [],
    })

    eventEmitter = new EventEmitter(agentConfig)
    revocationNotificationService = new RevocationNotificationService(
      credentialRepository,
      eventEmitter,
      agentConfig,
      dispatcher
    )
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('v1ProcessRevocationNotification', () => {
    test('emits revocation notification event if credential record exists for indy thread', async () => {
      const eventListenerMock = jest.fn()

      eventEmitter.on<RevocationNotificationReceivedEvent>(
        CredentialEventTypes.RevocationNotificationReceived,
        eventListenerMock
      )

      const date = new Date('2020-01-01T00:00:00.000Z')

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const dateSpy = jest.spyOn(global, 'Date').mockImplementation(() => date)

      const credentialRecord = new CredentialExchangeRecord({
        threadId: 'thread-id',
        protocolVersion: 'v1',
        state: CredentialState.Done,
      })

      credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
        indyRevocationRegistryId:
          'AsB27X6KRrJFsqZ3unNAH6:4:AsB27X6KRrJFsqZ3unNAH6:3:cl:48187:default:CL_ACCUM:3b24a9b0-a979-41e0-9964-2292f2b1b7e9',
        indyCredentialRevocationId: '1',
      })

      mockFunction(credentialRepository.getSingleByQuery).mockResolvedValueOnce(credentialRecord)
      const { indyRevocationRegistryId, indyCredentialRevocationId } = credentialRecord.getTags()
      const revocationNotificationThreadId = `indy::${indyRevocationRegistryId}::${indyCredentialRevocationId}`

      const revocationNotificationMessage = new V1RevocationNotificationMessage({
        issueThread: revocationNotificationThreadId,
        comment: 'Credential has been revoked',
      })
      const messageContext = new InboundMessageContext(revocationNotificationMessage, {
        connection,
      })

      await revocationNotificationService.v1ProcessRevocationNotification(messageContext)

      const clonedCredentialRecord = eventListenerMock.mock.calls[0][0].payload.credentialRecord
      expect(clonedCredentialRecord.toJSON()).toEqual(credentialRecord.toJSON())

      expect(credentialRecord.revocationNotification).toMatchObject({
        revocationDate: date,
        comment: 'Credential has been revoked',
      })

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'RevocationNotificationReceived',
        payload: {
          credentialRecord: expect.any(CredentialExchangeRecord),
        },
      })

      dateSpy.mockRestore()
    })

    test('does not emit revocation notification event if no credential record exists for indy thread', async () => {
      const eventListenerMock = jest.fn()

      eventEmitter.on<RevocationNotificationReceivedEvent>(
        CredentialEventTypes.RevocationNotificationReceived,
        eventListenerMock
      )

      const revocationRegistryId =
        'ABC12D3EFgHIjKL4mnOPQ5:4:AsB27X6KRrJFsqZ3unNAH6:3:cl:48187:default:CL_ACCUM:3b24a9b0-a979-41e0-9964-2292f2b1b7e9'
      const credentialRevocationId = '2'
      const revocationNotificationThreadId = `indy::${revocationRegistryId}::${credentialRevocationId}`

      mockFunction(credentialRepository.getSingleByQuery).mockRejectedValueOnce(new Error('Could not find record'))

      const revocationNotificationMessage = new V1RevocationNotificationMessage({
        issueThread: revocationNotificationThreadId,
        comment: 'Credential has been revoked',
      })
      const messageContext = new InboundMessageContext(revocationNotificationMessage, { connection })

      await revocationNotificationService.v1ProcessRevocationNotification(messageContext)

      expect(eventListenerMock).not.toHaveBeenCalled()
    })

    test('does not emit revocation notification event if invalid threadId is passed', async () => {
      const eventListenerMock = jest.fn()

      eventEmitter.on<RevocationNotificationReceivedEvent>(
        CredentialEventTypes.RevocationNotificationReceived,
        eventListenerMock
      )

      const revocationNotificationThreadId = 'notIndy::invalidRevRegId::invalidCredRevId'
      const revocationNotificationMessage = new V1RevocationNotificationMessage({
        issueThread: revocationNotificationThreadId,
        comment: 'Credential has been revoked',
      })
      const messageContext = new InboundMessageContext(revocationNotificationMessage)

      await revocationNotificationService.v1ProcessRevocationNotification(messageContext)

      expect(eventListenerMock).not.toHaveBeenCalled()
    })
  })

  describe('v2ProcessRevocationNotification', () => {
    test('emits revocation notification event if credential record exists for indy thread', async () => {
      const eventListenerMock = jest.fn()

      eventEmitter.on<RevocationNotificationReceivedEvent>(
        CredentialEventTypes.RevocationNotificationReceived,
        eventListenerMock
      )

      const date = new Date('2020-01-01T00:00:00.000Z')

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const dateSpy = jest.spyOn(global, 'Date').mockImplementation(() => date)

      const credentialRecord = new CredentialExchangeRecord({
        threadId: 'thread-id',
        protocolVersion: 'v2',
        state: CredentialState.Done,
      })

      credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
        indyRevocationRegistryId:
          'AsB27X6KRrJFsqZ3unNAH6:4:AsB27X6KRrJFsqZ3unNAH6:3:cl:48187:default:CL_ACCUM:3b24a9b0-a979-41e0-9964-2292f2b1b7e9',
        indyCredentialRevocationId: '1',
      })

      mockFunction(credentialRepository.getSingleByQuery).mockResolvedValueOnce(credentialRecord)
      const { indyRevocationRegistryId, indyCredentialRevocationId } = credentialRecord.getTags()
      const revocationNotificationCredentialId = `${indyRevocationRegistryId}::${indyCredentialRevocationId}`

      const revocationNotificationMessage = new V2RevocationNotificationMessage({
        credentialId: revocationNotificationCredentialId,
        revocationFormat: 'indy-anoncreds',
        comment: 'Credential has been revoked',
      })
      const messageContext = new InboundMessageContext(revocationNotificationMessage, {
        connection,
      })

      await revocationNotificationService.v2ProcessRevocationNotification(messageContext)

      const clonedCredentialRecord = eventListenerMock.mock.calls[0][0].payload.credentialRecord
      expect(clonedCredentialRecord.toJSON()).toEqual(credentialRecord.toJSON())

      expect(credentialRecord.revocationNotification).toMatchObject({
        revocationDate: date,
        comment: 'Credential has been revoked',
      })

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'RevocationNotificationReceived',
        payload: {
          credentialRecord: expect.any(CredentialExchangeRecord),
        },
      })

      dateSpy.mockRestore()
    })

    test('does not emit revocation notification event if no credential record exists for indy thread', async () => {
      const eventListenerMock = jest.fn()

      eventEmitter.on<RevocationNotificationReceivedEvent>(
        CredentialEventTypes.RevocationNotificationReceived,
        eventListenerMock
      )

      const revocationRegistryId =
        'ABC12D3EFgHIjKL4mnOPQ5:4:AsB27X6KRrJFsqZ3unNAH6:3:cl:48187:default:CL_ACCUM:3b24a9b0-a979-41e0-9964-2292f2b1b7e9'
      const credentialRevocationId = '2'
      const credentialId = `${revocationRegistryId}::${credentialRevocationId}`

      mockFunction(credentialRepository.getSingleByQuery).mockRejectedValueOnce(new Error('Could not find record'))

      const revocationNotificationMessage = new V2RevocationNotificationMessage({
        credentialId,
        revocationFormat: 'indy-anoncreds',
        comment: 'Credential has been revoked',
      })
      const messageContext = new InboundMessageContext(revocationNotificationMessage, { connection })

      await revocationNotificationService.v2ProcessRevocationNotification(messageContext)

      expect(eventListenerMock).not.toHaveBeenCalled()
    })

    test('does not emit revocation notification event if invalid threadId is passed', async () => {
      const eventListenerMock = jest.fn()

      eventEmitter.on<RevocationNotificationReceivedEvent>(
        CredentialEventTypes.RevocationNotificationReceived,
        eventListenerMock
      )

      const invalidCredentialId = 'notIndy::invalidRevRegId::invalidCredRevId'
      const revocationNotificationMessage = new V2RevocationNotificationMessage({
        credentialId: invalidCredentialId,
        revocationFormat: 'indy-anoncreds',
        comment: 'Credential has been revoked',
      })
      const messageContext = new InboundMessageContext(revocationNotificationMessage)

      await revocationNotificationService.v2ProcessRevocationNotification(messageContext)

      expect(eventListenerMock).not.toHaveBeenCalled()
    })
  })
})
