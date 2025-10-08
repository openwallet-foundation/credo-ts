import type { AnonCredsCredentialMetadata } from '../../../../../../../../anoncreds/src/index'
import type { AgentContext } from '../../../../../../../../core/src/agent'
import type { DidCommRevocationNotificationReceivedEvent } from '../../../../DidCommCredentialEvents'

import { Subject } from 'rxjs'

import type { MockedClassConstructor } from '../../../../../../../../../tests/types'
import { EventEmitter } from '../../../../../../../../core/src/agent/EventEmitter'
import {
  getAgentConfig,
  getAgentContext,
  getMockConnection,
  mockFunction,
} from '../../../../../../../../core/tests/helpers'
import { DidCommMessageHandlerRegistry } from '../../../../../../DidCommMessageHandlerRegistry'
import { DidCommInboundMessageContext } from '../../../../../../models'
import { DidCommDidExchangeState } from '../../../../../connections'
import { DidCommCredentialEventTypes } from '../../../../DidCommCredentialEvents'
import { DidCommCredentialRole, DidCommCredentialState } from '../../../../models'
import { DidCommCredentialExchangeRecord } from '../../../../repository'
import { DidCommCredentialExchangeRepository } from '../../../../repository/DidCommCredentialExchangeRepository'
import { DidCommRevocationNotificationV1Message, DidCommRevocationNotificationV2Message } from '../../messages'
import { DidCommRevocationNotificationService } from '../DidCommRevocationNotificationService'

vi.mock('../../../../repository/DidCommCredentialExchangeRepository')
const CredentialRepositoryMock = DidCommCredentialExchangeRepository as MockedClassConstructor<
  typeof DidCommCredentialExchangeRepository
>
const credentialRepository = new CredentialRepositoryMock()

vi.mock('../../../../../../DidCommMessageHandlerRegistry')
const MessageHandlerRegistryMock = DidCommMessageHandlerRegistry as MockedClassConstructor<
  typeof DidCommMessageHandlerRegistry
>
const messageHandlerRegistry = new MessageHandlerRegistryMock()

const connection = getMockConnection({
  state: DidCommDidExchangeState.Completed,
})

describe('RevocationNotificationService', () => {
  let revocationNotificationService: DidCommRevocationNotificationService
  let agentContext: AgentContext
  let eventEmitter: EventEmitter

  beforeEach(() => {
    const agentConfig = getAgentConfig('RevocationNotificationService')

    agentContext = getAgentContext()

    eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
    revocationNotificationService = new DidCommRevocationNotificationService(
      credentialRepository,
      eventEmitter,
      messageHandlerRegistry,
      agentConfig.logger
    )
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('v1ProcessRevocationNotification', () => {
    test('emits revocation notification event if credential record exists for indy thread', async () => {
      const eventListenerMock = vi.fn()

      eventEmitter.on<DidCommRevocationNotificationReceivedEvent>(
        DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
        eventListenerMock
      )

      const date = new Date('2020-01-01T00:00:00.000Z')

      // @ts-ignore
      const dateSpy = vi.spyOn(global, 'Date').mockImplementation(() => date)

      const credentialRecord = new DidCommCredentialExchangeRecord({
        threadId: 'thread-id',
        protocolVersion: 'v1',
        state: DidCommCredentialState.Done,
        role: DidCommCredentialRole.Holder,
      })

      const metadata = {
        revocationRegistryId:
          'AsB27X6KRrJFsqZ3unNAH6:4:AsB27X6KRrJFsqZ3unNAH6:3:cl:48187:default:CL_ACCUM:3b24a9b0-a979-41e0-9964-2292f2b1b7e9',
        credentialRevocationId: '1',
      } satisfies AnonCredsCredentialMetadata

      // Set required tags
      credentialRecord.setTag('anonCredsUnqualifiedRevocationRegistryId', metadata.revocationRegistryId)
      credentialRecord.setTag('anonCredsCredentialRevocationId', metadata.credentialRevocationId)

      mockFunction(credentialRepository.getSingleByQuery).mockResolvedValueOnce(credentialRecord)

      const revocationNotificationThreadId = `indy::${metadata.revocationRegistryId}::${metadata.credentialRevocationId}`
      const revocationNotificationMessage = new DidCommRevocationNotificationV1Message({
        issueThread: revocationNotificationThreadId,
        comment: 'Credential has been revoked',
      })
      const messageContext = new DidCommInboundMessageContext(revocationNotificationMessage, {
        connection,
        agentContext,
      })

      await revocationNotificationService.v1ProcessRevocationNotification(messageContext)

      const clonedCredentialRecord = eventListenerMock.mock.calls[0][0].payload.credentialExchangeRecord
      expect(clonedCredentialRecord.toJSON()).toEqual(credentialRecord.toJSON())

      expect(credentialRecord.revocationNotification).toMatchObject({
        revocationDate: date,
        comment: 'Credential has been revoked',
      })

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'DidCommRevocationNotificationReceived',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          credentialExchangeRecord: expect.any(DidCommCredentialExchangeRecord),
        },
      })

      dateSpy.mockRestore()
    })

    test('does not emit revocation notification event if no credential record exists for indy thread', async () => {
      const eventListenerMock = vi.fn()

      eventEmitter.on<DidCommRevocationNotificationReceivedEvent>(
        DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
        eventListenerMock
      )

      const revocationRegistryId =
        'ABC12D3EFgHIjKL4mnOPQ5:4:AsB27X6KRrJFsqZ3unNAH6:3:cl:48187:default:CL_ACCUM:3b24a9b0-a979-41e0-9964-2292f2b1b7e9'
      const credentialRevocationId = '2'
      const revocationNotificationThreadId = `indy::${revocationRegistryId}::${credentialRevocationId}`

      mockFunction(credentialRepository.getSingleByQuery).mockRejectedValueOnce(new Error('Could not find record'))

      const revocationNotificationMessage = new DidCommRevocationNotificationV1Message({
        issueThread: revocationNotificationThreadId,
        comment: 'Credential has been revoked',
      })
      const messageContext = new DidCommInboundMessageContext(revocationNotificationMessage, {
        connection,
        agentContext,
      })

      await revocationNotificationService.v1ProcessRevocationNotification(messageContext)

      expect(eventListenerMock).not.toHaveBeenCalled()
    })

    test('does not emit revocation notification event if invalid threadId is passed', async () => {
      const eventListenerMock = vi.fn()

      eventEmitter.on<DidCommRevocationNotificationReceivedEvent>(
        DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
        eventListenerMock
      )

      const revocationNotificationThreadId = 'notIndy::invalidRevRegId::invalidCredRevId'
      const revocationNotificationMessage = new DidCommRevocationNotificationV1Message({
        issueThread: revocationNotificationThreadId,
        comment: 'Credential has been revoked',
      })
      const messageContext = new DidCommInboundMessageContext(revocationNotificationMessage, { agentContext })

      await revocationNotificationService.v1ProcessRevocationNotification(messageContext)

      expect(eventListenerMock).not.toHaveBeenCalled()
    })
  })

  describe('v2ProcessRevocationNotification', () => {
    test('emits revocation notification event if credential record exists for indy thread', async () => {
      const eventListenerMock = vi.fn()

      eventEmitter.on<DidCommRevocationNotificationReceivedEvent>(
        DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
        eventListenerMock
      )

      const date = new Date('2020-01-01T00:00:00.000Z')

      // @ts-ignore
      const dateSpy = vi.spyOn(global, 'Date').mockImplementation(() => date)

      const credentialRecord = new DidCommCredentialExchangeRecord({
        threadId: 'thread-id',
        protocolVersion: 'v2',
        state: DidCommCredentialState.Done,
        role: DidCommCredentialRole.Holder,
      })

      const metadata = {
        revocationRegistryId:
          'AsB27X6KRrJFsqZ3unNAH6:4:AsB27X6KRrJFsqZ3unNAH6:3:cl:48187:default:CL_ACCUM:3b24a9b0-a979-41e0-9964-2292f2b1b7e9',
        credentialRevocationId: '1',
      }

      mockFunction(credentialRepository.getSingleByQuery).mockResolvedValueOnce(credentialRecord)
      const revocationNotificationCredentialId = `${metadata.revocationRegistryId}::${metadata.credentialRevocationId}`

      const revocationNotificationMessage = new DidCommRevocationNotificationV2Message({
        credentialId: revocationNotificationCredentialId,
        revocationFormat: 'indy-anoncreds',
        comment: 'Credential has been revoked',
      })
      const messageContext = new DidCommInboundMessageContext(revocationNotificationMessage, {
        agentContext,
        connection,
      })

      await revocationNotificationService.v2ProcessRevocationNotification(messageContext)

      const clonedCredentialRecord = eventListenerMock.mock.calls[0][0].payload.credentialExchangeRecord
      expect(clonedCredentialRecord.toJSON()).toEqual(credentialRecord.toJSON())

      expect(credentialRecord.revocationNotification).toMatchObject({
        revocationDate: date,
        comment: 'Credential has been revoked',
      })

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'DidCommRevocationNotificationReceived',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          credentialExchangeRecord: expect.any(DidCommCredentialExchangeRecord),
        },
      })

      dateSpy.mockRestore()
    })

    test('does not emit revocation notification event if no credential record exists for indy thread', async () => {
      const eventListenerMock = vi.fn()

      eventEmitter.on<DidCommRevocationNotificationReceivedEvent>(
        DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
        eventListenerMock
      )

      const revocationRegistryId =
        'ABC12D3EFgHIjKL4mnOPQ5:4:AsB27X6KRrJFsqZ3unNAH6:3:cl:48187:default:CL_ACCUM:3b24a9b0-a979-41e0-9964-2292f2b1b7e9'
      const credentialRevocationId = '2'
      const credentialId = `${revocationRegistryId}::${credentialRevocationId}`

      mockFunction(credentialRepository.getSingleByQuery).mockRejectedValueOnce(new Error('Could not find record'))

      const revocationNotificationMessage = new DidCommRevocationNotificationV2Message({
        credentialId,
        revocationFormat: 'indy-anoncreds',
        comment: 'Credential has been revoked',
      })
      const messageContext = new DidCommInboundMessageContext(revocationNotificationMessage, {
        connection,
        agentContext,
      })

      await revocationNotificationService.v2ProcessRevocationNotification(messageContext)

      expect(eventListenerMock).not.toHaveBeenCalled()
    })

    test('does not emit revocation notification event if invalid threadId is passed', async () => {
      const eventListenerMock = vi.fn()

      eventEmitter.on<DidCommRevocationNotificationReceivedEvent>(
        DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
        eventListenerMock
      )

      const invalidCredentialId = 'notIndy::invalidRevRegId::invalidCredRevId'
      const revocationNotificationMessage = new DidCommRevocationNotificationV2Message({
        credentialId: invalidCredentialId,
        revocationFormat: 'indy-anoncreds',
        comment: 'Credential has been revoked',
      })
      const messageContext = new DidCommInboundMessageContext(revocationNotificationMessage, { agentContext })

      await revocationNotificationService.v2ProcessRevocationNotification(messageContext)

      expect(eventListenerMock).not.toHaveBeenCalled()
    })
  })
})
