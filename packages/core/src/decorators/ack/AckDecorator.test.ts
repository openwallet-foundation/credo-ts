import { BaseMessage } from '../../agent/BaseMessage'
import { ClassValidationError } from '../../error/ClassValidationError'
import { JsonTransformer } from '../../utils/JsonTransformer'
import { MessageValidator } from '../../utils/MessageValidator'
import { Compose } from '../../utils/mixins'

import { AckDecorated } from './AckDecoratorExtension'

describe('Decorators | AckDecoratorExtension', () => {
  class TestMessage extends Compose(BaseMessage, [AckDecorated]) {
    public toJSON(): Record<string, unknown> {
      return JsonTransformer.toJSON(this)
    }
  }

  test('transforms AckDecorator class to JSON', () => {
    const message = new TestMessage()
    message.setPleaseAck()
    expect(message.toJSON()).toEqual({
      '@id': undefined,
      '@type': undefined,
      '~please_ack': {
        on: ['RECEIPT'],
      },
    })
  })

  test('transforms Json to AckDecorator class', () => {
    const transformed = () =>
      JsonTransformer.fromJSON(
        {
          '~please_ack': {},
          '@id': undefined,
          '@type': undefined,
        },
        TestMessage,
        {
          validate: true,
        }
      )

    expect(() => transformed()).toThrow(ClassValidationError)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let caughtError: any
    try {
      transformed()
    } catch (e) {
      caughtError = e
    }
    expect(caughtError.message.includes('An instance of TestMessage has failed the validation')).toBeTruthy()
    expect(caughtError.message.includes('property id has failed the following constraints: matches')).toBeTruthy()
    expect(caughtError.message.includes('- property type has failed the following constraints: matches')).toBeTruthy()
    expect(
      caughtError.message.includes('property pleaseAck.on has failed the following constraints: isArray, isEnum')
    ).toBeTruthy()
    expect(caughtError.validationErrors).toMatchObject([
      {
        children: [],
        constraints: { matches: 'id must match /[-_./a-zA-Z0-9]{8,64}/ regular expression' },
        property: 'id',
        target: {
          id: undefined,
          pleaseAck: {},
          type: undefined,
        },
        value: undefined,
      },
      {
        children: [],
        constraints: {
          matches: 'type must match /(.*?)([a-zA-Z0-9._-]+)\\/(\\d[^/]*)\\/([a-zA-Z0-9._-]+)$/ regular expression',
        },
        property: 'type',
        target: {
          id: undefined,
          pleaseAck: {},
          type: undefined,
        },
        value: undefined,
      },
      {
        children: [
          {
            children: [],
            constraints: { isArray: 'on must be an array', isEnum: 'each value in on must be a valid enum value' },
            property: 'on',
            target: {},
            value: undefined,
          },
        ],
        property: 'pleaseAck',
        target: {
          id: undefined,
          pleaseAck: {},
          type: undefined,
        },
        value: {},
      },
    ])
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
