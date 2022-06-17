import { BaseMessage } from '../../agent/BaseMessage'
import { JsonTransformer } from '../../utils/JsonTransformer'
import { MessageValidator } from '../../utils/MessageValidator'
import { Compose } from '../../utils/mixins'

import { AckValues } from './AckDecorator'
import { AckDecorated } from './AckDecoratorExtension'

describe('Decorators | AckDecoratorExtension', () => {
  class TestMessage extends Compose(BaseMessage, [AckDecorated]) {
    public toJSON(): Record<string, unknown> {
      return JsonTransformer.toJSON(this)
    }
  }

  test('transforms AckDecorator class to JSON', () => {
    const message = new TestMessage()
    message.setPleaseAck([AckValues.Receipt])
    expect(message.toJSON()).toEqual({
      '@id': undefined,
      '@type': undefined,
      '~please_ack': {
        on: ['RECEIPT'],
      },
    })
  })

  test('transforms Json to AckDecorator class', () => {
    const transformed = JsonTransformer.fromJSON({ '~please_ack': {} }, TestMessage)

    expect(transformed).toEqual({
      pleaseAck: {
        on: ['RECEIPT'],
      },
    })
    expect(transformed).toBeInstanceOf(TestMessage)
  })

  test('successfully transforms ack decorator with on field present', () => {
    const transformed = JsonTransformer.fromJSON(
      {
        '~please_ack': {
          on: ['RECEIPT'],
        },
        '@id': '7517433f-1150-46f2-8495-723da61b872a',
        '@type': 'https://didcomm.org/test-protocol/1.0/test-message',
      },
      TestMessage
    )

    expect(transformed).toEqual({
      id: '7517433f-1150-46f2-8495-723da61b872a',
      type: 'https://didcomm.org/test-protocol/1.0/test-message',
      pleaseAck: {
        on: ['RECEIPT'],
      },
    })
    expect(transformed).toBeInstanceOf(TestMessage)
  })

  // this covers the pre-aip 2 please ack decorator
  test('sets `on` value to `receipt` if `on` is not present in ack decorator', () => {
    const transformed = JsonTransformer.fromJSON(
      {
        '~please_ack': {},
        '@id': '7517433f-1150-46f2-8495-723da61b872a',
        '@type': 'https://didcomm.org/test-protocol/1.0/test-message',
      },
      TestMessage
    )

    expect(transformed).toEqual({
      id: '7517433f-1150-46f2-8495-723da61b872a',
      type: 'https://didcomm.org/test-protocol/1.0/test-message',
      pleaseAck: {
        on: ['RECEIPT'],
      },
    })
    expect(transformed).toBeInstanceOf(TestMessage)
  })

  test('successfully validates please ack decorator', async () => {
    const transformedWithDefault = JsonTransformer.fromJSON(
      {
        '~please_ack': {},
        '@id': '7517433f-1150-46f2-8495-723da61b872a',
        '@type': 'https://didcomm.org/test-protocol/1.0/test-message',
      },
      TestMessage
    )

    await expect(MessageValidator.validate(transformedWithDefault)).resolves.toBeUndefined()

    const transformedWithoutDefault = JsonTransformer.fromJSON(
      {
        '~please_ack': {
          on: ['OUTCOME'],
        },
        '@id': '7517433f-1150-46f2-8495-723da61b872a',
        '@type': 'https://didcomm.org/test-protocol/1.0/test-message',
      },
      TestMessage
    )

    await expect(MessageValidator.validate(transformedWithoutDefault)).resolves.toBeUndefined()

    const transformedWithIncorrectValue = JsonTransformer.fromJSON(
      {
        '~please_ack': {
          on: ['NOT_A_VALID_VALUE'],
        },
        '@id': '7517433f-1150-46f2-8495-723da61b872a',
        '@type': 'https://didcomm.org/test-protocol/1.0/test-message',
      },
      TestMessage
    )

    await expect(MessageValidator.validate(transformedWithIncorrectValue)).rejects.toMatchObject([
      {
        children: [
          {
            children: [],
            constraints: { isEnum: 'each value in on must be a valid enum value' },
            property: 'on',
            target: { on: ['NOT_A_VALID_VALUE'] },
            value: ['NOT_A_VALID_VALUE'],
          },
        ],
        property: 'pleaseAck',
      },
    ])
  })
})
