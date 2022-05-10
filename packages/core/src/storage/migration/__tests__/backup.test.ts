import type { StorageUpdateError } from '../error/StorageUpdateError'

import { readFileSync, unlinkSync } from 'fs'
import path from 'path'
import { container } from 'tsyringe'

import { getBaseConfig } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { AriesFrameworkError } from '../../../error'
import { CredentialExchangeRecord, CredentialRepository } from '../../../modules/credentials'
import { JsonTransformer } from '../../../utils'
import { StorageUpdateService } from '../StorageUpdateService'
import { UpdateAssistant } from '../UpdateAssistant'

const { agentDependencies, config } = getBaseConfig('UpdateAssistant | Backup')

const aliceCredentialRecordsString = readFileSync(
  path.join(__dirname, '__fixtures__/alice-4-credentials-0.1.json'),
  'utf8'
)

const backupDate = new Date('2022-03-21T22:50:20.522Z')
jest.useFakeTimers().setSystemTime(backupDate)
const backupIdentifier = backupDate.getTime()

describe('UpdateAssistant | Backup', () => {
  let updateAssistant: UpdateAssistant
  let agent: Agent
  let backupPath: string

  beforeEach(async () => {
    agent = new Agent(config, agentDependencies, container)

    updateAssistant = new UpdateAssistant(agent, {
      v0_1ToV0_2: {
        mediationRoleUpdateStrategy: 'allMediator',
      },
    })

    await updateAssistant.initialize()

    backupPath = `${agent.config.fileSystem.basePath}/afj/migration/backup/${backupIdentifier}`
  })

  afterEach(async () => {
    unlinkSync(backupPath)

    await agent.shutdown()
    await agent.wallet.delete()
  })

  it('should create a backup', async () => {
    const aliceCredentialRecordsJson = JSON.parse(aliceCredentialRecordsString)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aliceCredentialRecords = Object.values(aliceCredentialRecordsJson).map((data: any) => {
      const record = JsonTransformer.fromJSON(data.value, CredentialExchangeRecord)

      record.setTags(data.tags)
      return record
    })

    const credentialRepository = agent.injectionContainer.resolve(CredentialRepository)
    const storageUpdateService = agent.injectionContainer.resolve(StorageUpdateService)

    // Add 0.1 data and set version to 0.1
    for (const credentialRecord of aliceCredentialRecords) {
      await credentialRepository.save(credentialRecord)
    }
    await storageUpdateService.setCurrentStorageVersion('0.1')

    // Expect an update is needed
    expect(await updateAssistant.isUpToDate()).toBe(false)

    const fileSystem = agent.config.fileSystem
    // Backup should not exist before update
    expect(await fileSystem.exists(backupPath)).toBe(false)

    // Create update
    await updateAssistant.update()

    // Backup should exist after update
    expect(await fileSystem.exists(backupPath)).toBe(true)

    expect((await credentialRepository.getAll()).sort((a, b) => a.id.localeCompare(b.id))).toMatchSnapshot()
  })

  it('should restore the backup if an error occurs backup', async () => {
    const aliceCredentialRecordsJson = JSON.parse(aliceCredentialRecordsString)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aliceCredentialRecords = Object.values(aliceCredentialRecordsJson).map((data: any) => {
      const record = JsonTransformer.fromJSON(data.value, CredentialExchangeRecord)

      record.setTags(data.tags)
      return record
    })

    const credentialRepository = agent.injectionContainer.resolve(CredentialRepository)
    const storageUpdateService = agent.injectionContainer.resolve(StorageUpdateService)

    // Add 0.1 data and set version to 0.1
    for (const credentialRecord of aliceCredentialRecords) {
      await credentialRepository.save(credentialRecord)
    }
    await storageUpdateService.setCurrentStorageVersion('0.1')

    // Expect an update is needed
    expect(await updateAssistant.isUpToDate()).toBe(false)
    jest.spyOn(updateAssistant, 'getNeededUpdates').mockResolvedValue([
      {
        fromVersion: '0.1',
        toVersion: '0.2',
        doUpdate: async () => {
          throw new AriesFrameworkError("Uh oh I'm broken")
        },
      },
    ])

    const fileSystem = agent.config.fileSystem
    // Backup should not exist before update
    expect(await fileSystem.exists(backupPath)).toBe(false)

    let updateError: StorageUpdateError | undefined = undefined

    try {
      await updateAssistant.update()
    } catch (error) {
      updateError = error
    }

    expect(updateError?.cause?.message).toEqual("Uh oh I'm broken")

    // Backup should exist after update
    expect(await fileSystem.exists(backupPath)).toBe(true)
    expect(await fileSystem.exists(`${backupPath}-error`)).toBe(true)
    unlinkSync(`${backupPath}-error`)

    // Wallet should be same as when we started because of backup
    expect((await credentialRepository.getAll()).sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      aliceCredentialRecords.sort((a, b) => a.id.localeCompare(b.id))
    )
  })
})
