import { AnonCredsSchemaRecord, AnonCredsSchemaRepository } from '@credo-ts/anoncreds'
import { Agent, JsonTransformer } from '@credo-ts/core'

import { setupDrizzleRecordTest } from '../../../../tests/testDatabase'
import { anonCredsSchemaDrizzleRecord } from '../index'

describe.each(['postgres', 'sqlite'] as const)('AnonCredsSchemaRecord with %s', (type) => {
  let agent: Agent

  beforeAll(async () => {
    agent = await setupDrizzleRecordTest(type, anonCredsSchemaDrizzleRecord)
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
        _tags: {
          unqualifiedSchemaId: null,
        },
      },
      AnonCredsSchemaRecord
    )
    const anoncredsSchemaRepository = agent.context.resolve(AnonCredsSchemaRepository)

    await anoncredsSchemaRepository.save(agent.context, schema)

    const schema2 = await anoncredsSchemaRepository.findById(agent.context, schema.id)
    expect(schema).toEqual(schema2)

    schema.setTags({
      myCustomTag: 'hello',
      isMorning: false,
    })
    await anoncredsSchemaRepository.update(agent.context, schema)

    const [schema3] = await anoncredsSchemaRepository.findByQuery(agent.context, {
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
      await anoncredsSchemaRepository.findByQuery(agent.context, {
        myCustomTag: 'not-hello',
      })
    ).toHaveLength(0)

    await anoncredsSchemaRepository.deleteById(agent.context, schema.id)

    expect(await anoncredsSchemaRepository.findByQuery(agent.context, {})).toHaveLength(0)
  })
})
