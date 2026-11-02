import { Subject } from 'rxjs'
import type { MockedClassConstructor } from '../../../../../../../../../tests/types'
import type { AnonCredsCredentialMetadata } from '../../../../../../../../anoncreds/src/index'
import type { AgentContext } from '../../../../../../../../core/src/agent'
import { EventEmitter } from '../../../../../../../../core/src/agent/EventEmitter'
import {
  getAgentConfig,
  getAgentContext,
  getMockConnection,
  mockFunction,
} from '../../../../../../../../core/tests/helpers'
import { DidCommInboundMessageContext } from '../../../../../../models'
import { DidCommDidExchangeState } from '../../../../../connections'
import type { DidCommRevocationNotificationReceivedEvent } from '../../../../DidCommCredentialEvents'
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

      vi.useFakeTimers({ toFake: ['Date'], now: date })

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
      credentialRecord.setTag('anonCredsRevocationRegistryId', metadata.revocationRegistryId)
      credentialRecord.setTag('anonCredsCredentialRevocationId', metadata.credentialRevocationId)

      mockFunction(credentialRepository.findByQuery).mockResolvedValueOnce([credentialRecord])

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

      vi.useRealTimers()
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

      mockFunction(credentialRepository.findByQuery).mockResolvedValueOnce([])

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

      vi.useFakeTimers({ toFake: ['Date'], now: date })

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

      credentialRecord.setTag('anonCredsRevocationRegistryId', metadata.revocationRegistryId)
      credentialRecord.setTag('anonCredsCredentialRevocationId', metadata.credentialRevocationId)

      mockFunction(credentialRepository.findByQuery).mockResolvedValueOnce([credentialRecord])
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

      vi.useRealTimers()
    })

    test('matches a percent-encoded did:indy revocation registry id with a record that has the id unencoded', async () => {
      const eventListenerMock = vi.fn()
      eventEmitter.on<DidCommRevocationNotificationReceivedEvent>(
        DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
        eventListenerMock
      )

      const did = 'did:indy:sovrin:N7baRMcyvPwWc8v85CtZ6e'
      const credentialRecord = new DidCommCredentialExchangeRecord({
        threadId: 'thread-id',
        protocolVersion: 'v2',
        state: DidCommCredentialState.Done,
        role: DidCommCredentialRole.Holder,
      })
      credentialRecord.setTag(
        'anonCredsRevocationRegistryId',
        `${did}/anoncreds/v0/REV_REG_DEF/100669/SCH Employee ID/1/2`
      )
      credentialRecord.setTag('anonCredsCredentialRevocationId', '1')

      // Same credential revocation id in another revocation registry
      const otherCredentialRecord = new DidCommCredentialExchangeRecord({
        threadId: 'other-thread-id',
        protocolVersion: 'v2',
        state: DidCommCredentialState.Done,
        role: DidCommCredentialRole.Holder,
      })
      otherCredentialRecord.setTag('anonCredsRevocationRegistryId', `${did}/anoncreds/v0/REV_REG_DEF/100669/other/1`)
      otherCredentialRecord.setTag('anonCredsCredentialRevocationId', '1')

      mockFunction(credentialRepository.findByQuery).mockResolvedValueOnce([otherCredentialRecord, credentialRecord])

      const revocationNotificationMessage = new DidCommRevocationNotificationV2Message({
        credentialId: `${did}/anoncreds/v0/REV_REG_DEF/100669/SCH%20Employee%20ID/1%2F2::1`,
        revocationFormat: 'anoncreds',
      })
      await revocationNotificationService.v2ProcessRevocationNotification(
        new DidCommInboundMessageContext(revocationNotificationMessage, { agentContext, connection })
      )

      expect(credentialRepository.findByQuery).toHaveBeenCalledWith(agentContext, {
        anonCredsCredentialRevocationId: '1',
        connectionId: connection.id,
      })
      expect(eventListenerMock).toHaveBeenCalledTimes(1)
      expect(eventListenerMock.mock.calls[0][0].payload.credentialExchangeRecord.threadId).toEqual('thread-id')
      expect(otherCredentialRecord.revocationNotification).toBeUndefined()
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

      mockFunction(credentialRepository.findByQuery).mockResolvedValueOnce([])

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
