import { DependencyManager, InjectionSymbols, Agent, UpdateAssistant, utils } from '@credo-ts/core'
import { readFileSync } from 'fs'
import path from 'path'

import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { RegisteredAskarTestWallet } from '../../../../askar/tests/helpers'
import { agentDependencies, getAskarWalletConfig } from '../../../../core/tests'
import { InMemoryAnonCredsRegistry } from '../../../tests/InMemoryAnonCredsRegistry'
import { anoncreds } from '../../../tests/helpers'
import { AnonCredsModule } from '../../AnonCredsModule'
import {
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerServiceSymbol,
  AnonCredsVerifierServiceSymbol,
} from '../../services'

// Backup date / time is the unique identifier for a backup, needs to be unique for every test
const backupDate = new Date('2023-03-19T22:50:20.522Z')
jest.useFakeTimers().setSystemTime(backupDate)

describe('UpdateAssistant | AnonCreds | v0.4 - v0.5', () => {
  it(`should correctly update the credential exchange records for holders`, async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = jest.spyOn(utils, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const holderRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/holder-anoncreds-2-credentials-0.4.json'),
      'utf8'
    )

    const dependencyManager = new DependencyManager()
    const storageService = new InMemoryStorageService()
    dependencyManager.registerInstance(InjectionSymbols.StorageService, storageService)
    // If we register the AskarModule it will register the storage service, but we use in memory storage here
    dependencyManager.registerContextScoped(InjectionSymbols.Wallet, RegisteredAskarTestWallet)
    dependencyManager.registerInstance(AnonCredsIssuerServiceSymbol, {})
    dependencyManager.registerInstance(AnonCredsHolderServiceSymbol, {})
    dependencyManager.registerInstance(AnonCredsVerifierServiceSymbol, {})

    const agent = new Agent(
      {
        config: {
          label: 'Test Agent',
          walletConfig: getAskarWalletConfig('0.4 Update AnonCreds - Holder', { inMemory: false, random: 'static' }),
        },
        dependencies: agentDependencies,
        modules: {
          // We need to include the AnonCredsModule to run the updates
          anoncreds: new AnonCredsModule({
            registries: [new InMemoryAnonCredsRegistry()],
            anoncreds,
          }),
        },
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
    storageService.contextCorrelationIdToRecords = {
      default: {
        records: JSON.parse(holderRecordsString),
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

    await updateAssistant.update({ updateToVersion: '0.5' })

    expect(await updateAssistant.isUpToDate('0.5')).toBe(true)
    expect(await updateAssistant.getNeededUpdates('0.5')).toEqual([])

    expect(storageService.contextCorrelationIdToRecords[agent.context.contextCorrelationId].records).toMatchSnapshot()

    await agent.shutdown()
    await agent.wallet.delete()

    uuidSpy.mockReset()
  })

  it(`should correctly update the role field inside the credential and proof exchange records`, async () => {
    // We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
    let uuidCounter = 1
    const uuidSpy = jest.spyOn(utils, 'uuid').mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`)

    const issuerRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/issuer-anoncreds-2-roles-credentials-0.4.json'),
      'utf8'
    )

    const dependencyManager = new DependencyManager()
    const storageService = new InMemoryStorageService()
    dependencyManager.registerInstance(InjectionSymbols.StorageService, storageService)
    // If we register the AskarModule it will register the storage service, but we use in memory storage here
    dependencyManager.registerContextScoped(InjectionSymbols.Wallet, RegisteredAskarTestWallet)
    dependencyManager.registerInstance(AnonCredsIssuerServiceSymbol, {})
    dependencyManager.registerInstance(AnonCredsHolderServiceSymbol, {})
    dependencyManager.registerInstance(AnonCredsVerifierServiceSymbol, {})

    const agent = new Agent(
      {
        config: {
          label: 'Test Agent',
          walletConfig: getAskarWalletConfig('0.4 Update AnonCreds - Issuer', { inMemory: false, random: 'static' }),
        },
        dependencies: agentDependencies,
        modules: {
          // We need to include the AnonCredsModule to run the updates
          anoncreds: new AnonCredsModule({
            anoncreds,
            registries: [new InMemoryAnonCredsRegistry({})],
          }),
        },
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
    storageService.contextCorrelationIdToRecords = {
      default: {
        records: JSON.parse(issuerRecordsString),
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

    await updateAssistant.update({ updateToVersion: '0.5' })

    expect(await updateAssistant.isUpToDate('0.5')).toBe(true)
    expect(await updateAssistant.getNeededUpdates('0.5')).toEqual([])

    expect(storageService.contextCorrelationIdToRecords[agent.context.contextCorrelationId].records).toMatchSnapshot()

    await agent.shutdown()
    await agent.wallet.delete()

    uuidSpy.mockReset()
  })
})
