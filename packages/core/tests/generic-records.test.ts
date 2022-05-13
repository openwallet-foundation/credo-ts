import type { GenericRecord } from '../src/modules/generic-records/repository/GenericRecord'

import { Agent } from '../src/agent/Agent'

import { getBaseConfig } from './helpers'

const aliceConfig = getBaseConfig('Agents Alice', {
  endpoints: ['rxjs:alice'],
})

describe('genericRecords', () => {
  let aliceAgent: Agent

  // const fooString: FooString = { foo: 'Some data saved' }
  const fooString = { foo: 'Some data saved' }
  const fooNumber = { foo: 42 }

  const barString: Record<string, unknown> = fooString
  const barNumber: Record<string, unknown> = fooNumber

  afterAll(async () => {
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('store generic-record record', async () => {
    aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
    await aliceAgent.initialize()

    //Save genericRecord message (Minimal)

    const savedRecord1: GenericRecord = await aliceAgent.genericRecords.save({ message: barString })

    //Save genericRecord message with tag
    const tags1 = { myTag: 'foobar1' }
    const tags2 = { myTag: 'foobar2' }

    const savedRecord2: GenericRecord = await aliceAgent.genericRecords.save({ message: barNumber, tags: tags1 })

    expect(savedRecord1).toBeDefined()
    expect(savedRecord2).toBeDefined()

    const savedRecord3: GenericRecord = await aliceAgent.genericRecords.save({ message: barString, tags: tags2 })
    expect(savedRecord3).toBeDefined()
  })

  test('get generic-record records', async () => {
    //Create genericRecord message
    const savedRecords = await aliceAgent.genericRecords.getAll()
    expect(savedRecords.length).toBe(3)
  })

  test('get generic-record specific record', async () => {
    //Create genericRecord message
    const savedRecords1 = await aliceAgent.genericRecords.findAllByQuery({ myTag: 'foobar1' })
    expect(savedRecords1?.length == 1).toBe(true)
    expect(savedRecords1[0].content).toEqual({ foo: 42 })

    const savedRecords2 = await aliceAgent.genericRecords.findAllByQuery({ myTag: 'foobar2' })
    expect(savedRecords2?.length == 1).toBe(true)
    expect(savedRecords2[0].content).toEqual({ foo: 'Some data saved' })
  })

  test('find generic record using id', async () => {
    const myId = '100'
    const savedRecord1: GenericRecord = await aliceAgent.genericRecords.save({ message: barString, id: myId })
    expect(savedRecord1).toBeDefined()

    const retrievedRecord: GenericRecord | null = await aliceAgent.genericRecords.findById(savedRecord1.id)

    if (retrievedRecord) {
      expect(retrievedRecord.content).toEqual({ foo: 'Some data saved' })
    } else {
      throw Error('retrieved record not found')
    }
  })

  test('delete generic record', async () => {
    const myId = '100'
    const savedRecord1: GenericRecord = await aliceAgent.genericRecords.save({ message: barString, id: myId })
    expect(savedRecord1).toBeDefined()

    await aliceAgent.genericRecords.delete(savedRecord1)

    const retrievedRecord: GenericRecord | null = await aliceAgent.genericRecords.findById(savedRecord1.id)
    expect(retrievedRecord).toBeNull()
  })

  test('update generic record', async () => {
    const myId = '100'
    const savedRecord1: GenericRecord = await aliceAgent.genericRecords.save({ message: barString, id: myId })
    expect(savedRecord1).toBeDefined()

    let retrievedRecord: GenericRecord | null = await aliceAgent.genericRecords.findById(savedRecord1.id)
    expect(retrievedRecord).toBeDefined()

    const amendedFooString = { foo: 'Some even more cool data saved' }
    const barString2: Record<string, unknown> = amendedFooString

    savedRecord1.content = barString2

    await aliceAgent.genericRecords.update(savedRecord1)

    retrievedRecord = await aliceAgent.genericRecords.findById(savedRecord1.id)
    if (retrievedRecord) {
      expect(retrievedRecord.content).toEqual({ foo: 'Some even more cool data saved' })
    } else {
      throw Error('retrieved record not found in update test')
    }
  })
})
