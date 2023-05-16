import type { V0_1ToV0_2UpdateConfig } from '../updates/0.1-0.2'

import { readFileSync } from 'fs'
import path from 'path'

import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { IndySdkWallet } from '../../../../../indy-sdk/src'
import { IndySdkSymbol } from '../../../../../indy-sdk/src/types'
import { indySdk } from '../../../../../indy-sdk/tests/setupIndySdkModule'
import { Agent } from '../../../../src'
import { agentDependencies as dependencies } from '../../../../tests/helpers'
import { InjectionSymbols } from '../../../constants'
import { DependencyManager } from '../../../plugins'
import * as uuid from '../../../utils/uuid'
import { UpdateAssistant } from '../UpdateAssistant'

const backupDate = new Date('2022-01-21T22:50:20.522Z')
jest.useFakeTimers().setSystemTime(backupDate)

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
      const dependencyManager = new DependencyManager()
      const storageService = new InMemoryStorageService()
      dependencyManager.registerInstance(InjectionSymbols.StorageService, storageService)
      // If we register the IndySdkModule it will register the storage service, but we use in memory storage here
      dependencyManager.registerContextScoped(InjectionSymbols.Wallet, IndySdkWallet)
      dependencyManager.registerInstance(IndySdkSymbol, indySdk)

      const agent = new Agent(
        {
          config: { label: 'Test Agent', walletConfig },
          dependencies,
        },
        dependencyManager
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

      expect(await updateAssistant.getNeededUpdates('0.2')).toEqual([
        {
          fromVersion: '0.1',
          toVersion: '0.2',
          doUpdate: expect.any(Function),
        },
      ])

      await updateAssistant.update('0.2')

      expect(await updateAssistant.isUpToDate('0.2')).toBe(true)
      expect(await updateAssistant.getNeededUpdates('0.2')).toEqual([])

      // MEDIATOR_ROUTING_RECORD recipientKeys will be different every time, and is not what we're testing here
      delete storageService.records.MEDIATOR_ROUTING_RECORD
      expect(storageService.records).toMatchSnapshot(mediationRoleUpdateStrategy)

      await agent.shutdown()
      await agent.wallet.delete()
    }
  })

  it(`should correctly update credential records and create didcomm records`, async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = jest.spyOn(uuid, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceCredentialRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-4-credentials-0.1.json'),
      'utf8'
    )

    const dependencyManager = new DependencyManager()
    const storageService = new InMemoryStorageService()
    dependencyManager.registerInstance(InjectionSymbols.StorageService, storageService)
    // If we register the IndySdkModule it will register the storage service, but we use in memory storage here
    dependencyManager.registerContextScoped(InjectionSymbols.Wallet, IndySdkWallet)
    dependencyManager.registerInstance(IndySdkSymbol, indySdk)

    const agent = new Agent(
      {
        config: { label: 'Test Agent', walletConfig },
        dependencies,
      },
      dependencyManager
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

    expect(await updateAssistant.isUpToDate('0.2')).toBe(false)
    expect(await updateAssistant.getNeededUpdates('0.2')).toEqual([
      {
        fromVersion: '0.1',
        toVersion: '0.2',
        doUpdate: expect.any(Function),
      },
    ])

    await updateAssistant.update('0.2')

    expect(await updateAssistant.isUpToDate('0.2')).toBe(true)
    expect(await updateAssistant.getNeededUpdates('0.2')).toEqual([])

    // MEDIATOR_ROUTING_RECORD recipientKeys will be different every time, and is not what we're testing here
    delete storageService.records.MEDIATOR_ROUTING_RECORD
    expect(storageService.records).toMatchSnapshot()

    await agent.shutdown()
    await agent.wallet.delete()

    uuidSpy.mockReset()
  })

  it(`should correctly update the credential records and create didcomm records with auto update`, async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = jest.spyOn(uuid, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceCredentialRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-4-credentials-0.1.json'),
      'utf8'
    )

    const dependencyManager = new DependencyManager()
    const storageService = new InMemoryStorageService()
    dependencyManager.registerInstance(InjectionSymbols.StorageService, storageService)
    // If we register the IndySdkModule it will register the storage service, but we use in memory storage here
    dependencyManager.registerContextScoped(InjectionSymbols.Wallet, IndySdkWallet)
    dependencyManager.registerInstance(IndySdkSymbol, indySdk)

    const agent = new Agent(
      {
        config: { label: 'Test Agent', walletConfig, autoUpdateStorageOnStartup: true },
        dependencies,
      },
      dependencyManager
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

    expect(await updateAssistant.isUpToDate('0.2')).toBe(false)
    expect(await updateAssistant.getNeededUpdates('0.2')).toEqual([
      {
        fromVersion: '0.1',
        toVersion: '0.2',
        doUpdate: expect.any(Function),
      },
    ])

    await updateAssistant.update('0.2')

    expect(await updateAssistant.isUpToDate('0.2')).toBe(true)
    expect(await updateAssistant.getNeededUpdates('0.2')).toEqual([])

    // MEDIATOR_ROUTING_RECORD recipientKeys will be different every time, and is not what we're testing here
    delete storageService.records.MEDIATOR_ROUTING_RECORD
    expect(storageService.records).toMatchSnapshot()

    await agent.shutdown()
    await agent.wallet.delete()

    uuidSpy.mockReset()
  })

  it(`should correctly update the connection record and create the did and oob records`, async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = jest.spyOn(uuid, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const aliceConnectionRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/alice-8-connections-0.1.json'),
      'utf8'
    )

    const dependencyManager = new DependencyManager()
    const storageService = new InMemoryStorageService()
    dependencyManager.registerInstance(InjectionSymbols.StorageService, storageService)
    // If we register the IndySdkModule it will register the storage service, but we use in memory storage here
    dependencyManager.registerContextScoped(InjectionSymbols.Wallet, IndySdkWallet)
    dependencyManager.registerInstance(IndySdkSymbol, indySdk)

    const agent = new Agent(
      {
        config: {
          label: 'Test Agent',
          walletConfig,
          autoUpdateStorageOnStartup: true,
        },
        dependencies,
      },
      dependencyManager
    )

    const updateAssistant = new UpdateAssistant(agent, {
      v0_1ToV0_2: {
        mediationRoleUpdateStrategy: 'doNotChange',
      },
    })

    await updateAssistant.initialize()

    // Set storage after initialization. This mimics as if this wallet
    // is opened as an existing wallet instead of a new wallet
    storageService.records = JSON.parse(aliceConnectionRecordsString)

    expect(await updateAssistant.isUpToDate('0.2')).toBe(false)
    expect(await updateAssistant.getNeededUpdates('0.2')).toEqual([
      {
        fromVersion: '0.1',
        toVersion: '0.2',
        doUpdate: expect.any(Function),
      },
    ])

    await updateAssistant.update('0.2')

    expect(await updateAssistant.isUpToDate('0.2')).toBe(true)
    expect(await updateAssistant.getNeededUpdates('0.2')).toEqual([])

    // MEDIATOR_ROUTING_RECORD recipientKeys will be different every time, and is not what we're testing here
    delete storageService.records.MEDIATOR_ROUTING_RECORD
    expect(storageService.records).toMatchSnapshot()

    await agent.shutdown()
    await agent.wallet.delete()

    uuidSpy.mockReset()
  })
})
