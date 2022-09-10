import type { FileSystem } from '../../..'

import { unlinkSync, readFileSync } from 'fs'
import path from 'path'

import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { Agent } from '../../../../src'
import { agentDependencies } from '../../../../tests/helpers'
import { InjectionSymbols } from '../../../constants'
import { DependencyManager } from '../../../plugins'
import * as uuid from '../../../utils/uuid'
import { UpdateAssistant } from '../UpdateAssistant'

const backupDate = new Date('2022-01-21T22:50:20.522Z')
jest.useFakeTimers().setSystemTime(backupDate)
const backupIdentifier = backupDate.getTime()

const walletConfig = {
  id: `Wallet: 0.2 Update`,
  key: `Key: 0.2 Update`,
}

describe('UpdateAssistant | v0.2 - v0.3', () => {
  it(`should correctly update proof records and create didcomm records`, async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = jest.spyOn(uuid, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceCredentialRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-4-proofs-0.2.json'),
      'utf8'
    )

    const dependencyManager = new DependencyManager()
    const storageService = new InMemoryStorageService()
    dependencyManager.registerInstance(InjectionSymbols.StorageService, storageService)

    const agent = new Agent(
      {
        config: {
          label: 'Test Agent',
          walletConfig,
        },
        dependencies: agentDependencies,
      },
      dependencyManager
    )

    const fileSystem = agent.injectionContainer.resolve<FileSystem>(InjectionSymbols.FileSystem)

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
        fromVersion: '0.2',
        toVersion: '0.3',
        doUpdate: expect.any(Function),
      },
    ])

    await updateAssistant.update()

    expect(await updateAssistant.isUpToDate()).toBe(true)
    expect(await updateAssistant.getNeededUpdates()).toEqual([])

    // MEDIATOR_ROUTING_RECORD recipientKeys will be different every time, and is not what we're testing here
    delete storageService.records.MEDIATOR_ROUTING_RECORD
    expect(storageService.records).toMatchSnapshot()

    // Need to remove backupFiles after each run so we don't get IOErrors
    const backupPath = `${fileSystem.basePath}/afj/migration/backup/${backupIdentifier}`
    unlinkSync(backupPath)

    await agent.shutdown()
    await agent.wallet.delete()

    uuidSpy.mockReset()
  })

  it(`should correctly update the proofs records and create didcomm records with auto update`, async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = jest.spyOn(uuid, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceCredentialRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-4-proofs-0.2.json'),
      'utf8'
    )

    const dependencyManager = new DependencyManager()
    const storageService = new InMemoryStorageService()
    dependencyManager.registerInstance(InjectionSymbols.StorageService, storageService)

    const agent = new Agent(
      {
        config: {
          label: 'Test Agent',
          walletConfig,
          autoUpdateStorageOnStartup: true,
        },
        dependencies: agentDependencies,
      },
      dependencyManager
    )

    const fileSystem = agent.injectionContainer.resolve<FileSystem>(InjectionSymbols.FileSystem)

    // We need to manually initialize the wallet as we're using the in memory wallet service
    // When we call agent.initialize() it will create the wallet and store the current framework
    // version in the in memory storage service. We need to manually set the records between initializing
    // the wallet and calling agent.initialize()
    await agent.wallet.initialize(walletConfig)

    // Set storage after initialization. This mimics as if this wallet
    // is opened as an existing wallet instead of a new wallet
    storageService.records = JSON.parse(aliceCredentialRecordsString)

    await agent.initialize()

    // MEDIATOR_ROUTING_RECORD recipientKeys will be different every time, and is not what we're testing here
    delete storageService.records.MEDIATOR_ROUTING_RECORD
    expect(storageService.records).toMatchSnapshot()

    // Need to remove backupFiles after each run so we don't get IOErrors
    const backupPath = `${fileSystem.basePath}/afj/migration/backup/${backupIdentifier}`
    unlinkSync(backupPath)

    await agent.shutdown()
    await agent.wallet.delete()

    uuidSpy.mockReset()
  })
})
