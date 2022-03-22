import type { V0_1ToV0_2UpgradeConfig } from '../upgrades/0.1-0.2'

import { readFile } from 'fs/promises'
import path from 'path'
import { container as baseContainer } from 'tsyringe'

import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { agentDependencies } from '../../../../tests/helpers'
import { InjectionSymbols } from '../../../constants'
import { UpgradeAssistant } from '../UpgradeAssistant'

jest.useFakeTimers().setSystemTime(new Date('2022-03-21T22:50:20.522Z'))

const walletConfig = {
  id: `Wallet: 0.1 Upgrade`,
  key: `Key: 0.1 Upgrade`,
}

const mediationRoleUpdateStrategies: V0_1ToV0_2UpgradeConfig['mediationRoleUpdateStrategy'][] = [
  'allMediator',
  'allRecipient',
  'doNotChange',
  'recipientIfEndpoint',
]

describe('UpgradeAssistant | v0.1 - v0.2', () => {
  it(`should correctly update the role in the mediation record`, async () => {
    const aliceMediationRecordsString = await readFile(
      path.join(__dirname, '__fixtures__/alice-4-mediators-0.1.json'),
      'utf8'
    )

    for (const mediationRoleUpdateStrategy of mediationRoleUpdateStrategies) {
      const container = baseContainer.createChildContainer()
      const storageService = new InMemoryStorageService(JSON.parse(aliceMediationRecordsString))

      container.registerInstance(InjectionSymbols.StorageService, storageService)

      const upgradeAssistant = new UpgradeAssistant(
        {
          upgradeOptions: {
            v0_1ToV0_2: {
              mediationRoleUpdateStrategy,
            },
          },
          walletConfig,
        },
        agentDependencies,
        container
      )

      await upgradeAssistant.initialize()

      // Set storage after initialization. This mimics as if this wallet
      // is opened as an existing wallet instead of a new wallet
      storageService.records = JSON.parse(aliceMediationRecordsString)

      expect(await upgradeAssistant.getNeededUpgrades()).toEqual([
        {
          fromVersion: '0.1',
          toVersion: '0.2',
          doUpgrade: expect.any(Function),
        },
      ])

      await upgradeAssistant.upgrade()

      expect(await upgradeAssistant.getNeededUpgrades()).toEqual([])
      expect(storageService.records).toMatchSnapshot(mediationRoleUpdateStrategy)

      await upgradeAssistant.shutdown({ deleteWallet: true })
    }
  })

  it(`should correctly update the metadata in credential records`, async () => {
    const aliceCredentialRecordsString = await readFile(
      path.join(__dirname, '__fixtures__/alice-4-credentials-0.1.json'),
      'utf8'
    )

    const container = baseContainer.createChildContainer()
    const storageService = new InMemoryStorageService()

    container.registerInstance(InjectionSymbols.StorageService, storageService)

    const upgradeAssistant = new UpgradeAssistant(
      {
        upgradeOptions: {
          v0_1ToV0_2: {
            mediationRoleUpdateStrategy: 'doNotChange',
          },
        },
        walletConfig,
      },
      agentDependencies,
      container
    )

    await upgradeAssistant.initialize()

    // Set storage after initialization. This mimics as if this wallet
    // is opened as an existing wallet instead of a new wallet
    storageService.records = JSON.parse(aliceCredentialRecordsString)

    expect(await upgradeAssistant.getNeededUpgrades()).toEqual([
      {
        fromVersion: '0.1',
        toVersion: '0.2',
        doUpgrade: expect.any(Function),
      },
    ])

    await upgradeAssistant.upgrade()

    expect(await upgradeAssistant.getNeededUpgrades()).toEqual([])
    expect(storageService.records).toMatchSnapshot()

    await upgradeAssistant.shutdown({ deleteWallet: true })
  })
})
