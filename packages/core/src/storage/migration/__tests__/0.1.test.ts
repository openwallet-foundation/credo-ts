import type { V0_1ToV0_2UpdateConfig } from '../../../../src'

import { readFileSync } from 'fs'
import path from 'path'

import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { InMemoryWalletModule } from '../../../../../../tests/InMemoryWalletModule'
import { DidCommModule } from '../../../../../didcomm/src'
import { Agent, utils } from '../../../../src'
import { agentDependencies as dependencies } from '../../../../tests/helpers'
import { InjectionSymbols } from '../../../constants'
import { UpdateAssistant } from '../UpdateAssistant'

const backupDate = new Date('2022-01-21T22:50:20.522Z')
vi.useFakeTimers().setSystemTime(backupDate)

const mediationRoleUpdateStrategies: V0_1ToV0_2UpdateConfig['mediationRoleUpdateStrategy'][] = [
  'allMediator',
  'allRecipient',
  'doNotChange',
  'recipientIfEndpoint',
]

describe('UpdateAssistant | v0.1 - v0.2', () => {
  it('should correctly update the role in the mediation record', async () => {
    const aliceMediationRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-4-mediators-0.1.json'),
      'utf8'
    )

    for (const mediationRoleUpdateStrategy of mediationRoleUpdateStrategies) {
      const agent = new Agent({
        config: {},
        dependencies,
        modules: {
          inMemory: new InMemoryWalletModule(),
          didcomm: new DidCommModule(),
        },
      })

      const storageService = agent.context.resolve<InMemoryStorageService>(InjectionSymbols.StorageService)
      const updateAssistant = new UpdateAssistant(agent, {
        v0_1ToV0_2: {
          mediationRoleUpdateStrategy,
        },
      })

      await updateAssistant.initialize()

      // Set storage after initialization. This mimics as if this wallet
      // is opened as an existing wallet instead of a new wallet
      storageService.contextCorrelationIdToRecords = {
        default: {
          records: JSON.parse(aliceMediationRecordsString),
          creationDate: new Date(),
        },
      }

      expect(await updateAssistant.getNeededUpdates('0.2')).toEqual([
        {
          fromVersion: '0.1',
          toVersion: '0.2',
          doUpdate: expect.any(Function),
        },
      ])

      await updateAssistant.update({ updateToVersion: '0.2' })

      expect(await updateAssistant.isUpToDate('0.2')).toBe(true)
      expect(await updateAssistant.getNeededUpdates('0.2')).toEqual([])

      expect(storageService.contextCorrelationIdToRecords[agent.context.contextCorrelationId].records).toMatchSnapshot(
        mediationRoleUpdateStrategy
      )

      await agent.shutdown()
    }
  })

  it('should correctly update credential records and create didcomm records', async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = vi.spyOn(utils, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceCredentialRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-4-credentials-0.1.json'),
      'utf8'
    )

    const agent = new Agent({
      config: {},
      dependencies,
      modules: {
        inMemory: new InMemoryWalletModule(),
        didcomm: new DidCommModule(),
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

    expect(await updateAssistant.isUpToDate('0.2')).toBe(false)
    expect(await updateAssistant.getNeededUpdates('0.2')).toEqual([
      {
        fromVersion: '0.1',
        toVersion: '0.2',
        doUpdate: expect.any(Function),
      },
    ])

    await updateAssistant.update({ updateToVersion: '0.2' })

    expect(await updateAssistant.isUpToDate('0.2')).toBe(true)
    expect(await updateAssistant.getNeededUpdates('0.2')).toEqual([])

    expect(storageService.contextCorrelationIdToRecords[agent.context.contextCorrelationId].records).toMatchSnapshot()

    await agent.shutdown()

    uuidSpy.mockReset()
  })

  it('should correctly update the credential records and create didcomm records with auto update', async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = vi.spyOn(utils, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceCredentialRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-4-credentials-0.1.json'),
      'utf8'
    )

    const agent = new Agent({
      config: { autoUpdateStorageOnStartup: true },
      dependencies,
      modules: {
        inMemory: new InMemoryWalletModule(),
        didcomm: new DidCommModule(),
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

    expect(await updateAssistant.isUpToDate('0.2')).toBe(false)
    expect(await updateAssistant.getNeededUpdates('0.2')).toEqual([
      {
        fromVersion: '0.1',
        toVersion: '0.2',
        doUpdate: expect.any(Function),
      },
    ])

    await updateAssistant.update({ updateToVersion: '0.2' })

    expect(await updateAssistant.isUpToDate('0.2')).toBe(true)
    expect(await updateAssistant.getNeededUpdates('0.2')).toEqual([])

    expect(storageService.contextCorrelationIdToRecords[agent.context.contextCorrelationId].records).toMatchSnapshot()

    await agent.shutdown()

    uuidSpy.mockReset()
  })

  it('should correctly update the connection record and create the did and oob records', async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = vi.spyOn(utils, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceConnectionRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-8-connections-0.1.json'),
      'utf8'
    )

    const agent = new Agent({
      config: {
        autoUpdateStorageOnStartup: true,
      },
      modules: {
        inMemory: new InMemoryWalletModule(),
        didcomm: new DidCommModule(),
      },
      dependencies,
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
        records: JSON.parse(aliceConnectionRecordsString),
        creationDate: new Date(),
      },
    }

    expect(await updateAssistant.isUpToDate('0.2')).toBe(false)
    expect(await updateAssistant.getNeededUpdates('0.2')).toEqual([
      {
        fromVersion: '0.1',
        toVersion: '0.2',
        doUpdate: expect.any(Function),
      },
    ])

    await updateAssistant.update({ updateToVersion: '0.2' })

    expect(await updateAssistant.isUpToDate('0.2')).toBe(true)
    expect(await updateAssistant.getNeededUpdates('0.2')).toEqual([])

    expect(storageService.contextCorrelationIdToRecords[agent.context.contextCorrelationId].records).toMatchSnapshot()

    await agent.shutdown()

    uuidSpy.mockReset()
  })
})
