import { readFileSync } from 'fs'
import path from 'path'

import {
  DidCommCredentialExchangeRecord,
  DidCommCredentialExchangeRepository,
} from '../../../../../didcomm/src/modules/credentials'
import { getAgentOptions } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { JsonTransformer } from '../../../utils'
import { StorageUpdateService } from '../StorageUpdateService'
import { UpdateAssistant } from '../UpdateAssistant'

const agentOptions = getAgentOptions('UpdateAssistant | Aries Askar', undefined, undefined, undefined, {
  requireDidcomm: true,
})

const aliceCredentialRecordsString = readFileSync(
  path.join(__dirname, '__fixtures__/alice-4-credentials-0.1.json'),
  'utf8'
)

const backupDate = new Date('2022-03-22T22:50:20.522Z')
jest.useFakeTimers().setSystemTime(backupDate)

describe('UpdateAssistant | Aries Askar', () => {
  let updateAssistant: UpdateAssistant
  let agent: Agent

  beforeEach(async () => {
    agent = new Agent(agentOptions)
    updateAssistant = new UpdateAssistant(agent, {
      v0_1ToV0_2: {
        mediationRoleUpdateStrategy: 'allMediator',
      },
    })

    await updateAssistant.initialize()
  })

  afterEach(async () => {
    await agent.shutdown()
  })

  it('should create a backup', async () => {
    const aliceCredentialRecordsJson = JSON.parse(aliceCredentialRecordsString)

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const aliceCredentialRecords = Object.values(aliceCredentialRecordsJson).map((data: any) => {
      const record = JsonTransformer.fromJSON(data.value, DidCommCredentialExchangeRecord)

      record.setTags(data.tags)
      return record
    })

    const credentialRepository = agent.dependencyManager.resolve(DidCommCredentialExchangeRepository)
    const storageUpdateService = agent.dependencyManager.resolve(StorageUpdateService)

    // Add 0.1 data and set version to 0.1
    for (const credentialRecord of aliceCredentialRecords) {
      await credentialRepository.save(agent.context, credentialRecord)
    }
    await storageUpdateService.setCurrentStorageVersion(agent.context, '0.1')

    // Expect an update is needed
    expect(await updateAssistant.isUpToDate()).toBe(false)

    // Create update
    await updateAssistant.update()

    expect(await updateAssistant.isUpToDate()).toBe(true)

    expect(
      (await credentialRepository.getAll(agent.context)).sort((a, b) => a.id.localeCompare(b.id))
    ).toMatchSnapshot()
  })
})
