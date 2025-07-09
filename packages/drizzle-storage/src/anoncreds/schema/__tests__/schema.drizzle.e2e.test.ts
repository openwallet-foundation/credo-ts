import { AnonCredsSchemaRecord, AnonCredsSchemaRepository } from '@credo-ts/anoncreds'
import { JsonTransformer } from '@credo-ts/core'

import { DrizzleRecordTest, setupDrizzleRecordTest } from '../../../../tests/testDatabase'
import { anonCredsSchemaDrizzleRecord } from '../index'

describe.each(['postgres', 'sqlite'] as const)('AnonCredsSchemaRecord with %s', (type) => {
  let recordTest: DrizzleRecordTest

  beforeAll(async () => {
    recordTest = await setupDrizzleRecordTest(type, anonCredsSchemaDrizzleRecord)
  })

  afterAll(async () => {
    await recordTest.teardown()
  })

  test('create, retrieve, update, query and delete schema record', async () => {
    const schema = JsonTransformer.fromJSON(
      {
        id: '6e7fcaf3-ebb9-45ed-9261-7b893f732bc1',
        schemaId: 'did:web:123/schemas/1',
        schema: {
          name: 'TestSchema',
          version: '1.0.0',
          issuerId: 'did:web:123',
          attrNames: ['test'],
        },
        methodName: 'web',
        createdAt: new Date(),
        _tags: {},
      },
      AnonCredsSchemaRecord
    )
    const anoncredsSchemaRepository = recordTest.agent.context.resolve(AnonCredsSchemaRepository)

    await anoncredsSchemaRepository.save(recordTest.agent.context, schema)

    const schema2 = await anoncredsSchemaRepository.findById(recordTest.agent.context, schema.id)
    expect(schema).toEqual(schema2)

    schema.setTags({
      myCustomTag: 'hello',
      isMorning: false,
    })
    await anoncredsSchemaRepository.update(recordTest.agent.context, schema)

    const [schema3] = await anoncredsSchemaRepository.findByQuery(recordTest.agent.context, {
      // TODO: we should allow null values in the query
      // unqualifiedSchemaId: null,
      isMorning: false,
      schemaName: 'TestSchema',
      schemaVersion: '1.0.0',
      issuerId: 'did:web:123',
      methodName: 'web',
      schemaId: 'did:web:123/schemas/1',
    })
    expect(schema3).toEqual(schema)

    expect(
      await anoncredsSchemaRepository.findByQuery(recordTest.agent.context, {
        myCustomTag: 'not-hello',
      })
    ).toHaveLength(0)

    await anoncredsSchemaRepository.deleteById(recordTest.agent.context, schema.id)

    expect(await anoncredsSchemaRepository.findByQuery(recordTest.agent.context, {})).toHaveLength(0)
  })
})
