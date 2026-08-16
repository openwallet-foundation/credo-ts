import { describe, test } from 'vitest'

describe('DifPresentationExchangeService presentation signing', () => {
  describe('presentation signing with non-DID subject identifiers', () => {
    test.todo('credential with no credentialSubject.id falls back to holder DID for signing')
    test.todo('credential with non-DID URI credentialSubject.id logs warning and falls back to holder DID')
    test.todo('credential with DID credentialSubject.id uses that DID unchanged')
    test.todo('getHolderDid throws when agent wallet contains no created DIDs')
  })

  describe('LDP-VP proof type and verification method selection', () => {
    test.todo('uses ldp_vp.proof_type from presentation definition level for LDP-VP signing')
    test.todo('intersects ldp_vp.proof_type constraints from presentation definition and input descriptors')
    test.todo('selects a non-first authentication key when the first key is incompatible with requested VP suite')
    test.todo('deterministically picks a compatible key and suite when multiple options are available')
    test.todo('throws actionable error when no compatible key and ldp_vp.proof_type tuple exists')
    test.todo('falls back to key default signature suite when no ldp_vp format constraint is present')
    test.todo('never uses ldp_vc.proof_type for VP signing when both ldp_vc and ldp_vp are present')
  })
})
