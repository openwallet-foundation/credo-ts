import type { JsonObject } from '../../../../types'
import type { W3cJsonCredential } from '../credential/W3cJsonCredential'

export interface W3cJsonPresentation {
  '@context': Array<string | JsonObject>
  id?: string
  type: Array<string>
  holder: string | { id?: string }
  verifiableCredential: Array<W3cJsonCredential | string>
  [key: string]: unknown
}
