import type { JsonObject } from '../../../../types'
import type { DifPresentationExchangeSubmission } from '../../../dif-presentation-exchange'
import type { W3cJsonCredential } from '../credential/W3cJsonCredential'

export interface W3cJsonPresentation {
  '@context': Array<string | JsonObject>
  id?: string
  type: Array<string>
  holder: string | { id?: string }
  verifiableCredential: Array<W3cJsonCredential | string>
  presentation_submission?: DifPresentationExchangeSubmission
  [key: string]: unknown
}
