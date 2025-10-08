import { readFileSync } from 'fs'
import path from 'path'
import {
  Agent,
  CacheModule,
  DependencyManager,
  InMemoryLruCache,
  InjectionSymbols,
  UpdateAssistant,
  W3cCredentialRecord,
} from '@credo-ts/core'

import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { agentDependencies } from '../../../../core/tests'
import { InMemoryAnonCredsRegistry } from '../../../tests/InMemoryAnonCredsRegistry'
import { anoncreds } from '../../../tests/helpers'
import { AnonCredsModule } from '../../AnonCredsModule'
import {
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerServiceSymbol,
  AnonCredsVerifierServiceSymbol,
} from '../../services'

// Backup date / time is the unique identifier for a backup, needs to be unique for every test
const backupDate = new Date('2024-02-28T22:50:20.522Z')
vi.useFakeTimers().setSystemTime(backupDate)

// We need to mock the uuid generation to make sure we generate consistent uuids for the new records created.
let uuidCounter = 1
vi.mock('../../../../core/src/utils/uuid', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    uuid: vi.fn().mockImplementation(() => `${uuidCounter++}-4e4f-41d9-94c4-f49351b811f1`),
  }
})

describe('UpdateAssistant | AnonCreds | v0.4 - v0.5', () => {
  it('should correctly update the credential exchange records for holders', async () => {
    const holderRecordsString = readFileSync(
      path.join(__dirname, '__fixtures__/holder-anoncreds-2-anoncreds-records.0.4.json'),
      'utf8'
    )

    const dependencyManager = new DependencyManager()
    const storageService = new InMemoryStorageService()
    dependencyManager.registerInstance(InjectionSymbols.StorageService, storageService)
    dependencyManager.registerInstance(AnonCredsIssuerServiceSymbol, {})
    dependencyManager.registerInstance(AnonCredsHolderServiceSymbol, {})
    dependencyManager.registerInstance(AnonCredsVerifierServiceSymbol, {})

    const agent = new Agent(
      {
        config: {},
        dependencies: agentDependencies,
        modules: {
          cache: new CacheModule({
            cache: new InMemoryLruCache({ limit: 10 }),
          }),
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

    // We mock the system time, however the issuanceDate is set by AnonCreds RS in rust, so we need to
    // manually set the issuanceDate to the current date (which is mocked) to not have inconsistent snapshot
    for (const record of Object.values(
      storageService.contextCorrelationIdToRecords[agent.context.contextCorrelationId].records
    )) {
      if (record.type !== W3cCredentialRecord.type) continue

      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const recordValue = record.value as any
      recordValue.credential.issuanceDate = new Date()
    }

    expect(storageService.contextCorrelationIdToRecords[agent.context.contextCorrelationId].records).toMatchSnapshot()

    await agent.shutdown()
  })
})
