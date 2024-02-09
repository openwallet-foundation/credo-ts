import type { PlaintextMessage } from '../types'
import type { ValidationOptions, ValidationArguments } from 'class-validator'

import { ValidateBy, ValidationError, buildMessage } from 'class-validator'

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
    protocolMajorVersion: parseInt(protocolVersionMajor),
    protocolMinorVersion: parseInt(protocolVersionMinor),
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
    protocolMajorVersion: parseInt(protocolVersionMajor),
    protocolMinorVersion: parseInt(protocolVersionMinor),
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
 * If allowLegacyDidSovPrefixMismatch is true (default) it will allow for the case where the incoming protocol uri still has the legacy
 * did:sov:BzCbsNYhMrjHiqZDTUASHg;spec did prefix, but the expected message type does not. This only works for incoming messages with a prefix
 * of did:sov:BzCbsNYhMrjHiqZDTUASHg;spec and the expected message type having a prefix value of https:/didcomm.org
 *
 * @example
 * const incomingProtocolUri = parseDidCommProtocolUri('https://didcomm.org/connections/1.0')
 * const expectedProtocolUri = parseDidCommProtocolUri('https://didcomm.org/connections/1.4')
 *
 * // Returns true because the incoming protocol uri is equal to the expected protocol uri, except for
 * // the minor version, which is lower
 * const isIncomingProtocolUriSupported = supportsIncomingDidCommProtocolUri(incomingProtocolUri, expectedProtocolUri)
 *
 * @example
 * const incomingProtocolUri = parseDidCommProtocolUri('did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0')
 * const expectedProtocolUri = parseDidCommProtocolUri('https://didcomm.org/connections/1.0')
 *
 * // Returns true because the incoming protocol uri is equal to the expected protocol uri, except for
 * // the legacy did sov prefix.
 * const isIncomingProtocolUriSupported = supportsIncomingDidCommProtocolUri(incomingProtocolUri, expectedProtocolUri)
 */
export function supportsIncomingDidCommProtocolUri(
  incomingProtocolUri: ParsedDidCommProtocolUri,
  expectedProtocolUri: ParsedDidCommProtocolUri,
  { allowLegacyDidSovPrefixMismatch = true }: { allowLegacyDidSovPrefixMismatch?: boolean } = {}
) {
  const incomingDocumentUri = allowLegacyDidSovPrefixMismatch
    ? replaceLegacyDidSovPrefix(incomingProtocolUri.documentUri)
    : incomingProtocolUri.documentUri

  const documentUriMatches = expectedProtocolUri.documentUri === incomingDocumentUri
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
 * If allowLegacyDidSovPrefixMismatch is true (default) it will allow for the case where the incoming message type still has the legacy
 * did:sov:BzCbsNYhMrjHiqZDTUASHg;spec did prefix, but the expected message type does not. This only works for incoming messages with a prefix
 * of did:sov:BzCbsNYhMrjHiqZDTUASHg;spec and the expected message type having a prefix value of https:/didcomm.org
 *
 * @example
 * const incomingMessageType = parseMessageType('https://didcomm.org/connections/1.0/request')
 * const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')
 *
 * // Returns true because the incoming message type is equal to the expected message type, except for
 * // the minor version, which is lower
 * const isIncomingMessageTypeSupported = supportsIncomingMessageType(incomingMessageType, expectedMessageType)
 *
 * @example
 * const incomingMessageType = parseMessageType('did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0/request')
 * const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.0/request')
 *
 * // Returns true because the incoming message type is equal to the expected message type, except for
 * // the legacy did sov prefix.
 * const isIncomingMessageTypeSupported = supportsIncomingMessageType(incomingMessageType, expectedMessageType)
 */
export function supportsIncomingMessageType(
  incomingMessageType: ParsedMessageType,
  expectedMessageType: ParsedMessageType,
  { allowLegacyDidSovPrefixMismatch = true }: { allowLegacyDidSovPrefixMismatch?: boolean } = {}
) {
  const incomingDocumentUri = allowLegacyDidSovPrefixMismatch
    ? replaceLegacyDidSovPrefix(incomingMessageType.documentUri)
    : incomingMessageType.documentUri

  const documentUriMatches = expectedMessageType.documentUri === incomingDocumentUri
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

export function IsValidDRPCResponse(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    ValidateBy(
      {
        name: 'isValidDRPCResponse',
        validator: {
          validate: (value: any, _: ValidationArguments): boolean => {
            // Check if value is a valid DRPCResponseObject, an array of DRPCResponseObject (possibly mixed with empty objects), or an empty object
            let isValid = false
            if (Array.isArray(value)) {
              if (value.length > 0) {
                isValid = value.every(isValidDRPCResponse)
              }
            } else {
              isValid = isValidDRPCResponse(value)
            }
            if (!isValid) {
              throw new ValidationError()
            }
            return isValid
          },
          defaultMessage: buildMessage(
            (eachPrefix) => eachPrefix + '$property is not a valid DRPCResponse',
            validationOptions
          ),
        },
      },
      validationOptions
    )(target, propertyKey)
  }
}

function isValidDRPCResponse(value: any): boolean {
  // Check if value is an object
  if (typeof value !== 'object' || value === null) {
    return false
  }

  // Check if it's an empty object
  if (Object.keys(value).length === 0) {
    return true
  }

  // Check if it's a valid DRPCResponseObject
  if ('jsonrpc' in value && 'id' in value) {
    // Check if 'result' and 'error' are valid
    if ('result' in value && typeof value.result === 'undefined') {
      return false
    }
    if ('error' in value && !isValidDRPCResponseError(value.error)) {
      return false
    }
    return true
  }

  return false
}

function isValidDRPCResponseError(error: any): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
}

export function IsValidDRPCRequest(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    ValidateBy(
      {
        name: 'isValidDRPCRequest',
        validator: {
          validate: (value: any, _: ValidationArguments): boolean => {
            // Check if value is a DRPCRequestObject or an array of DRPCRequestObject
            let isValid = false
            if (!Array.isArray(value)) {
              isValid = isValidDRPCRequestObject(value)
            } else {
              isValid = value.every(isValidDRPCRequestObject)
            }

            if (!isValid) {
              throw new ValidationError()
            }

            return isValid
          },
          defaultMessage: buildMessage(
            (eachPrefix) => eachPrefix + '$property is not a valid DRPCRequest',
            validationOptions
          ),
        },
      },
      validationOptions
    )(target, propertyKey)
  }
}

export function isValidDRPCRequestObject(value: any): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return 'jsonrpc' in value && 'method' in value && 'id' in value
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
