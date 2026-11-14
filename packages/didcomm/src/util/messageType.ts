import type { ValidationArguments, ValidationOptions } from 'class-validator'
import { buildMessage, ValidateBy } from 'class-validator'

const PROTOCOL_URI_REGEX = /^(.+)\/([^/\\]+)\/(\d+).(\d+)$/
const MESSAGE_TYPE_REGEX = /^(.+)\/([^/\\]+)\/(\d+).(\d+)\/([^/\\]+)$/

export interface ParsedDidCommProtocolUri {
  /**
   * Version of the protocol
   *
   * @example 1.0
   */
  protocolVersion: string

  /**
   * Major version of the protocol
   *
   * @example 1
   */
  protocolMajorVersion: number

  /**
   * Minor version of the protocol
   *
   * @example 0
   */
  protocolMinorVersion: number

  /**
   * Name of the protocol
   *
   * @example connections
   */
  protocolName: string

  /**
   * Document uri of the message.
   *
   * @example https://didcomm.org
   */
  documentUri: string

  /**
   * Uri identifier of the protocol. Includes the
   * documentUri, protocolName and protocolVersion.
   * Useful when working with feature discovery
   *
   * @example https://didcomm.org/connections/1.0
   */
  protocolUri: string
}

export interface ParsedMessageType extends ParsedDidCommProtocolUri {
  /**
   * Message name
   *
   * @example request
   */
  messageName: string

  /**
   * Uri identifier of the message. Includes all parts
   * or the message type.
   *
   * @example https://didcomm.org/connections/1.0/request
   */
  messageTypeUri: string
}

// TODO: rename to `parseDidCommMessageType` and `DidCommParsedProtocolUri`
// in the future
export function parseMessageType(messageType: string): ParsedMessageType {
  const match = MESSAGE_TYPE_REGEX.exec(messageType)

  if (!match) {
    throw new Error(`Invalid message type: ${messageType}`)
  }

  const [, documentUri, protocolName, protocolVersionMajor, protocolVersionMinor, messageName] = match

  return {
    documentUri,
    protocolName,
    protocolVersion: `${protocolVersionMajor}.${protocolVersionMinor}`,
    protocolMajorVersion: Number.parseInt(protocolVersionMajor, 10),
    protocolMinorVersion: Number.parseInt(protocolVersionMinor, 10),
    messageName,
    protocolUri: `${documentUri}/${protocolName}/${protocolVersionMajor}.${protocolVersionMinor}`,
    messageTypeUri: messageType,
  }
}

export function parseDidCommProtocolUri(didCommProtocolUri: string): ParsedDidCommProtocolUri {
  const match = PROTOCOL_URI_REGEX.exec(didCommProtocolUri)

  if (!match) {
    throw new Error(`Invalid protocol uri: ${didCommProtocolUri}`)
  }

  const [, documentUri, protocolName, protocolVersionMajor, protocolVersionMinor] = match

  return {
    documentUri,
    protocolName,
    protocolVersion: `${protocolVersionMajor}.${protocolVersionMinor}`,
    protocolMajorVersion: Number.parseInt(protocolVersionMajor, 10),
    protocolMinorVersion: Number.parseInt(protocolVersionMinor, 10),
    protocolUri: `${documentUri}/${protocolName}/${protocolVersionMajor}.${protocolVersionMinor}`,
  }
}

/**
 * Check whether the incoming didcomm protocol uri is a protocol uri that can be handled by comparing it to the expected didcomm protocol uri.
 * In this case the expected protocol uri is e.g. the handshake protocol supported (https://didcomm.org/connections/1.0), and the incoming protocol uri
 * is the uri that is parsed from the incoming out of band invitation handshake_protocols.
 *
 * The method will make sure the following fields are equal:
 *  - documentUri
 *  - protocolName
 *  - majorVersion
 *
 * @example
 * const incomingProtocolUri = parseDidCommProtocolUri('https://didcomm.org/connections/1.0')
 * const expectedProtocolUri = parseDidCommProtocolUri('https://didcomm.org/connections/1.4')
 *
 * // Returns true because the incoming protocol uri is equal to the expected protocol uri, except for
 * // the minor version, which is lower
 * const isIncomingProtocolUriSupported = supportsIncomingDidCommProtocolUri(incomingProtocolUri, expectedProtocolUri)
 */
export function supportsIncomingDidCommProtocolUri(
  incomingProtocolUri: ParsedDidCommProtocolUri,
  expectedProtocolUri: ParsedDidCommProtocolUri
) {
  const documentUriMatches = expectedProtocolUri.documentUri === incomingProtocolUri.documentUri
  const protocolNameMatches = expectedProtocolUri.protocolName === incomingProtocolUri.protocolName
  const majorVersionMatches = expectedProtocolUri.protocolMajorVersion === incomingProtocolUri.protocolMajorVersion

  // Everything besides the minor version must match
  return documentUriMatches && protocolNameMatches && majorVersionMatches
}

/**
 * Check whether the incoming message type is a message type that can be handled by comparing it to the expected message type.
 * In this case the expected message type is e.g. the type declared on an agent message class, and the incoming message type is the type
 * that is parsed from the incoming JSON.
 *
 * The method will make sure the following fields are equal:
 *  - documentUri
 *  - protocolName
 *  - majorVersion
 *  - messageName
 *
 * @example
 * const incomingMessageType = parseMessageType('https://didcomm.org/connections/1.0/request')
 * const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')
 *
 * // Returns true because the incoming message type is equal to the expected message type, except for
 * // the minor version, which is lower
 * const isIncomingMessageTypeSupported = supportsIncomingMessageType(incomingMessageType, expectedMessageType)
 */
export function supportsIncomingMessageType(
  incomingMessageType: ParsedMessageType,
  expectedMessageType: ParsedMessageType
) {
  const documentUriMatches = expectedMessageType.documentUri === incomingMessageType.documentUri
  const protocolNameMatches = expectedMessageType.protocolName === incomingMessageType.protocolName
  const majorVersionMatches = expectedMessageType.protocolMajorVersion === incomingMessageType.protocolMajorVersion
  const messageNameMatches = expectedMessageType.messageName === incomingMessageType.messageName

  // Everything besides the minor version must match
  return documentUriMatches && protocolNameMatches && majorVersionMatches && messageNameMatches
}

export function canHandleMessageType(
  messageClass: { type: ParsedMessageType },
  messageType: ParsedMessageType
): boolean {
  return supportsIncomingMessageType(messageClass.type, messageType)
}

/**
 * class-validator decorator to check if the string message type value matches with the
 * expected message type. This uses {@link supportsIncomingMessageType}.
 */
export function IsValidMessageType(
  messageType: ParsedMessageType,
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isValidMessageType',
      constraints: [messageType],
      validator: {
        validate: (value, args: ValidationArguments): boolean => {
          const [expectedMessageType] = args.constraints as [ParsedMessageType]

          // Type must be string
          if (typeof value !== 'string') {
            return false
          }

          const incomingMessageType = parseMessageType(value)
          return supportsIncomingMessageType(incomingMessageType, expectedMessageType)
        },
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property does not match the expected message type (only minor version may be lower)`,
          validationOptions
        ),
      },
    },
    validationOptions
  )
}
