import { TestMessage } from '../../../tests/TestMessage'
import { ClassValidationError } from '../../error/ClassValidationError'
import { JsonTransformer } from '../../utils'
import { IsValidMessageType, parseMessageType } from '../../utils/messageType'
import { AgentMessage } from '../AgentMessage'

class CustomProtocolMessage extends AgentMessage {
  @IsValidMessageType(CustomProtocolMessage.type)
  public readonly type = CustomProtocolMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/fake-protocol/1.5/message')
}

describe('AgentMessage', () => {
  describe('toJSON', () => {
    it('should only use did:sov message prefix if useLegacyDidSovPrefix is true', () => {
      const message = new TestMessage()

      const jsonDidComm = message.toJSON()
      expect(jsonDidComm['@type']).toBe('https://didcomm.org/connections/1.0/invitation')

      const jsonSov = message.toJSON({ useLegacyDidSovPrefix: true })
      expect(jsonSov['@type']).toBe('did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0/invitation')
    })
  })

  describe('@IsValidMessageType', () => {
    it('successfully validates if the message type is exactly the supported message type', async () => {
      const json = {
        '@id': 'd61c7e3d-d4af-469b-8d42-33fd14262e17',
        '@type': 'https://didcomm.org/fake-protocol/1.5/message',
      }

      const message = JsonTransformer.fromJSON(json, CustomProtocolMessage)

      expect(message).toBeInstanceOf(CustomProtocolMessage)
    })

    it('successfully validates if the message type minor version is lower than the supported message type', async () => {
      const json = {
        '@id': 'd61c7e3d-d4af-469b-8d42-33fd14262e17',
        '@type': 'https://didcomm.org/fake-protocol/1.2/message',
      }

      const message = JsonTransformer.fromJSON(json, CustomProtocolMessage)

      await expect(message).toBeInstanceOf(CustomProtocolMessage)
    })

    it('successfully validates if the message type minor version is higher than the supported message type', () => {
      const json = {
        '@id': 'd61c7e3d-d4af-469b-8d42-33fd14262e17',
        '@type': 'https://didcomm.org/fake-protocol/1.8/message',
      }

      const message = JsonTransformer.fromJSON(json, CustomProtocolMessage)

      expect(message).toBeInstanceOf(CustomProtocolMessage)
    })

    it('throws a validation error if the message type major version differs from the supported message type', async () => {
      const json = {
        '@id': 'd61c7e3d-d4af-469b-8d42-33fd14262e17',
        '@type': 'https://didcomm.org/fake-protocol/2.0/message',
      }

      expect(() => JsonTransformer.fromJSON(json, CustomProtocolMessage)).toThrowError(ClassValidationError)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let thrownError: any
      try {
        JsonTransformer.fromJSON(json, CustomProtocolMessage)
      } catch (e) {
        thrownError = e
      }
      expect(thrownError.message).toContain('Failed to validate class.')
      expect(thrownError.validationErrors).toMatchObject([
        {
          target: {
            appendedAttachments: undefined,
            id: 'd61c7e3d-d4af-469b-8d42-33fd14262e17',
            l10n: undefined,
            pleaseAck: undefined,
            service: undefined,
            thread: undefined,
            timing: undefined,
            transport: undefined,
            type: 'https://didcomm.org/fake-protocol/2.0/message',
          },
          value: 'https://didcomm.org/fake-protocol/2.0/message',
          property: 'type',
          children: [],
          constraints: {
            isValidMessageType: 'type does not match the expected message type (only minor version may be lower)',
          },
        },
      ])
    })
  })
})
