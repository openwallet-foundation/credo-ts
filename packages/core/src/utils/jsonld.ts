import type { SingleOrArray } from './type'
import type { ContextDefinition, NodeObject, ValueObject, IncludedBlock } from 'jsonld'

type ContainerType = '@language' | '@index' | '@id' | '@graph' | '@type'
type ContainerTypeArray =
  | ['@graph', '@id']
  | ['@id', '@graph']
  | ['@set', '@graph', '@id']
  | ['@set', '@id', '@graph']
  | ['@graph', '@set', '@id']
  | ['@id', '@set', '@graph']
  | ['@graph', '@id', '@set']
  | ['@id', '@graph', '@set']
  | ['@set', ContainerType]
  | [ContainerType, '@set']

export type Keyword = {
  '@base': string | null
  '@container': SingleOrArray<'@list' | '@set' | ContainerType> | ContainerTypeArray | null
  '@context': SingleOrArray<null | string | ContextDefinition>
  '@direction': 'ltr' | 'rtl' | null
  '@graph': SingleOrArray<ValueObject | NodeObject>
  '@id': string
  '@import': string
  '@included': IncludedBlock
  '@index': string
  '@json': '@json'
  '@language': string
  '@list': SingleOrArray<null | boolean | number | string | NodeObject | ValueObject>
  '@nest': Record<string, unknown>
  '@none': '@none'
  '@prefix': boolean
  '@propagate': boolean
  '@protected': boolean
  '@reverse': string
  '@set': SingleOrArray<null | boolean | number | string | NodeObject | ValueObject>
  '@type': string
  '@value': null | boolean | number | string
  '@version': '1.1'
  '@vocab': string | null
}

export const orArrayToArray = (val?: SingleOrArray<string>): Array<string> | undefined => {
  if (!val) return undefined
  if (Array.isArray(val)) return val
  return [val]
}
