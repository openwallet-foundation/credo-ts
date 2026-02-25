import { readFileSync } from 'fs'
import path from 'path'
import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { InMemoryWalletModule } from '../../../../../../tests/InMemoryWalletModule'
import { DidCommModule } from '../../../../../didcomm/src'
import { agentDependencies } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { InjectionSymbols } from '../../../constants'
import { W3cCredentialsModule } from '../../../modules/vc'
import { customDocumentLoader } from '../../../modules/vc/data-integrity/__tests__/documentLoader'
import * as uuid from '../../../utils/uuid'
import { UpdateAssistant } from '../UpdateAssistant'

const backupDate = new Date('2024-02-05T22:50:20.522Z')
vi.useFakeTimers().setSystemTime(backupDate)

describe('UpdateAssistant | v0.4 - v0.5', () => {
  it(`should correctly add 'type' tag to w3c records`, async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = vi.spyOn(uuid, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceW3cCredentialRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-2-w3c-credential-records-0.4.json'),
      'utf8'
    )

    const agent = new Agent({
      config: {},
      dependencies: agentDependencies,
      modules: {
        inMemory: new InMemoryWalletModule(),
        w3cCredentials: new W3cCredentialsModule({
          documentLoader: customDocumentLoader,
        }),
      },
    })

    const storageService = agent.context.resolve<InMemoryStorageService>(InjectionSymbols.StorageService)
    const updateAssistant = new UpdateAssistant(agent, {
      v0_1ToV0_2: {
        mediationRoleUpdateStrategy: 'doNotChange',
      },
    })

    await updateAssistant.initialize()

    // Set storage after initialization. This mimics as if this wallet
    // is opened as an existing wallet instead of a new wallet
    storageService.contextCorrelationIdToRecords = {
      default: {
        records: JSON.parse(aliceW3cCredentialRecordsString),
        creationDate: new Date(),
      },
    }

    expect(await updateAssistant.isUpToDate('0.5')).toBe(false)
    expect(await updateAssistant.getNeededUpdates('0.5')).toEqual([
      {
        fromVersion: '0.4',
        toVersion: '0.5',
        doUpdate: expect.any(Function),
      },
    ])

    await updateAssistant.update()

    expect(await updateAssistant.isUpToDate()).toBe(true)
    expect(await updateAssistant.getNeededUpdates('0.5')).toEqual([])

    expect(storageService.contextCorrelationIdToRecords[agent.context.contextCorrelationId].records).toMatchSnapshot()

    await agent.shutdown()

    uuidSpy.mockReset()
  })

  it('should correctly add role to credential exchange records', async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = vi.spyOn(uuid, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceW3cCredentialRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/2-credentials-0.4.json'),
      'utf8'
    )

    // We need core DIDComm modules for this update to fully work
    const agent = new Agent({
      config: {},
      modules: { didcomm: new DidCommModule(), inMemory: new InMemoryWalletModule() },
      dependencies: agentDependencies,
    })

    const storageService = agent.context.resolve<InMemoryStorageService>(InjectionSymbols.StorageService)
    const updateAssistant = new UpdateAssistant(agent, {
      v0_1ToV0_2: {
        mediationRoleUpdateStrategy: 'doNotChange',
      },
    })

    await updateAssistant.initialize()

    // Set storage after initialization. This mimics as if this wallet
    // is opened as an existing wallet instead of a new wallet
    storageService.contextCorrelationIdToRecords = {
      default: {
        records: JSON.parse(aliceW3cCredentialRecordsString),
        creationDate: new Date(),
      },
    }

    expect(await updateAssistant.isUpToDate('0.5')).toBe(false)
    expect(await updateAssistant.getNeededUpdates('0.5')).toEqual([
      {
        fromVersion: '0.4',
        toVersion: '0.5',
        doUpdate: expect.any(Function),
      },
    ])

    await updateAssistant.update()

    expect(await updateAssistant.isUpToDate()).toBe(true)
    expect(await updateAssistant.getNeededUpdates('0.5')).toEqual([])

    expect(storageService.contextCorrelationIdToRecords[agent.context.contextCorrelationId].records).toMatchSnapshot()

    await agent.shutdown()

    uuidSpy.mockReset()
  })

  it('should correctly add role to proof exchange records', async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = vi.spyOn(uuid, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceW3cCredentialRecordsString = readFileSync(path.join(__dirname, '__fixtures__/2-proofs-0.4.json'), 'utf8')

    // We need core DIDComm modules for this update to fully work
    const agent = new Agent({
      config: {},
      modules: { didcomm: new DidCommModule(), inMemory: new InMemoryWalletModule() },
      dependencies: agentDependencies,
    })

    const storageService = agent.context.resolve<InMemoryStorageService>(InjectionSymbols.StorageService)
    const updateAssistant = new UpdateAssistant(agent, {
      v0_1ToV0_2: {
        mediationRoleUpdateStrategy: 'doNotChange',
      },
    })

    await updateAssistant.initialize()

    // Set storage after initialization. This mimics as if this wallet
    // is opened as an existing wallet instead of a new wallet
    storageService.contextCorrelationIdToRecords = {
      default: {
        records: JSON.parse(aliceW3cCredentialRecordsString),
        creationDate: new Date(),
      },
    }

    expect(await updateAssistant.isUpToDate('0.5')).toBe(false)
    expect(await updateAssistant.getNeededUpdates('0.5')).toEqual([
      {
        fromVersion: '0.4',
        toVersion: '0.5',
        doUpdate: expect.any(Function),
      },
    ])

    await updateAssistant.update()

    expect(await updateAssistant.isUpToDate()).toBe(true)
    expect(await updateAssistant.getNeededUpdates('0.5')).toEqual([])

    expect(storageService.contextCorrelationIdToRecords[agent.context.contextCorrelationId].records).toMatchSnapshot()

    await agent.shutdown()

    uuidSpy.mockReset()
  })
})
