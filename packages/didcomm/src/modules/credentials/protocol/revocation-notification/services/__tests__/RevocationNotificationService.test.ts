import { Kms, TypedArrayEncoder } from '@credo-ts/core'
import { Subject } from 'rxjs'
import type { Mock } from 'vitest'
import type { MockedClassConstructor } from '../../../../../../../../../tests/types'
import type { AgentContext } from '../../../../../../../../core/src/agent'
import { EventEmitter } from '../../../../../../../../core/src/agent/EventEmitter'
import { verkeyToPublicJwk } from '../../../../../../../../core/src/modules/dids/helpers'
import type { DidRepository } from '../../../../../../../../core/src/modules/dids/repository'
import {
  getAgentConfig,
  getAgentContext,
  getMockConnection,
  mockFunction,
} from '../../../../../../../../core/tests/helpers'
import { DidCommMessage } from '../../../../../../DidCommMessage'
import { DidCommInboundMessageContext } from '../../../../../../models'
import { DidCommConnectionService, DidCommDidExchangeState } from '../../../../../connections'
import type { DidCommConnectionRepository } from '../../../../../connections/repository/DidCommConnectionRepository'
import { DidCommOutOfBandService } from '../../../../../oob/DidCommOutOfBandService'
import { DidCommOutOfBandRepository } from '../../../../../oob/repository/DidCommOutOfBandRepository'
import type { DidCommRevocationNotificationReceivedEvent } from '../../../../DidCommCredentialEvents'
import { DidCommCredentialEventTypes } from '../../../../DidCommCredentialEvents'
import { DidCommCredentialsModuleConfig } from '../../../../DidCommCredentialsModuleConfig'
import { DidCommCredentialRole, DidCommCredentialState } from '../../../../models'
import { DidCommCredentialExchangeRecord } from '../../../../repository'
import { DidCommCredentialExchangeRepository } from '../../../../repository/DidCommCredentialExchangeRepository'
import type { DidCommCredentialProtocol } from '../../../DidCommCredentialProtocol'
import type { DidCommRevocationNotificationFormatService } from '../../DidCommRevocationNotificationFormatService'
import { DidCommRevocationNotificationV2Message } from '../../messages'
import { DidCommRevocationNotificationService } from '../DidCommRevocationNotificationService'

const testSenderKey = Kms.PublicJwk.fromPublicKey({
  kty: 'OKP',
  crv: 'Ed25519',
  publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
}) as Kms.PublicJwk<Kms.Ed25519PublicJwk>

vi.mock('../../../../repository/DidCommCredentialExchangeRepository')
const CredentialRepositoryMock = DidCommCredentialExchangeRepository as MockedClassConstructor<
  typeof DidCommCredentialExchangeRepository
>
const credentialRepository = new CredentialRepositoryMock()

vi.mock('../../../../../oob/repository/DidCommOutOfBandRepository')
const OutOfBandRepositoryMock = DidCommOutOfBandRepository as MockedClassConstructor<typeof DidCommOutOfBandRepository>
const outOfBandRepository = new OutOfBandRepositoryMock()

vi.mock('../../../../../oob/DidCommOutOfBandService')
const OutOfBandServiceMock = DidCommOutOfBandService as MockedClassConstructor<typeof DidCommOutOfBandService>
const outOfBandService = new OutOfBandServiceMock()

const credentialProtocol = {
  version: 'v2',
  findCredentialMessage: vi.fn(),
  findRequestMessage: vi.fn(),
} as unknown as DidCommCredentialProtocol

const findCredentialExchangeRecord = vi.fn<DidCommRevocationNotificationFormatService['findCredentialExchangeRecord']>()
const getCredentialId = vi.fn<DidCommRevocationNotificationFormatService['getCredentialId']>()
const revocationNotificationFormatService = {
  supportedRevocationFormats: ['indy-anoncreds', 'anoncreds'],
  findCredentialExchangeRecord,
  getCredentialId,
} satisfies DidCommRevocationNotificationFormatService

const issuerVerkey = 'EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'
const otherVerkey = '5UQ3drtEMMQXaLLmEywbciW92jZaQgRYgfuzXfonV8iz'
const holderVerkey = '6fioC1zcDPyPEL19pXRS2E4iJ46zH7xP6uSgAaPdwDrx'

const revocationRegistryId =
  'AsB27X6KRrJFsqZ3unNAH6:4:AsB27X6KRrJFsqZ3unNAH6:3:cl:48187:default:CL_ACCUM:3b24a9b0-a979-41e0-9964-2292f2b1b7e9'
const credentialRevocationId = '1'
const credentialId = `${revocationRegistryId}::${credentialRevocationId}`

const connection = getMockConnection({
  state: DidCommDidExchangeState.Completed,
})

describe('DidCommRevocationNotificationService', () => {
  let revocationNotificationService: DidCommRevocationNotificationService
  let agentContext: AgentContext
  let eventEmitter: EventEmitter
  let agentConfig: ReturnType<typeof getAgentConfig>

  beforeEach(() => {
    agentConfig = getAgentConfig('RevocationNotificationService')
    agentContext = getAgentContext({
      registerInstances: [
        [DidCommOutOfBandRepository, outOfBandRepository],
        [DidCommOutOfBandService, outOfBandService],
        [
          DidCommCredentialsModuleConfig,
          new DidCommCredentialsModuleConfig({
            credentialProtocols: [credentialProtocol],
            revocationNotificationFormats: [revocationNotificationFormatService],
          }),
        ],
        [
          DidCommConnectionService,
          new DidCommConnectionService(
            agentConfig.logger,
            {} as DidCommConnectionRepository,
            {} as DidRepository,
            new EventEmitter(agentConfig.agentDependencies, new Subject())
          ),
        ],
      ],
    })

    eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
    revocationNotificationService = new DidCommRevocationNotificationService(
      credentialRepository,
      eventEmitter,
      agentConfig.logger
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  test('dispatches to the registered format service and emits the event', async () => {
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
    mockFunction(findCredentialExchangeRecord).mockResolvedValueOnce(credentialRecord)

    const message = new DidCommRevocationNotificationV2Message({
      credentialId,
      revocationFormat: 'indy-anoncreds',
      comment: 'Credential has been revoked',
    })
    await revocationNotificationService.v2ProcessRevocationNotification(
      new DidCommInboundMessageContext(message, { senderKey: testSenderKey, connection, agentContext })
    )

    expect(findCredentialExchangeRecord).toHaveBeenCalledWith(
      agentContext,
      credentialId,
      'indy-anoncreds',
      connection.id
    )
    expect(credentialRecord.revocationNotification).toMatchObject({
      revocationDate: date,
      comment: 'Credential has been revoked',
    })
    expect(credentialRepository.update).toHaveBeenCalledWith(agentContext, credentialRecord)
    expect(eventListenerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
        payload: { credentialExchangeRecord: expect.any(DidCommCredentialExchangeRecord) },
      })
    )
    expect(eventListenerMock.mock.calls[0][0].payload.credentialExchangeRecord.toJSON()).toEqual(
      credentialRecord.toJSON()
    )
  })

  test('rejects unknown revocation formats', async () => {
    const message = new DidCommRevocationNotificationV2Message({
      credentialId,
      revocationFormat: 'unknown',
    })

    await expect(
      revocationNotificationService.v2ProcessRevocationNotification(
        new DidCommInboundMessageContext(message, { agentContext })
      )
    ).rejects.toThrow('Unknown revocation format: unknown')
    expect(findCredentialExchangeRecord).not.toHaveBeenCalled()
  })

  test('logs and ignores a notification when no matching credential record is found', async () => {
    const warnSpy = vi.spyOn(agentConfig.logger, 'warn')
    mockFunction(findCredentialExchangeRecord).mockRejectedValueOnce(new Error('No matching credential record'))
    const message = new DidCommRevocationNotificationV2Message({
      credentialId,
      revocationFormat: 'anoncreds',
    })

    await revocationNotificationService.v2ProcessRevocationNotification(
      new DidCommInboundMessageContext(message, { agentContext, connection, senderKey: testSenderKey })
    )

    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to process revocation notification message',
      expect.objectContaining({ error: expect.objectContaining({ message: 'No matching credential record' }) })
    )
    expect(credentialRepository.update).not.toHaveBeenCalled()
  })

  describe('connectionless notifications', () => {
    let eventListenerMock: Mock<(event: DidCommRevocationNotificationReceivedEvent) => void>
    let credentialRecord: DidCommCredentialExchangeRecord
    let warnSpy: Mock

    const messageWithService = (recipientKey: string) => {
      const message = new DidCommMessage()
      message.setService({ recipientKeys: [recipientKey], routingKeys: [], serviceEndpoint: 'rxjs:agent' })
      return message
    }

    beforeEach(() => {
      eventListenerMock = vi.fn()
      eventEmitter.on<DidCommRevocationNotificationReceivedEvent>(
        DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
        eventListenerMock
      )
      warnSpy = vi.spyOn(agentConfig.logger, 'warn') as unknown as Mock

      credentialRecord = new DidCommCredentialExchangeRecord({
        id: 'credential-record-id',
        threadId: 'thread-id',
        protocolVersion: 'v2',
        state: DidCommCredentialState.Done,
        role: DidCommCredentialRole.Holder,
      })
      credentialRecord.setTag('anonCredsRevocationRegistryId', revocationRegistryId)
      credentialRecord.setTag('anonCredsCredentialRevocationId', credentialRevocationId)

      mockFunction(findCredentialExchangeRecord).mockResolvedValue(credentialRecord)
      mockFunction(outOfBandRepository.findSingleByQuery).mockResolvedValue(null)
      mockFunction(credentialProtocol.findCredentialMessage).mockResolvedValue(messageWithService(issuerVerkey))
      mockFunction(credentialProtocol.findRequestMessage).mockResolvedValue(messageWithService(holderVerkey))
    })

    const message = () =>
      new DidCommRevocationNotificationV2Message({
        credentialId,
        revocationFormat: 'anoncreds',
        comment: 'Credential has been revoked',
      })

    const process = async ({
      senderVerkey,
      recipientVerkey = holderVerkey,
      serviceVerkey = issuerVerkey,
    }: {
      senderVerkey?: string
      recipientVerkey?: string
      serviceVerkey?: string
    } = {}) => {
      const notification = message()
      notification.setService({ recipientKeys: [serviceVerkey], routingKeys: [], serviceEndpoint: 'rxjs:issuer' })
      await revocationNotificationService.v2ProcessRevocationNotification(
        new DidCommInboundMessageContext(notification, {
          agentContext,
          senderKey: senderVerkey ? verkeyToPublicJwk(senderVerkey) : undefined,
          recipientKey: verkeyToPublicJwk(recipientVerkey),
        })
      )
    }

    const expectRefused = (reason: string) => {
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to process revocation notification message',
        expect.objectContaining({ error: expect.objectContaining({ message: expect.stringContaining(reason) }) })
      )
      expect(credentialRecord.revocationNotification).toBeUndefined()
      expect(credentialRepository.update).not.toHaveBeenCalled()
      expect(eventListenerMock).not.toHaveBeenCalled()
    }

    test('accepts a notification authcrypted with the issuer key', async () => {
      await process({ senderVerkey: issuerVerkey })

      expect(findCredentialExchangeRecord).toHaveBeenCalledWith(agentContext, credentialId, 'anoncreds', undefined)
      expect(credentialProtocol.findCredentialMessage).toHaveBeenCalledWith(agentContext, credentialRecord.id)
      expect(credentialProtocol.findRequestMessage).toHaveBeenCalledWith(agentContext, credentialRecord.id)
      expect(credentialRecord.revocationNotification).toMatchObject({ comment: 'Credential has been revoked' })
      expect(credentialRepository.update).toHaveBeenCalledWith(agentContext, credentialRecord)
      expect(eventListenerMock).toHaveBeenCalledTimes(1)
    })

    test('refuses a credential received over a connection when the notification has no connection', async () => {
      credentialRecord.connectionId = connection.id

      await process({ senderVerkey: issuerVerkey })

      expectRefused(`Expected incoming message to be from connection ${connection.id} but no connection found.`)
    })

    test('refuses a notification authcrypted with another key', async () => {
      await process({ senderVerkey: otherVerkey })

      expectRefused('not found in their service')
    })

    test('refuses a notification that authenticates a key only in its own service', async () => {
      await process({ senderVerkey: otherVerkey, serviceVerkey: otherVerkey })

      expectRefused('not found in the ~service of credential message')
    })

    test('refuses a notification when the credential message has no service', async () => {
      mockFunction(credentialProtocol.findCredentialMessage).mockResolvedValue(new DidCommMessage())

      await process({ senderVerkey: issuerVerkey })

      expectRefused('not found in the ~service of credential message')
    })

    test('refuses an anoncrypted notification', async () => {
      await process()

      expectRefused('Incoming message must have recipientKey and senderKey')
    })

    test('refuses a notification encrypted to a key outside our request service', async () => {
      await process({ senderVerkey: issuerVerkey, recipientVerkey: otherVerkey })

      expectRefused('not found in our service')
    })

    test('refuses a notification when no credential message is stored', async () => {
      mockFunction(credentialProtocol.findCredentialMessage).mockResolvedValue(null)

      await process({ senderVerkey: issuerVerkey })

      expectRefused('No credential message found')
    })

    test('does not perform connectionless sender-key checks for connected messages', async () => {
      const notification = message()
      await revocationNotificationService.v2ProcessRevocationNotification(
        new DidCommInboundMessageContext(notification, {
          agentContext,
          connection,
          senderKey: verkeyToPublicJwk(otherVerkey),
        })
      )

      expect(findCredentialExchangeRecord).toHaveBeenCalledWith(agentContext, credentialId, 'anoncreds', connection.id)
      expect(credentialProtocol.findCredentialMessage).not.toHaveBeenCalled()
      expect(eventListenerMock).toHaveBeenCalledTimes(1)
    })
  })
})
