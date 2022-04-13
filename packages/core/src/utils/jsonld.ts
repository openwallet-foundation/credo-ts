import type { SingleOrArray } from './type'
import type { NodeObject, ValueObject, IncludedBlock, ExpandedTermDefinition } from '@digitalcredentials/jsonld'

export interface ContextDefinition {
  '@base'?: Keyword['@base'] | undefined
  '@direction'?: Keyword['@direction'] | undefined
  '@import'?: Keyword['@import'] | undefined
  '@language'?: Keyword['@language'] | undefined
  '@propagate'?: Keyword['@propagate'] | undefined
  '@protected'?: Keyword['@protected'] | undefined
  '@type'?:
    | {
        '@container': '@set'
        '@protected'?: Keyword['@protected'] | undefined
      }
    | undefined
  '@version'?: Keyword['@version'] | undefined
  '@vocab'?: Keyword['@vocab'] | undefined
  [key: string]: null | string | ExpandedTermDefinition | ContextDefinition[keyof ContextDefinition]
}

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
