import type {
  PresentationPreview,
  PresentationPreviewAttribute,
  PresentationPreviewPredicate,
} from './PresentationPreview'

export interface IndyProposeProofFormat {
  attributes?: PresentationPreviewAttribute[]
  predicates?: PresentationPreviewPredicate[]
  nonce: string
  name: string
  version: string
  proofPreview?: PresentationPreview
}
