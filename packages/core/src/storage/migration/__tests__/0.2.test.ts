import { readFileSync } from 'fs'
import path from 'path'

import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { InMemoryWalletModule } from '../../../../../../tests/InMemoryWalletModule'
import { MediatorRoutingRecord } from '../../../../../didcomm/src/modules'
import { getDefaultDidcommModules } from '../../../../../didcomm/src/util/modules'
import { Agent } from '../../../../src'
import { agentDependencies } from '../../../../tests/helpers'
import { InjectionSymbols } from '../../../constants'
import * as uuid from '../../../utils/uuid'
import { UpdateAssistant } from '../UpdateAssistant'

const backupDate = new Date('2023-01-21T22:50:20.522Z')
jest.useFakeTimers().setSystemTime(backupDate)

describe('UpdateAssistant | v0.2 - v0.3.1', () => {
  it('should correctly update proof records and create didcomm records', async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = jest.spyOn(uuid, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceCredentialRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-4-proofs-0.2.json'),
      'utf8'
    )

    const agent = new Agent({
      config: {
        label: 'Test Agent',
      },
      dependencies: agentDependencies,
      modules: {
        inMemory: new InMemoryWalletModule(),
        ...getDefaultDidcommModules(),
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
        records: JSON.parse(aliceCredentialRecordsString),
        creationDate: new Date(),
      },
    }

    expect(await updateAssistant.isUpToDate('0.3.1')).toBe(false)
    expect(await updateAssistant.getNeededUpdates('0.3.1')).toEqual([
      {
        fromVersion: '0.2',
        toVersion: '0.3',
        doUpdate: expect.any(Function),
      },
      {
        fromVersion: '0.3',
        toVersion: '0.3.1',
        doUpdate: expect.any(Function),
      },
    ])

    await updateAssistant.update({ updateToVersion: '0.3.1' })

    expect(await updateAssistant.isUpToDate('0.3.1')).toBe(true)
    expect(await updateAssistant.getNeededUpdates('0.3.1')).toEqual([])
    expect(storageService.contextCorrelationIdToRecords[agent.context.contextCorrelationId].records).toMatchSnapshot()

    await agent.shutdown()

    uuidSpy.mockReset()
  })

  it('should correctly update the proofs records and create didcomm records with auto update', async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = jest.spyOn(uuid, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceCredentialRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-4-proofs-0.2.json'),
      'utf8'
    )

    const agent = new Agent({
      config: {
        label: 'Test Agent',
        autoUpdateStorageOnStartup: true,
      },
      modules: {
        inMemory: new InMemoryWalletModule(),
        ...getDefaultDidcommModules(),
      },
      dependencies: agentDependencies,
    })
    const storageService = agent.context.resolve<InMemoryStorageService>(InjectionSymbols.StorageService)

    // Set storage after initialization. This mimics as if this wallet
    // is opened as an existing wallet instead of a new wallet
    storageService.contextCorrelationIdToRecords = {
      default: {
        records: JSON.parse(aliceCredentialRecordsString),
        creationDate: new Date(),
      },
    }

    await agent.initialize()
    await storageService.deleteById(agent.context, MediatorRoutingRecord, 'MEDIATOR_ROUTING_RECORD')
    expect(storageService.contextCorrelationIdToRecords[agent.context.contextCorrelationId].records).toMatchSnapshot()

    await agent.shutdown()

    uuidSpy.mockReset()
  })

  it('should correctly update the did records', async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = jest.spyOn(uuid, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceDidRecordsString = readFileSync(path.join(__dirname, '__fixtures__/alice-8-dids-0.2.json'), 'utf8')

    const agent = new Agent({
      config: {
        label: 'Test Agent',
        autoUpdateStorageOnStartup: true,
      },
      dependencies: agentDependencies,
      modules: {
        inMemory: new InMemoryWalletModule(),
        ...getDefaultDidcommModules(),
      },
    })
    const storageService = agent.context.resolve<InMemoryStorageService>(InjectionSymbols.StorageService)

    // Set storage after initialization. This mimics as if this wallet
    // is opened as an existing wallet instead of a new wallet
    storageService.contextCorrelationIdToRecords = {
      default: {
        records: JSON.parse(aliceDidRecordsString),
        creationDate: new Date(),
      },
    }

    await agent.initialize()

    await storageService.deleteById(agent.context, MediatorRoutingRecord, 'MEDIATOR_ROUTING_RECORD')
    expect(storageService.contextCorrelationIdToRecords[agent.context.contextCorrelationId].records).toMatchSnapshot()

    await agent.shutdown()

    uuidSpy.mockReset()
  })
})
