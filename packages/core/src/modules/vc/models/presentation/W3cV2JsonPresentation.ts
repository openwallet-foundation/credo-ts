import type { JsonObject } from '../../../../types'
import { W3cV2JsonCredential } from '../credential/W3cV2JsonCredential'

export interface W3cV2JsonPresentation {
  '@context': string | Array<string | JsonObject>
  id?: string
  type: string | Array<string>
  holder?: string | { id: string; [property: string]: unknown }
  verifiableCredential: Array<W3cV2JsonCredential | string>
  [key: string]: unknown
}
