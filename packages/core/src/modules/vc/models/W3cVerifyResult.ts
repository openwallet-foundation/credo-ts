export type W3cVerifyPresentationResult = W3cVerifyResult<W3cPresentationValidations>
export type W3cVerifyCredentialResult = W3cVerifyResult<W3cCredentialValidations>

export type SingleValidationResult = { isValid: boolean; error?: Error }

interface W3cVerifyResult<Validations> {
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

interface W3cCredentialValidations {
  /**
   * Validation that validates whether the credential conforms
   * to the data model and is currently valid (not expired or
   * issued in the future).
   */
  dataModel: SingleValidationResult

  /**
   * Whether the signature of the credential is valid
   */
  signature: SingleValidationResult

  /**
   * Whether the credential status is still valid, meaning
   * that is hasn't been revoked yet.
   */
  credentialStatus: SingleValidationResult

  /**
   * Whether the 'issuer' of the credential is also the
   * signer of the credential proof
   */
  issuerIsSigner: SingleValidationResult

  /**
   * NOTE: this validation is currently only present for ldp_vc credentials.
   * When this validation is present, ALL OTHER validations will be skipped.
   *
   * Whether the presentation is valid according to the [vc.js](https://github.com/digitalbazaar/vc)
   * library. As the library handles all validations, it is not possible to include the other
   * validation items separately. In the future the vc.js library will be replaced to provide a similar
   * validation result for all credential formats.
   */
  vcJs: SingleValidationResult
}

interface W3cPresentationValidations {
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
   * Validation results of the credentials inside the presentation.
   * The order matches the order of credentials in the presentation.
   *
   * This object extends the credential verification result with the exception that
   * a new `credentialSubjectAuthentication` has been added.
   */
  credentials: W3cVerifyResult<
    W3cCredentialValidations & {
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
  >[]

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

  /**
   * NOTE: this validation is currently only present for ldp_vp presentations.
   * When this validation is present, ALL OTHER validations will be skipped.
   *
   * Whether the presentation is valid according to the [vc.js](https://github.com/digitalbazaar/vc)
   * library. As the library handles all validations, it is not possible to include the other
   * validation items separately. In the future the vc.js library will be replaced to provide a similar
   * validation result for all credential formats.
   */
  vcJs: SingleValidationResult
}
