import { instanceToInstance, instanceToPlain, plainToInstance } from 'class-transformer'
import { z } from 'zod'
import { ClassValidationError } from '../error/ClassValidationError'
import { MessageValidator } from './MessageValidator'
import { deepCopy } from './object'
import {
  type ClassConstructor,
  getEncodingSchema,
  type zBaseSchema,
  zDecodeWithErrorHandling,
  zEncodeWithErrorHandling,
} from './zod'

interface Validate {
  /**
   * Whether to validate the class instance. Ignored for classes with an `encodingSchema`,
   * as decoding with a zod schema always validates.
   *
   * @default true
   */
  validate?: boolean
}

function encodeWithSchema<T>(encodingSchema: zBaseSchema, classInstance: T) {
  const className = (classInstance as object).constructor.name

  return zEncodeWithErrorHandling(encodingSchema, classInstance, `Error encoding ${className}`)
}

function decodeWithSchema<T>(encodingSchema: zBaseSchema, json: unknown, cls: ClassConstructor<T>): T {
  const decoded: Record<string, unknown> = zDecodeWithErrorHandling(encodingSchema, json, `Error decoding ${cls.name}`)
  const instance = new cls() as Record<string, unknown>

  for (const [key, value] of Object.entries(decoded)) {
    // Undefined values don't override the default values of the class (as with class-transformer)
    if (value === undefined && instance[key] !== undefined) continue

    instance[key] = value
  }

  return instance as T
}

// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class JsonTransformer {
  public static toJSON<T>(classInstance: T) {
    const encodingSchema = getEncodingSchema((classInstance as object | undefined)?.constructor)
    if (encodingSchema) {
      // Copied, so the JSON never shares state with the class instance (as with class-transformer)
      // biome-ignore lint/suspicious/noExplicitAny: matches the return type of instanceToPlain
      return deepCopy(encodeWithSchema(encodingSchema, classInstance)) as Record<string, any>
    }

    return instanceToPlain(classInstance, {
      exposeDefaultValues: true,
    })
  }

  public static fromJSON<T>(
    // biome-ignore lint/suspicious/noExplicitAny: no explanation
    json: any,
    cls: ClassConstructor<T>,
    { validate = true }: Validate = {}
  ): T {
    const encodingSchema = getEncodingSchema(cls)
    if (encodingSchema) {
      // Copied, so the class instance never shares state with the JSON (as with class-transformer)
      return decodeWithSchema(encodingSchema, deepCopy(json), cls)
    }

    const instance = plainToInstance(cls, json, { exposeDefaultValues: true })

    // Skip validation
    if (!validate) return instance

    if (!instance) {
      throw new ClassValidationError('Cannot validate instance of ', { classType: Object.getPrototypeOf(cls).name })
    }
    MessageValidator.validateSync(instance)

    return instance
  }

  public static clone<T>(classInstance: T): T {
    const cls = (classInstance as object | undefined)?.constructor as ClassConstructor<T> | undefined
    const encodingSchema = getEncodingSchema(cls)
    if (cls && encodingSchema) {
      return decodeWithSchema(encodingSchema, deepCopy(encodeWithSchema(encodingSchema, classInstance)), cls)
    }

    return instanceToInstance(classInstance, {
      exposeDefaultValues: true,
      enableCircularCheck: true,
      enableImplicitConversion: true,
      ignoreDecorators: true,
    })
  }

  public static serialize<T>(classInstance: T): string {
    const encodingSchema = getEncodingSchema((classInstance as object | undefined)?.constructor)
    if (encodingSchema) {
      return JSON.stringify(encodeWithSchema(encodingSchema, classInstance))
    }

    return JSON.stringify(JsonTransformer.toJSON(classInstance))
  }

  public static deserialize<T>(jsonString: string, cls: ClassConstructor<T>, { validate = true }: Validate = {}): T {
    const json = JSON.parse(jsonString)

    // The parsed JSON is not shared, so it doesn't have to be copied
    const encodingSchema = getEncodingSchema(cls)
    if (encodingSchema) {
      return decodeWithSchema(encodingSchema, json, cls)
    }

    return JsonTransformer.fromJSON(json, cls, { validate })
  }
}

/**
 * A property holding an instance of `cls`, encoded and decoded using the {@link JsonTransformer}.
 *
 * This allows classes using a zod `encodingSchema` to contain classes that still use class-transformer
 * and class-validator. It works for classes with an `encodingSchema` as well, so it doesn't have to be
 * updated when the nested class is migrated.
 *
 * The class is passed as a function, so circular imports are resolved when the schema is used.
 *
 * When encoding, plain objects are accepted as well, as class-transformer accepted these too.
 */
export function zJsonTransformerClass<T extends object>(
  getClass: () => ClassConstructor<T>,
  { validate = true }: Validate = {}
) {
  return z.codec(
    z.unknown(),
    z.custom<T>((value) => typeof value === 'object' && value !== null, 'Must be an object'),
    {
      decode: (json, payload) => {
        try {
          return JsonTransformer.fromJSON(json, getClass(), { validate })
        } catch (error) {
          payload.issues.push({
            code: 'custom',
            message: error instanceof Error ? error.message : String(error),
            input: json,
          })
          return z.NEVER
        }
      },
      encode: (instance) => JsonTransformer.toJSON(instance),
    }
  )
}
