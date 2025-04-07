import { Type } from 'class-transformer'
import {
  IsNumberString,
  IsString,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator'

import { W3cCredentialStatus } from '../W3cCredentialStatus'
import { BitstringStatusListCredentialStatusPurpose } from './BitStringStatusListCredential'
import { JsonTransformer } from '../../../../../../utils'


export interface BitStringStatusListMessageOptions {
  // a string representing the hexadecimal value of the status prefixed with 0x
  status: string
  // a string used by software developers to assist with debugging which SHOULD NOT be displayed to end users
  message?: string
  [key: string]: unknown
}

export class BitStringStatusListMessage {
  public constructor(options: BitStringStatusListMessageOptions) {
    if (options) {
      this.status = options.status
      this.message = options.message
    }
  }

  @IsString()
  public status!: string

  @IsString()
  public message?: string;

  [key: string]: unknown | undefined
}

/**
 * Status list Entry, used to check status of a credential being issued or verified during presentaton.
 *
 * @see https://www.w3.org/TR/vc-bitstring-status-list/#bitstringstatuslistentry
 */
export class BitStringStatusListEntry extends W3cCredentialStatus {
  public static type = 'BitstringStatusListEntry'

  public constructor(options: IBitStringStatusListEntryOptions) {
    super({ id: options.id, type: BitStringStatusListEntry.type })

    if (options) {
      this.statusPurpose = options.statusPurpose
      this.statusListCredential = options.statusListCredential
      this.statusListIndex = options.statusListIndex

      if (options.statusSize) this.statusSize = options.statusSize
      if (options.statusMessage) this.statusMessage = options.statusMessage
    }
  }

  @IsSupportedStatusPurpose({ message: 'Invalid statusPurpose value' })
  public statusPurpose!: string

  @IsString()
  public statusListIndex!: string

  @IsString()
  public statusListCredential!: string

  @IsNumberString()
  public statusSize?: string

  @Type(() => BitStringStatusListMessage)
  public statusMessage?: BitStringStatusListStatusMessage[]


  public static fromJson(json: Record<string, unknown>) {
    return JsonTransformer.fromJSON(json, BitStringStatusListEntry)
  }
}

export interface BitStringStatusListStatusMessage {
  // a string representing the hexadecimal value of the status prefixed with 0x
  status: string
  // a string used by software developers to assist with debugging which SHOULD NOT be displayed to end users
  message?: string
  // We can have some key value pairs as well
  [key: string]: unknown
}

export interface IBitStringStatusListEntryOptions {
  id: string
  type: string
  statusPurpose: string
  // Unique identifier for specific credential
  statusListIndex: string
  // Must be url referencing to a VC of type 'BitstringStatusListCredential'
  statusListCredential: string
  // The statusSize indicates the size of the status entry in bits
  statusSize?: string
  // Must be preset if statusPurpose is message
  /**
   * the length of which MUST equal the number of possible status messages indicated by statusSize
   * (e.g., statusMessage array MUST have 2 elements if statusSize has 1 bit,
   * 4 elements if statusSize has 2 bits, 8 elements if statusSize has 3 bits, etc.).
   */
  statusMessage?: BitStringStatusListStatusMessage[]
  // An implementer MAY include the statusReference property. If present, its value MUST be a URL or an array of URLs [URL] which dereference to material related to the status
  statusReference?: string | string[]
}

export function IsSupportedStatusPurpose(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isSupportedStatusPurpose',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          return Object.values(BitstringStatusListCredentialStatusPurpose).includes(value)
        },
        defaultMessage(args: ValidationArguments) {
          return `The statusPurpose must be one of the following: ${Object.values(
            BitstringStatusListCredentialStatusPurpose
          ).join(', ')}`
        },
      },
    })
  }
}
