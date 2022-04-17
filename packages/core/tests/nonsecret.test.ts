import { Agent } from '../src/agent/Agent'

import { getBaseConfig } from './helpers'

const aliceConfig = getBaseConfig('Agents Alice', {
  endpoints: ['rxjs:alice'],
})

describe('genericRecords', () => {
  let aliceAgent: Agent

  afterAll(async () => {
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('store generic-record record', async () => {
    aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
    await aliceAgent.initialize()

    //Save genericRecord message (Minimal)
    const savedRecord1 = await aliceAgent.genericRecords.saveRecord('Some data saved')

    //Save genericRecord message with tag
    const tags = { myTag: 'foobar' }
    const savedRecord2 = await aliceAgent.genericRecords.saveRecord('Some data saved', tags)

    expect(savedRecord1).toBeDefined()
    expect(savedRecord2).toBeDefined()
  })

  test('get generic-record records', async () => {
    //Create genericRecord message
    const savedRecords = await aliceAgent.genericRecords.getAll()
    expect(savedRecords?.length > 0).toBe(true)
  })

  test('get generic-record specific record', async () => {
    //Create genericRecord message
    const savedRecords = await aliceAgent.genericRecords.findAllByQuery({ myTag: 'foobar' })
    expect(savedRecords?.length == 1).toBe(true)
  })
})
