import { ClaimFormat } from '../../models/ClaimFormat'
import { mapDataIntegrityIssuesToCredoError } from '../W3cV2DataIntegrityIssueMapping'

describe('W3cV2DataIntegrityIssueMapping', () => {
  test('returns undefined when no issues are provided', () => {
    expect(
      mapDataIntegrityIssuesToCredoError({
        operation: 'verifyCredential',
        claimFormat: ClaimFormat.DiVc,
      })
    ).toBeUndefined()
  })

  test('maps DI issues into a CredoError message', () => {
    const error = mapDataIntegrityIssuesToCredoError({
      operation: 'verifyPresentation',
      claimFormat: ClaimFormat.DiVp,
      issues: [
        {
          code: 'PROOF_VERIFICATION_ERROR',
          message: 'Proof value is invalid',
          path: '$.proof[0]',
        },
        {
          code: 'MISSING_VERIFICATION_METHOD',
          message: 'No verification method could be resolved',
        },
      ],
    })

    expect(error).toBeDefined()
    expect(error?.message).toContain("Data Integrity verifyPresentation for 'di_vp' reported 2 issue(s)")
    expect(error?.message).toContain('[PROOF_VERIFICATION_ERROR] Proof value is invalid (path: $.proof[0])')
    expect(error?.message).toContain('[MISSING_VERIFICATION_METHOD] No verification method could be resolved')
  })
})
