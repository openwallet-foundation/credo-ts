import type { Jwk, Key } from '@credo-ts/core'

import { Openid4vciIssuer } from '@openid4vc/openid4vci'

// TODO: export from oid4vc-ts
type VerifiedCredentialRequestAttestationProof = Awaited<
  ReturnType<InstanceType<typeof Openid4vciIssuer>['verifyCredentialRequestAttestationProof']>
>
type VerifiedCredentialRequestJwtProof = Awaited<
  ReturnType<InstanceType<typeof Openid4vciIssuer>['verifyCredentialRequestJwtProof']>
>['keyAttestation']

export type OpenId4VcCredentialHolderAttestationBinding = {
  method: 'attestation'

  /**
   * The key attestation JWT to use to request issuance of the credentials based
   * on the attested_keys.
   *
   * When the `keyAttestationJwt` contains a `nonce` payload value it will be sent
   * as an `attestation` proof (without signing using a key in the attested key).
   * NOTE that the `nonce` value must match with the `c_nonce` value from the issuer.
   *
   * If no nonce is provided, the `jwt` proof type will be used and the proof will be
   * signed using the first key from the `attested_keys` array.
   */
  // NOTE: creating the key attestation jwt proof MIGHT require external communication/
  // pin confirmation/biometric prompt and thus handling that in credo might be tricky.
  // another solution would be to require the signed jwt proof to be returned, so the wallet
  // can gracefully handle all the cases and render the needed UI.
  keyAttestationJwt: string
}

export interface OpenId4VcCredentialHolderDidBinding {
  method: 'did'
  didUrls: string[]
}

export interface OpenId4VcCredentialHolderJwkBinding {
  method: 'jwk'
  keys: Jwk[]
}

export type VerifiedOpenId4VcCredentialHolderBinding = {
  proofType: 'jwt' | 'attestation'

  /**
   * The key attestation that was provided to attest the keys.
   * Always defined if `proofType` is `attestation`, as well
   * as when `key_attestations_required` is defined in the
   * credential issuer metadata
   */
  keyAttestation?: VerifiedCredentialRequestAttestationProof | VerifiedCredentialRequestJwtProof

  /**
   * The binding method of the keys.
   *
   * Binding method `did` is only supported for proof type `jwt`.
   */
  bindingMethod: 'did' | 'jwk'
} & (
  | {
      bindingMethod: 'did'

      /**
       * The DIDs that were provided as part of the `jwt` proofs in the credential request
       */
      keys: Array<{
        method: 'did'
        key: Key
        didUrl: string
      }>
    }
  | {
      bindingMethod: 'jwk'

      /**
       * The keys that were provided as part of the credential request proof.
       * - If `proofType` is `attestation` these keys were extracted from the signed key attestation, but no proof was signed using one of the attested keys
       * - If `proofType` is `jwt` and `attestation` is defined, the keys were extracted from the attestation, and proof was signed using one of the attested keys
       * - Otherwise if `proofType` is `jwt` and no `attestation` is defined, the keys were not attested, and for each individual key a proof was signed using that key.
       */
      keys: Array<{
        method: 'jwk'
        key: Key
        jwk: Jwk
      }>
    }
)

export type OpenId4VcCredentialHolderBinding =
  | OpenId4VcCredentialHolderDidBinding
  | OpenId4VcCredentialHolderJwkBinding
  | OpenId4VcCredentialHolderAttestationBinding
