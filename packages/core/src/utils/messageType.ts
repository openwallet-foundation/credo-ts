import type { PlaintextMessage } from '../types'
import type { VersionString } from './version'
import type { ValidationOptions, ValidationArguments } from 'class-validator'

import { ValidateBy, buildMessage } from 'class-validator'

import { rightSplit } from './string'
import { parseVersionString } from './version'

export interface ParsedMessageType {
  /**
   * Message name
   *
   * @example request
   */
  messageName: string

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

  /**
   * Uri identifier of the message. Includes all parts
   * or the message type.
   *
   * @example https://didcomm.org/connections/1.0/request
   */
  messageTypeUri: string
}

export function parseMessageType(messageType: string): ParsedMessageType {
  const [documentUri, protocolName, protocolVersion, messageName] = rightSplit(messageType, '/', 3)
  const [protocolMajorVersion, protocolMinorVersion] = parseVersionString(protocolVersion as VersionString)

  return {
    documentUri,
    protocolName,
    protocolVersion,
    protocolMajorVersion,
    protocolMinorVersion,
    messageName,
    protocolUri: `${documentUri}/${protocolName}/${protocolVersion}`,
    messageTypeUri: messageType,
  }
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
 * In addition it will make sure whether the incoming message minor version is equal to or less than the minor version of the
 * expected message type. Only if all of the above conditions are met, the method will return true.
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

  // Check if everything except for the minor version matches
  if (!documentUriMatches || !protocolNameMatches || !majorVersionMatches || !messageNameMatches) {
    return false
  }

  // Check if the minor version of the incoming message type is lower or equal to the expected message type
  return incomingMessageType.protocolMinorVersion <= expectedMessageType.protocolMinorVersion
}

export function canHandleMessageType(messageClass: { type: ParsedMessageType }, messageType: string): boolean {
  const incomingMessageType = parseMessageType(messageType)

  return supportsIncomingMessageType(incomingMessageType, messageClass.type)
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
            eachPrefix + '$property does not match the expected message type (only minor version may be lower)',
          validationOptions
        ),
      },
    },
    validationOptions
  )
}

export function replaceLegacyDidSovPrefixOnMessage(message: PlaintextMessage | Record<string, unknown>) {
  message['@type'] = replaceLegacyDidSovPrefix(message['@type'] as string)
}

export function replaceNewDidCommPrefixWithLegacyDidSovOnMessage(message: Record<string, unknown>) {
  message['@type'] = replaceNewDidCommPrefixWithLegacyDidSov(message['@type'] as string)
}

export function replaceLegacyDidSovPrefix(messageType: string) {
  const didSovPrefix = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec'
  const didCommPrefix = 'https://didcomm.org'

  if (messageType.startsWith(didSovPrefix)) {
    return messageType.replace(didSovPrefix, didCommPrefix)
  }

  return messageType
}

export function replaceNewDidCommPrefixWithLegacyDidSov(messageType: string) {
  const didSovPrefix = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec'
  const didCommPrefix = 'https://didcomm.org'

  if (messageType.startsWith(didCommPrefix)) {
    return messageType.replace(didCommPrefix, didSovPrefix)
  }

  return messageType
}
