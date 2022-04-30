import type { V0_1ToV0_2UpdateConfig } from '../updates/0.1-0.2'

import { unlinkSync, readFileSync } from 'fs'
import path from 'path'
import { container as baseContainer } from 'tsyringe'

import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { agentDependencies } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { InjectionSymbols } from '../../../constants'
import * as uuid from '../../../utils/uuid'
import { UpdateAssistant } from '../UpdateAssistant'

const backupDate = new Date('2022-01-21T22:50:20.522Z')
jest.useFakeTimers().setSystemTime(backupDate)
const backupIdentifier = backupDate.getTime()

const walletConfig = {
  id: `Wallet: 0.1 Update`,
  key: `Key: 0.1 Update`,
}

const mediationRoleUpdateStrategies: V0_1ToV0_2UpdateConfig['mediationRoleUpdateStrategy'][] = [
  'allMediator',
  'allRecipient',
  'doNotChange',
  'recipientIfEndpoint',
]

describe('UpdateAssistant | v0.1 - v0.2', () => {
  it(`should correctly update the role in the mediation record`, async () => {
    const aliceMediationRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-4-mediators-0.1.json'),
      'utf8'
    )

    for (const mediationRoleUpdateStrategy of mediationRoleUpdateStrategies) {
      const container = baseContainer.createChildContainer()
      const storageService = new InMemoryStorageService()
      container.registerInstance(InjectionSymbols.StorageService, storageService)

      const agent = new Agent(
        {
          label: 'Test Agent',
          walletConfig,
        },
        agentDependencies,
        container
      )

      const updateAssistant = new UpdateAssistant(agent, {
        v0_1ToV0_2: {
          mediationRoleUpdateStrategy,
        },
      })

      await updateAssistant.initialize()

      // Set storage after initialization. This mimics as if this wallet
      // is opened as an existing wallet instead of a new wallet
      storageService.records = JSON.parse(aliceMediationRecordsString)

      expect(await updateAssistant.getNeededUpdates()).toEqual([
        {
          fromVersion: '0.1',
          toVersion: '0.2',
          doUpdate: expect.any(Function),
        },
      ])

      await updateAssistant.update()

      expect(await updateAssistant.isUpToDate()).toBe(true)
      expect(await updateAssistant.getNeededUpdates()).toEqual([])
      expect(storageService.records).toMatchSnapshot(mediationRoleUpdateStrategy)

      // Need to remove backupFiles after each run so we don't get IOErrors
      const backupPath = `${agent.config.fileSystem.basePath}/afj/migration/backup/${backupIdentifier}`
      unlinkSync(backupPath)

      await agent.shutdown()
      await agent.wallet.delete()
    }
  })

  it(`should correctly update the metadata in credential records`, async () => {
    const aliceCredentialRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-4-credentials-0.1.json'),
      'utf8'
    )

    const container = baseContainer.createChildContainer()
    const storageService = new InMemoryStorageService()

    container.registerInstance(InjectionSymbols.StorageService, storageService)

    const agent = new Agent(
      {
        label: 'Test Agent',
        walletConfig,
      },
      agentDependencies,
      container
    )

    const updateAssistant = new UpdateAssistant(agent, {
      v0_1ToV0_2: {
        mediationRoleUpdateStrategy: 'doNotChange',
      },
    })

    await updateAssistant.initialize()

    // Set storage after initialization. This mimics as if this wallet
    // is opened as an existing wallet instead of a new wallet
    storageService.records = JSON.parse(aliceCredentialRecordsString)

    expect(await updateAssistant.isUpToDate()).toBe(false)
    expect(await updateAssistant.getNeededUpdates()).toEqual([
      {
        fromVersion: '0.1',
        toVersion: '0.2',
        doUpdate: expect.any(Function),
      },
    ])

    await updateAssistant.update()

    expect(await updateAssistant.isUpToDate()).toBe(true)
    expect(await updateAssistant.getNeededUpdates()).toEqual([])
    expect(storageService.records).toMatchSnapshot()

    // Need to remove backupFiles after each run so we don't get IOErrors
    const backupPath = `${agent.config.fileSystem.basePath}/afj/migration/backup/${backupIdentifier}`
    unlinkSync(backupPath)

    await agent.shutdown()
    await agent.wallet.delete()
  })

  it(`should correctly update the metadata in credential records with auto update`, async () => {
    const aliceCredentialRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-4-credentials-0.1.json'),
      'utf8'
    )

    const container = baseContainer.createChildContainer()
    const storageService = new InMemoryStorageService()

    container.registerInstance(InjectionSymbols.StorageService, storageService)

    const agent = new Agent(
      {
        label: 'Test Agent',
        walletConfig,
        autoUpdateStorageOnStartup: true,
      },
      agentDependencies,
      container
    )

    // We need to manually initialize the wallet as we're using the in memory wallet service
    // When we call agent.initialize() it will create the wallet and store the current framework
    // version in the in memory storage service. We need to manually set the records between initializing
    // the wallet and calling agent.initialize()
    await agent.wallet.initialize(walletConfig)

    // Set storage after initialization. This mimics as if this wallet
    // is opened as an existing wallet instead of a new wallet
    storageService.records = JSON.parse(aliceCredentialRecordsString)

    await agent.initialize()

    expect(storageService.records).toMatchSnapshot()

    // Need to remove backupFiles after each run so we don't get IOErrors
    const backupPath = `${agent.config.fileSystem.basePath}/afj/migration/backup/${backupIdentifier}`
    unlinkSync(backupPath)

    await agent.shutdown()
    await agent.wallet.delete()
  })

  it(`should correctly update the connection record and create the did and oob records`, async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = jest.spyOn(uuid, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceConnectionRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-7-connections-0.1.json'),
      'utf8'
    )

    const container = baseContainer.createChildContainer()
    const storageService = new InMemoryStorageService()

    container.registerInstance(InjectionSymbols.StorageService, storageService)

    const agent = new Agent(
      {
        label: 'Test Agent',
        walletConfig,
        autoUpdateStorageOnStartup: true,
      },
      agentDependencies,
      container
    )

    // We need to manually initialize the wallet as we're using the in memory wallet service
    // When we call agent.initialize() it will create the wallet and store the current framework
    // version in the in memory storage service. We need to manually set the records between initializing
    // the wallet and calling agent.initialize()
    await agent.wallet.initialize(walletConfig)

    // Set storage after initialization. This mimics as if this wallet
    // is opened as an existing wallet instead of a new wallet
    storageService.records = JSON.parse(aliceConnectionRecordsString)

    await agent.initialize()

    expect(storageService.records).toMatchSnapshot()

    // Need to remove backupFiles after each run so we don't get IOErrors
    const backupPath = `${agent.config.fileSystem.basePath}/afj/migration/backup/${backupIdentifier}`
    unlinkSync(backupPath)

    await agent.shutdown()
    await agent.wallet.delete()

    uuidSpy.mockReset()
  })
})
