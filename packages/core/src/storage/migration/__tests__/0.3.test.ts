import { readFileSync } from 'fs'
import path from 'path'

import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { InMemoryWalletModule } from '../../../../../../tests/InMemoryWalletModule'
import { agentDependencies } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { InjectionSymbols } from '../../../constants'
import * as uuid from '../../../utils/uuid'
import { UpdateAssistant } from '../UpdateAssistant'

const backupDate = new Date('2023-03-18T22:50:20.522Z')
jest.useFakeTimers().setSystemTime(backupDate)

describe('UpdateAssistant | v0.3.1 - v0.4', () => {
  it('should correctly update the did records and remove cache records', async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = jest.spyOn(uuid, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceDidRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-2-sov-dids-one-cache-record-0.3.json'),
      'utf8'
    )

    const agent = new Agent({
      config: {
        label: 'Test Agent',
      },
      dependencies: agentDependencies,
      modules: {
        inMemory: new InMemoryWalletModule(),
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
        records: JSON.parse(aliceDidRecordsString),
        creationDate: new Date(),
      },
    }

    expect(await updateAssistant.isUpToDate('0.4')).toBe(false)
    expect(await updateAssistant.getNeededUpdates('0.4')).toEqual([
      {
        fromVersion: '0.3.1',
        toVersion: '0.4',
        doUpdate: expect.any(Function),
      },
    ])

    await updateAssistant.update({ updateToVersion: '0.4' })

    expect(await updateAssistant.isUpToDate('0.4')).toBe(true)
    expect(await updateAssistant.getNeededUpdates('0.4')).toEqual([])

    expect(storageService.contextCorrelationIdToRecords[agent.context.contextCorrelationId].records).toMatchSnapshot()

    await agent.shutdown()

    uuidSpy.mockReset()
  })

  it(`should correctly update 'claimFormat' tag to w3c records`, async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = jest.spyOn(uuid, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceW3cCredentialRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-2-w3c-credential-records-0.3.json'),
      'utf8'
    )

    const agent = new Agent({
      config: {
        label: 'Test Agent',
      },
      dependencies: agentDependencies,
      modules: {
        inMemory: new InMemoryWalletModule(),
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

    expect(await updateAssistant.isUpToDate('0.4')).toBe(false)
    expect(await updateAssistant.getNeededUpdates('0.4')).toEqual([
      {
        fromVersion: '0.3.1',
        toVersion: '0.4',
        doUpdate: expect.any(Function),
      },
    ])

    await updateAssistant.update({ updateToVersion: '0.4' })

    expect(await updateAssistant.isUpToDate('0.4')).toBe(true)
    expect(await updateAssistant.getNeededUpdates('0.4')).toEqual([])

    expect(storageService.contextCorrelationIdToRecords[agent.context.contextCorrelationId].records).toMatchSnapshot()

    await agent.shutdown()

    uuidSpy.mockReset()
  })
})
