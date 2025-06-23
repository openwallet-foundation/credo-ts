import { Transform, TransformationType } from 'class-transformer'
import { buildMessage, IsEnum, isInstance, IsString, registerDecorator, ValidateBy, ValidationArguments, ValidationOptions } from 'class-validator'

import { W3cCredential, W3cCredentialOptions } from '../../W3cCredential'
import { W3cCredentialSubject, W3cCredentialSubjectOptions } from '../../index'
import { mapSingleOrArray } from '../../../../../../utils'
import type { SingleOrArray } from '../../../../../../types'
import { CredoError } from '../../../../../../error'
import { IsSupportedStatusPurpose } from './BitStringStatusList'

// The purpose can be anything apart from this as well
export enum BitstringStatusListCredentialStatusPurpose {
  Revocation = 'revocation',
  Suspension = 'suspension',
}

// Define an interface for `credentialSubject`
export interface BitStringStatusListCredentialOptions extends W3cCredentialOptions {
  credentialSubject: SingleOrArray<BitStringStatusListCredentialSubjectOptions>
}

// Define an interface for `credentialSubject`
export interface BitStringStatusListCredentialSubjectOptions extends W3cCredentialSubjectOptions {
  type: string
  statusPurpose: string
  encodedList: string
}

export class BitStringStatusListCredentialSubject extends W3cCredentialSubject {
  public constructor(options: BitStringStatusListCredentialSubjectOptions) {
    super({
      id: options.id,
      claims: options.claims,
    })

    this.type = 'BitstringStatusList'
    this.statusPurpose = options.statusPurpose
    this.encodedList = options.encodedList
  }

  @IsString()
  public type!: string

  @IsSupportedStatusPurpose()
  public statusPurpose!: string

  @IsString()
  public encodedList!: string
}


/**
 * StatusListCredential describes the format of the verifiable credential that encapsulates the status list.
 *
 * @see https://www.w3.org/TR/vc-bitstring-status-list/#bitstringstatuslistcredential
 */
export class BitStringStatusListCredential extends W3cCredential {
  public static baseType = 'BitstringStatusListCredential'
  public static defaultTypes = ['VerifiableCredential', BitStringStatusListCredential.baseType]
  public constructor(options: BitStringStatusListCredentialOptions) {
    super({
      ...options,
      type: BitStringStatusListCredential.ensureTypes(options.type),
    })

    if (options) {
      this.credentialSubject = mapSingleOrArray(options.credentialSubject, (subject) =>
        subject instanceof BitStringStatusListCredentialSubject
          ? subject
          : new BitStringStatusListCredentialSubject(subject)
      )
    }
  }

  @IsBitStringStatusListCredentialSubject({ each: true })
  @BitStringStatusListCredentialSubjectTransformer()
  public credentialSubject!: SingleOrArray<BitStringStatusListCredentialSubject>

  /**
   * Ensures that the type array includes 'VerifiableCredential' and 'BitstringStatusListCredential'.
   * @param types The input types array.
   * @returns A types array guaranteed to include the required values.
   */
  private static ensureTypes(types?: string[]): string[] {
    const requiredTypes = new Set(BitStringStatusListCredential.defaultTypes)
    const finalTypes = new Set(types ?? [])
    requiredTypes.forEach((type) => finalTypes.add(type))
    return Array.from(finalTypes)
  }
}

export type W3cCredentialSubjectBase = W3cCredentialSubject extends { type: 'BitstringStatusList' }
  ? BitStringStatusListCredentialSubject
  : W3cCredentialSubject | BitStringStatusListCredentialSubject

export function BitStringStatusListCredentialSubjectTransformer() {
  return Transform(
    ({
      value,
      type: transformationType,
    }: {
      value: SingleOrArray<BitStringStatusListCredentialSubjectOptions>
      type: TransformationType
    }) => {
      if (transformationType === TransformationType.PLAIN_TO_CLASS) {
        const vToClass = (v: unknown) => {
          if (!v || typeof v !== 'object') {
            throw new CredoError('Invalid credential subject')
          }
          if (isInstance(v, BitStringStatusListCredentialSubject)) {
            return v
          }

          const { id, type, claims, statusPurpose, encodedList } = v as Record<string, unknown>

          if (id !== undefined && typeof id !== 'string') {
            throw new CredoError('Invalid credential subject id')
          }

          if (typeof statusPurpose !== 'string' || typeof encodedList !== 'string') {
            throw new CredoError('Invalid credential subject properties')
          }

          // Ensure claims is of the correct type
          if (claims !== undefined && (typeof claims !== 'object' || claims === null)) {
            throw new CredoError('Invalid claims property')
          }

          if (type !== undefined && typeof type !== 'string' && type !== 'BitstringStatusList') {
            throw new CredoError('Invalid type property')
          }

          return new BitStringStatusListCredentialSubject({
            id,
            type: type as string,
            claims: claims as Record<string, unknown> | undefined,
            statusPurpose: statusPurpose as string,
            encodedList,
          })
        }

        if (Array.isArray(value) && value.length === 0) {
          throw new CredoError('At least one credential subject is required')
        }

        return Array.isArray(value) ? value.map(vToClass) : vToClass(value)
      } else if (transformationType === TransformationType.CLASS_TO_PLAIN) {
        const vToJson = (v: unknown) => {
          if (v instanceof BitStringStatusListCredentialSubject) {
            const base = v.id ? { ...v.claims, id: v.id } : { ...v.claims }
            return {
              ...base,
              statusPurpose: v.statusPurpose,
              encodedList: v.encodedList,
            }
          }
          return v
        }

        return Array.isArray(value) ? value.map(vToJson) : vToJson(value)
      }
      // PLAIN_TO_PLAIN
      return value
    }
  )
}

export function IsBitStringStatusListCredentialSubject(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'IsBitStringStatusListCredentialSubject',
      validator: {
        validate: (value): boolean => {
          return isInstance(value, BitStringStatusListCredentialSubject)
        },
        defaultMessage: buildMessage(
          (eachPrefix) =>
            eachPrefix + '$property must be an object or an array of objects with an optional id property',
          validationOptions
        ),
      },
    },
    validationOptions
  )
}

/**
 * Custom validator to check if the subject matches the `BitStringStatusListCredentialSubject` type.
 */
export function IsBitStringStatusListCredentialSubjectOrW3cCredentialSubject(
  validationOptions?: ValidationOptions
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'IsBitStringStatusListCredentialSubjectOrW3cCredentialSubject',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (Array.isArray(value)) {
            return value.every(
              (subject) =>
                subject instanceof BitStringStatusListCredentialSubject || subject instanceof W3cCredentialSubject
            )
          }
          return value instanceof BitStringStatusListCredentialSubject || value instanceof W3cCredentialSubject
        },
        defaultMessage(args: ValidationArguments) {
          return `The credentialSubject must either be a W3cCredentialSubject or BitStringStatusListCredentialSubject.`;
        },
      },
    });
  };
}

/**
 * Custom transformer to dynamically resolve and transform the subject type.
 */
export function CredentialSubjectTransformer() {
  return Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((subject) =>
        (subject instanceof BitStringStatusListCredentialSubject && subject.type === 'BitstringStatusList')
          ? new BitStringStatusListCredentialSubject(subject)
          : new W3cCredentialSubject(subject)
      )
    }
    return (value instanceof BitStringStatusListCredentialSubject && value.type === 'BitstringStatusList'
      ? new BitStringStatusListCredentialSubject(value)
      : new W3cCredentialSubject(value))
  });
}