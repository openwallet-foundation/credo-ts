import type { SingleValidationResult } from './W3cVerifyResult'

export type W3cV2VerifyCredentialResult = W3cV2VerifyResult<W3cV2CredentialValidations>

export interface W3cV2VerifyPresentationResult {
  /**
   * Whether the verification as a whole is valid. This means the VP-level
   * validation result and all credential entry results have passed.
   */
  isValid: boolean

  /**
   * VP-level verification result.
   */
  presentation: W3cV2VerifyResult<W3cV2PresentationValidations>

  /**
   * Per-entry credential verification results. The order matches the order of
   * credentials in the presentation.
   */
  credentialEntries: W3cV2PresentationCredentialEntryResult[]

  /**
   * Error that was caught during verification not related to the specific
   * VP-level validations or individual credential entry validations.
   */
  error?: Error
}

interface W3cV2VerifyResult<Validations> {
  /**
   * Whether the verification as a whole is valid. This means that
   * all validations inside the validations object should have passed.
   */
  isValid: boolean

  /**
   * Validations that have been performed
   */
  validations: Partial<Validations>

  /**
   * Error that was caught during verification not related to
   * any of the specific validations that are performed
   */
  error?: Error
}

interface W3cV2CredentialValidations {
  /**
   * Validate whether the credential conforms
   * to the data model and JWT-level temporal claims.
   */
  dataModel: SingleValidationResult

  /**
   * Validation that evaluates VC2 `validFrom`/`validUntil`
   * semantics from the credential body.
   */
  validityPeriod: SingleValidationResult

  /**
   * Whether the signature of the credential is valid
   */
  signature: SingleValidationResult

  /**
   * Whether the credential status can be treated as valid under
   * currently-supported VC2 status verification behavior.
   */
  credentialStatus: SingleValidationResult

  /**
   * Whether the 'issuer' of the credential is also the
   * signer of the credential proof
   */
  issuerIsSigner: SingleValidationResult
}

interface W3cV2PresentationValidations {
  /**
   * Validation that validates whether the presentation conforms
   * to the data model.
   */
  dataModel: SingleValidationResult

  /**
   * Whether the signature of the presentation is valid
   */
  presentationSignature: SingleValidationResult

  /**
   * Whether the presentation is signed by the 'holder' of the
   * presentation.
   *
   * NOTE: this check will return the value `true` for `isValid`
   * when the `holder` property is not set on the presentation.
   * as the goal of this validation is to assert whether the
   * 'holder' property that is used in the presentation is valid.
   * If the property is not present, the validation can be seen as
   * successful
   */
  holderIsSigner: SingleValidationResult
}

export type W3cV2PresentationCredentialEntryResult = W3cV2VerifyResult<
  W3cV2CredentialValidations & {
    /**
     * Whether the credential subject authentication is valid. Note this only
     * takes into account credentialSubject authentication, and not cases where
     * the holder of a credential may be different from the credential subject.
     *
     * The credentialSubject authentication is deemed valid in the following cases:
     *  - The credential has no credential subject identifiers. In this case the
     *    credential is seen as a bearer credential and thus authentication is not needed.
     *  - The credential has AT LEAST one credential subject id, and the presentation
     *    is signed by at least one of the credential subject ids.
     */
    credentialSubjectAuthentication: SingleValidationResult
  }
>
