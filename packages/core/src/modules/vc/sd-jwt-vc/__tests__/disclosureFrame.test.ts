import { CredoError } from '../../../../error'
import { NON_DISCLOSEABLE_FIELDS, validateW3cV2SdJwtDisclosureFrame } from '../disclosureFrame'

describe('validateW3cV2SdJwtDisclosureFrame', () => {
  test('accepts an undefined frame', () => {
    expect(() => validateW3cV2SdJwtDisclosureFrame(undefined)).not.toThrow()
  })

  test('accepts a frame disclosing regular claims', () => {
    expect(() =>
      validateW3cV2SdJwtDisclosureFrame({
        _sd: ['validUntil'],
        credentialSubject: { _sd: ['name', 'age'], degree: { _sd: ['name'] } },
      })
    ).not.toThrow()
  })

  test.each(NON_DISCLOSEABLE_FIELDS)('rejects %s listed in a top level _sd', (field) => {
    expect(() => validateW3cV2SdJwtDisclosureFrame({ _sd: [field] })).toThrow(CredoError)
    expect(() => validateW3cV2SdJwtDisclosureFrame({ _sd: [field] })).toThrow(
      `'${field}' property cannot be selectively disclosed`
    )
  })

  test.each(NON_DISCLOSEABLE_FIELDS)('rejects %s used as a top level frame key', (field) => {
    expect(() => validateW3cV2SdJwtDisclosureFrame({ [field]: { _sd: ['id'] } })).toThrow(
      `'${field}' property cannot be selectively disclosed`
    )
  })

  test('accepts a nested claim sharing a name with a non-discloseable field', () => {
    // `credentialSubject.type` is a claim of the subject, not the credential's `type`
    expect(() =>
      validateW3cV2SdJwtDisclosureFrame({ credentialSubject: { _sd: ['type', 'credentialStatus'] } })
    ).not.toThrow()
  })
})
