import { JsonTransformer } from '@credo-ts/core'

import {
  DidCommAutoAcceptCredential,
  DidCommCredentialExchangeRecord,
  DidCommCredentialExchangeRepository,
  DidCommCredentialRole,
  DidCommCredentialState,
} from '@credo-ts/didcomm'
import { DrizzleRecordTest, setupDrizzleRecordTest } from '../../../../tests/testDatabase'
import { didcommCredentialExchangeDrizzleRecord } from '../index'

describe.each(['postgres', 'sqlite'] as const)('CredentialExchangeRecord with %s', (type) => {
  let recordTest: DrizzleRecordTest

  beforeAll(async () => {
    recordTest = await setupDrizzleRecordTest(type, didcommCredentialExchangeDrizzleRecord)
  })

  afterAll(async () => {
    await recordTest.teardown()
  })

  test('create, retrieve, update, query and delete credential exchange record', async () => {
    const credentialExchange = JsonTransformer.fromJSON(
      {
        id: '6e7fcaf3-ebb9-45ed-9261-7b893f732bc1',
        connectionId: '1eb24dc2-1d81-4249-baf9-783e03176fd3',
        threadId: '1c92f4ff-e859-4086-bb09-ad979c63d6e5',
        parentThreadId: '4b99cdca-847c-4083-8ea0-8880f2c410ff',
        state: DidCommCredentialState.Abandoned,
        role: DidCommCredentialRole.Holder,
        autoAcceptCredential: DidCommAutoAcceptCredential.Always,
        revocationNotification: {
          revocationDate: new Date(),
          comment: 'hello',
        },
        errorMessage: 'hello',
        protocolVersion: '2',
        credentials: [
          {
            credentialRecordType: 'w3c',
            credentialRecordId: '8633f56d-abc9-4229-ba09-9ca6611ad8e4',
          },
        ],
        credentialAttributes: [
          {
            name: 'hello',
            'mime-type': 'application/json',
            value: 'something',
          },
        ],
        linkedAttachments: [
          {
            '@id': 'a402b029-6dfb-4840-97f3-b3b0f8e7ac49',
            'mime-type': 'hello',
            data: {
              json: { some: 'key' },
            },
          },
        ],
      },
      DidCommCredentialExchangeRecord
    )
    const credentialExchangeRepository = recordTest.agent.context.resolve(DidCommCredentialExchangeRepository)

    await credentialExchangeRepository.save(recordTest.agent.context, credentialExchange)

    const credentialExchange2 = await credentialExchangeRepository.findById(
      recordTest.agent.context,
      credentialExchange.id
    )
    expect(credentialExchange).toEqual(credentialExchange2)

    credentialExchange.setTags({
      myCustomTag: 'hello',
      isMorning: false,
    })
    await credentialExchangeRepository.update(recordTest.agent.context, credentialExchange)

    const [credentialExchange3] = await credentialExchangeRepository.findByQuery(recordTest.agent.context, {
      isMorning: false,
      credentialIds: ['8633f56d-abc9-4229-ba09-9ca6611ad8e4'],
    })
    expect(credentialExchange3).toEqual(credentialExchange)

    const [credentialExchange4] = await credentialExchangeRepository.findByQuery(recordTest.agent.context, {
      isMorning: false,
      // Id does not exist
      credentialIds: ['a0b7c554-0beb-4a4c-808a-fd4495241770'],
    })
    expect(credentialExchange4).toBeUndefined()

    expect(
      await credentialExchangeRepository.findByQuery(recordTest.agent.context, {
        myCustomTag: 'not-hello',
      })
    ).toHaveLength(0)

    await credentialExchangeRepository.deleteById(recordTest.agent.context, credentialExchange.id)

    expect(await credentialExchangeRepository.findByQuery(recordTest.agent.context, {})).toHaveLength(0)
  })
})
