import * as jsonldSignatures from '../linked-data-proofs/adapters/jsonld-signatures-adapter'
import * as vc from '../linked-data-proofs/adapters/vc-adapter'
import * as jsonld from './jsonld'

export { defaultDocumentLoader } from './documentLoader'

export { defaultDocumentLoader } from './documentLoader'

// Temporary re-export of vc libraries. As the libraries don't
// have types, it's inconvenient to import them from non-core packages
// as we would have to re-add the types. We re-export these libraries,
// so they can be imported by other packages. In the future we should look
// at proper types for these libraries so we don't have to re-export them.
export const vcLibraries = {
  jsonldSignatures,
  jsonld: {
    ...jsonld,
    ...jsonld.default,
  },
  vc: {
    ...vc,
    ...vc.default,
  },
}
