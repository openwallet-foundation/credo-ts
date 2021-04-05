import { Transform, TransformationType } from 'class-transformer'
import { JsonTransformer } from './JsonTransformer'

/**
 * Decorator that transforms json to and from corresponding record.
 *
 * @example
 * class Example {
 *   RecordTransformer(Service)
 *   private services: Record<string, Service>;
 * }
 */
export function RecordTransformer<T>(Class: { new (...args: any[]): T }) {
  return Transform(({ value, type }) => {
    switch (type) {
      case TransformationType.CLASS_TO_PLAIN:
        return Object.entries(value).reduce(
          (accumulator, [key, attribute]) => ({
            ...accumulator,
            [key]: JsonTransformer.toJSON(attribute),
          }),
          {}
        )

      case TransformationType.PLAIN_TO_CLASS:
        return Object.entries(value).reduce(
          (accumulator, [key, attribute]) => ({
            ...accumulator,
            [key]: JsonTransformer.fromJSON(attribute, Class),
          }),
          {}
        )

      default:
        return value
    }
  })
}
