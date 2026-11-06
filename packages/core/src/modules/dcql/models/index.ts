export * from './DcqlCredentialsForRequest'

import type {
  DcqlCredential as _DcqlCredential,
  DcqlMdocCredential as _DcqlMdocCredential,
  DcqlPresentationResult as _DcqlPresentationResult,
  DcqlQuery as _DcqlQuery,
  DcqlQueryResult as _DcqlQueryResult,
  DcqlSdJwtVcCredential as _DcqlSdJwtVcCredential,
  DcqlW3cVcCredential as _DcqlW3cVcCredential,
} from 'dcql'
import type { VerifiablePresentation } from '../../dif-presentation-exchange'
import type { MdocRecord } from '../../mdoc'
import type { SdJwtVcRecord } from '../../sd-jwt-vc'
import type { ClaimPath } from '../../sd-jwt-vc/disclosureFrame'
import type { W3cCredentialRecord, W3cV2CredentialRecord } from '../../vc'

export type DcqlQuery = _DcqlQuery.Input | _DcqlQuery.Output
export type DcqlCredential = _DcqlCredential.Model['Input']
export type DcqlMdocCredential = _DcqlMdocCredential.Model['Input']
export type DcqlSdJwtVcCredential = _DcqlSdJwtVcCredential.Model['Input']
export type DcqlW3cVcCredential = _DcqlW3cVcCredential.Model['Input']

/**
 * Added to a valid claim set of a selectively disclosable credential (SD-JWT VC, W3C V2 SD-JWT VC).
 */
export interface DcqlClaimSetDisclosedPaths {
  /**
   * The paths to the claims in the credential that presenting the claim set discloses. Includes the
   * claims that are not selectively disclosable, which are always disclosed, and gives array elements
   * the position they have in the credential. That position can differ from the one in `output`, which
   * leaves out elements that are not disclosed, as the verifier receives it.
   *
   * A path stands for the claim and everything below it, so a claim that is disclosed as a whole has
   * a single path.
   *
   * Pass these as `disclosedPaths` when presenting the credential.
   */
  disclosed_paths?: ClaimPath[]
}

type WithDisclosedPaths<Claims> = Claims extends { valid_claim_sets: Array<infer ClaimSet> }
  ? Omit<Claims, 'valid_claim_sets'> & {
      valid_claim_sets: [ClaimSet & DcqlClaimSetDisclosedPaths, ...Array<ClaimSet & DcqlClaimSetDisclosedPaths>]
    }
  : Claims

type _DcqlFailedCredential = NonNullable<_DcqlQueryResult['credential_matches'][string]['failed_credentials']>[number]
type _DcqlValidCredential = NonNullable<_DcqlQueryResult['credential_matches'][string]['valid_credentials']>[number]

export type DcqlFailedCredential = Omit<_DcqlFailedCredential, 'claims'> & {
  claims: WithDisclosedPaths<_DcqlFailedCredential['claims']>
  record: MdocRecord | SdJwtVcRecord | W3cCredentialRecord | W3cV2CredentialRecord
}

export type DcqlValidCredential = Omit<_DcqlValidCredential, 'claims'> & {
  claims: WithDisclosedPaths<_DcqlValidCredential['claims']>
  record: MdocRecord | SdJwtVcRecord | W3cCredentialRecord | W3cV2CredentialRecord
}

export type DcqlMatchWithRecord =
  | (Omit<_DcqlQueryResult['credential_matches'][string], 'success'> & {
      success: true
      valid_credentials: [DcqlValidCredential, ...DcqlValidCredential[]]
      failed_credentials?: [DcqlFailedCredential, ...DcqlFailedCredential[]]
    })
  | (Omit<_DcqlQueryResult['credential_matches'][string], 'success'> & {
      success: false
      failed_credentials?: [DcqlFailedCredential, ...DcqlFailedCredential[]]
    })

export type DcqlQueryResult = Omit<_DcqlQueryResult.Output, 'credential_matches'> & {
  credential_matches: Record<string, DcqlMatchWithRecord>
}

export type DcqlEncodedPresentationsEntry = string | Record<string, unknown>
export type DcqlEncodedPresentations = Record<
  string,
  [DcqlEncodedPresentationsEntry, ...DcqlEncodedPresentationsEntry[]]
>
export type DcqlPresentation = Record<string, [VerifiablePresentation, ...VerifiablePresentation[]]>

export type DcqlPresentationResult = _DcqlPresentationResult.Input
