import { JsonTransformer } from '@credo-ts/core'

import { OutOfBandRecord, OutOfBandRepository } from '@credo-ts/didcomm'
import { DrizzleRecordTest, setupDrizzleRecordTest } from '../../../../tests/testDatabase'
import { didcommOutOfBandDrizzleRecord } from '../index'

describe.each(['postgres', 'sqlite'] as const)('OutOfBandRecord with %s', (type) => {
  let recordTest: DrizzleRecordTest

  beforeAll(async () => {
    recordTest = await setupDrizzleRecordTest(type, didcommOutOfBandDrizzleRecord)
  })

  afterAll(async () => {
    await recordTest.teardown()
  })

  test('create, retrieve, update, query and delete out of band record', async () => {
    const outOfBand = JsonTransformer.fromJSON(
      {
        _tags: {},
        metadata: {},
        id: 'd565b4d8-3e5d-42da-a87c-4454fdfbaff0',
        createdAt: '2022-06-02T18:35:06.374Z',
        outOfBandInvitation: {
          '@type': 'https://didcomm.org/out-of-band/1.1/invitation',
          '@id': '5d57ca2d-80ed-432c-8def-c40c75e8ab09',
          label: 'Faber College',
          goalCode: 'p2p-messaging',
          goal: 'To make a connection',
          accept: ['didcomm/aip1', 'didcomm/aip2;env=rfc19'],
          handshake_protocols: ['https://didcomm.org/didexchange/1.0', 'https://didcomm.org/connections/1.0'],
          services: [
            {
              id: '#inline-0',
              serviceEndpoint: 'rxjs:faber',
              type: 'did-communication',
              recipientKeys: ['did:key:z6MkhngxtGfzTvGVbFjVVqBHvniY1f2XrTMZLM5BZvPh31Dc'],
              routingKeys: [],
            },
          ],
        },
        role: 'sender',
        state: 'await-response',
        autoAcceptConnection: true,
        reusable: false,
      },
      OutOfBandRecord
    )
    const outOfBandRepository = recordTest.agent.context.resolve(OutOfBandRepository)

    await outOfBandRepository.save(recordTest.agent.context, outOfBand)

    const outOfBand2 = await outOfBandRepository.findById(recordTest.agent.context, outOfBand.id)
    expect(outOfBand.toJSON()).toEqual(outOfBand2?.toJSON())

    outOfBand.setTags({
      myCustomTag: 'hello',
      isMorning: false,
    })
    await outOfBandRepository.update(recordTest.agent.context, outOfBand)

    const [outOfBand3] = await outOfBandRepository.findByQuery(recordTest.agent.context, {
      isMorning: false,

      // Tests custom tag mapping (invitationId -> outOfBandInvitation[@id])
      invitationId: '5d57ca2d-80ed-432c-8def-c40c75e8ab09',
    })
    expect(outOfBand3.toJSON()).toEqual(outOfBand.toJSON())

    const [outOfBand4] = await outOfBandRepository.findByQuery(recordTest.agent.context, {
      isMorning: false,
      // Id does not exist
      invitationId: 'a0b7c554-0beb-4a4c-808a-fd4495241770',
    })
    expect(outOfBand4).toBeUndefined()

    expect(
      await outOfBandRepository.findByQuery(recordTest.agent.context, {
        myCustomTag: 'not-hello',
      })
    ).toHaveLength(0)

    await outOfBandRepository.deleteById(recordTest.agent.context, outOfBand.id)

    expect(await outOfBandRepository.findByQuery(recordTest.agent.context, {})).toHaveLength(0)
  })
})
