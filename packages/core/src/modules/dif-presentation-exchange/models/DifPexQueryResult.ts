import type {
  CredentialMatch,
  CredentialMismatch,
  InputDescriptorResult,
  LimitDisclosureResult,
  PexQueryResult,
} from 'presentation-exchange'
import type { MdocNameSpaces, MdocRecord } from '../../mdoc'
import type { SdJwtVcRecord } from '../../sd-jwt-vc'
import type { ClaimPath } from '../../sd-jwt-vc/disclosureFrame'
import type { W3cCredentialRecord } from '../../vc'

type DifPexCredentialMatchBase = Omit<CredentialMatch, 'credential_index' | 'disclosure'>

/**
 * A credential that satisfies an input descriptor, with its record and what presenting it for the input
 * descriptor discloses.
 */
export type DifPexCredentialMatch =
  | (DifPexCredentialMatchBase & {
      record: SdJwtVcRecord

      /**
       * `output` holds the claims as the verifier receives them, including the claims that are not selectively
       * disclosable and are always disclosed. `disclosed_paths` are the paths to those claims in the credential,
       * which are what to disclose when presenting it.
       */
      disclosure: LimitDisclosureResult & { disclosed_paths: ClaimPath[] }
    })
  | (DifPexCredentialMatchBase & {
      record: MdocRecord

      /**
       * `output` holds the data elements that presenting the mdoc for the input descriptor discloses.
       */
      disclosure: Omit<LimitDisclosureResult, 'output'> & { output: MdocNameSpaces }
    })
  | (DifPexCredentialMatchBase & {
      record: W3cCredentialRecord
      disclosure: LimitDisclosureResult
    })

/**
 * A credential that does not satisfy an input descriptor, with its record and every reason it doesn't.
 */
export type DifPexCredentialMismatch = Omit<CredentialMismatch, 'credential_index'> & {
  record: SdJwtVcRecord | W3cCredentialRecord | MdocRecord
}

export type DifPexInputDescriptorResult = Omit<
  InputDescriptorResult,
  'matching_credentials' | 'non_matching_credentials'
> & {
  /**
   * The credentials that satisfy the input descriptor. A record is listed once, also when it is matched
   * under more than one format designation.
   */
  matching_credentials: DifPexCredentialMatch[]

  /**
   * The credentials that don't satisfy the input descriptor, and why. A record that satisfies the input
   * descriptor is not listed. A record offered under more than one format designation is listed once, with
   * the reasons for a designation the input descriptor allows, if there is one.
   *
   * This includes credentials of an unrelated type. Use the reasons to find the ones that are close, such as
   * a credential of the right type that is missing a claim.
   */
  non_matching_credentials: DifPexCredentialMismatch[]
}

/**
 * The result of querying the credentials in the wallet with a presentation definition. Has the shape of the
 * `presentation-exchange` query result, with the records of the credentials added.
 */
export type DifPexQueryResult = Omit<PexQueryResult, 'input_descriptors'> & {
  input_descriptors: DifPexInputDescriptorResult[]
}
