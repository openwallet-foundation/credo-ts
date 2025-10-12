import { Agent } from '../src/agent/Agent'
import { RecordNotFoundError } from '../src/error'
import type { GenericRecord } from '../src/modules/generic-records/repository/GenericRecord'

import { getAgentOptions } from './helpers'

const aliceAgentOptions = getAgentOptions('Generic Records Alice', {
  endpoints: ['rxjs:alice'],
})

describe('genericRecords', () => {
  let aliceAgent: Agent

  const fooString = { foo: 'Some data saved' }
  const fooNumber = { foo: 42 }

  const barString: Record<string, unknown> = fooString
  const barNumber: Record<string, unknown> = fooNumber

  afterAll(async () => {
    await aliceAgent.shutdown()
  })

  test('store generic-record record', async () => {
    aliceAgent = new Agent(aliceAgentOptions)
    await aliceAgent.initialize()

    // Save genericRecord message (Minimal)

    const savedRecord1: GenericRecord = await aliceAgent.genericRecords.save({ content: barString })

    // Save genericRecord message with tag
    const tags1 = { myTag: 'foobar1' }
    const tags2 = { myTag: 'foobar2' }

    const savedRecord2: GenericRecord = await aliceAgent.genericRecords.save({ content: barNumber, tags: tags1 })

    expect(savedRecord1).toBeDefined()
    expect(savedRecord2).toBeDefined()

    const savedRecord3: GenericRecord = await aliceAgent.genericRecords.save({ content: barString, tags: tags2 })
    expect(savedRecord3).toBeDefined()

    const record = await aliceAgent.genericRecords.save({ content: barString, tags: tags2, id: 'foo' })
    expect(record.id).toBe('foo')
  })

  test('get generic-record records', async () => {
    //Create genericRecord message
    const savedRecords = await aliceAgent.genericRecords.getAll()
    expect(savedRecords.length).toBe(4)
  })

  test('get generic-record specific record', async () => {
    //Create genericRecord message
    const savedRecords1 = await aliceAgent.genericRecords.findAllByQuery({ myTag: 'foobar1' })
    expect(savedRecords1?.length === 1).toBe(true)
    expect(savedRecords1[0].content).toEqual({ foo: 42 })

    const savedRecords2 = await aliceAgent.genericRecords.findAllByQuery({ myTag: 'foobar2' })
    expect(savedRecords2.length === 2).toBe(true)
    expect(savedRecords2[0].content).toEqual({ foo: 'Some data saved' })
  })

  test('find generic record using id', async () => {
    const myId = '100'
    const savedRecord1: GenericRecord = await aliceAgent.genericRecords.save({ content: barString, id: myId })
    expect(savedRecord1).toBeDefined()

    const retrievedRecord = await aliceAgent.genericRecords.findById(savedRecord1.id)
    expect(retrievedRecord?.content).toEqual({ foo: 'Some data saved' })
  })

  test('delete generic record', async () => {
    const myId = '101'
    const savedRecord1: GenericRecord = await aliceAgent.genericRecords.save({ content: barString, id: myId })
    expect(savedRecord1).toBeDefined()

    await aliceAgent.genericRecords.delete(savedRecord1)

    const retrievedRecord = await aliceAgent.genericRecords.findById(savedRecord1.id)
    expect(retrievedRecord).toBeNull()
  })

  test('delete generic record by id', async () => {
    const myId = 'test-id'
    const savedRecord = await aliceAgent.genericRecords.save({ content: barString, id: myId })
    expect(savedRecord).toBeDefined()

    await aliceAgent.genericRecords.deleteById(savedRecord.id)

    const retrievedRecord = await aliceAgent.genericRecords.findById(savedRecord.id)
    expect(retrievedRecord).toBeNull()
  })
  test('throws an error if record not found by id ', async () => {
    const deleteRecordById = async () => {
      await aliceAgent.genericRecords.deleteById('test')
    }
    await expect(deleteRecordById).rejects.toThrow(RecordNotFoundError)
  })

  test('update generic record', async () => {
    const myId = '102'
    const savedRecord1: GenericRecord = await aliceAgent.genericRecords.save({ content: barString, id: myId })
    expect(savedRecord1).toBeDefined()

    let retrievedRecord = await aliceAgent.genericRecords.findById(savedRecord1.id)
    expect(retrievedRecord).toBeDefined()

    const amendedFooString = { foo: 'Some even more cool data saved' }
    const barString2: Record<string, unknown> = amendedFooString

    savedRecord1.content = barString2

    await aliceAgent.genericRecords.update(savedRecord1)

    retrievedRecord = await aliceAgent.genericRecords.findById(savedRecord1.id)
    expect(retrievedRecord?.content).toEqual({ foo: 'Some even more cool data saved' })
  })
})
