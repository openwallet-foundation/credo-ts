import type { CredentialMatch, ParsedPresentationDefinition, SubmissionRequirementResult } from 'presentation-exchange'
import { runPexQuery } from 'presentation-exchange'
import { MdocRecord } from '../../mdoc'
import { MdocDeviceResponse } from '../../mdoc/MdocDeviceResponse'
import { fieldMatchesToDocumentRequest } from '../../mdoc/utils/inputDescriptorToDocumentRequest'
import { SdJwtVcRecord } from '../../sd-jwt-vc'
import { applyDisclosuresForPaths, type ClaimPath } from '../../sd-jwt-vc/disclosureFrame'
import { ClaimFormat, W3cCredentialRecord } from '../../vc'
import { DifPresentationExchangeError } from '../DifPresentationExchangeError'
import type {
  DifPexCredentialMatch,
  DifPexCredentialMismatch,
  DifPexInputDescriptorToCredentials,
  DifPexQueryResult,
  SubmissionEntryCredential,
} from '../models'
import { getPexCredentialsForRecords } from './pexCredentials'

type CredentialRecord = W3cCredentialRecord | SdJwtVcRecord | MdocRecord

export function getCredentialsForRequest(
  parsedDefinition: ParsedPresentationDefinition,
  credentialRecords: Array<CredentialRecord>
): DifPexQueryResult {
  const { credentials, recordIndexes } = getPexCredentialsForRecords(credentialRecords)
  const result = runPexQuery(parsedDefinition, { credentials })

  const inputDescriptors = result.input_descriptors.map((inputDescriptorResult) => {
    // A record offered under more than one format designation is included once, under the first that matches
    const matchedRecordIndexes = new Set<number>()
    const matchingCredentials: DifPexCredentialMatch[] = []
    for (const { credential_index, ...match } of inputDescriptorResult.matching_credentials) {
      const recordIndex = recordIndexes[credential_index]
      if (matchedRecordIndexes.has(recordIndex)) continue

      matchedRecordIndexes.add(recordIndex)
      matchingCredentials.push(getCredentialMatch(credentialRecords[recordIndex], match))
    }

    // A record that matched under none of its designations is included once, preferring the reasons of a
    // designation the input descriptor allows over a format mismatch
    const mismatches = new Map<number, DifPexCredentialMismatch>()
    for (const { credential_index, ...mismatch } of inputDescriptorResult.non_matching_credentials) {
      const recordIndex = recordIndexes[credential_index]
      if (matchedRecordIndexes.has(recordIndex)) continue

      const existing = mismatches.get(recordIndex)
      const isFormatMismatch = (reasons: DifPexCredentialMismatch['reasons']) =>
        reasons.some(({ type }) => type === 'format')
      if (existing && (!isFormatMismatch(existing.reasons) || isFormatMismatch(mismatch.reasons))) continue

      mismatches.set(recordIndex, { ...mismatch, record: credentialRecords[recordIndex] })
    }

    return {
      ...inputDescriptorResult,
      matching_credentials: matchingCredentials,
      non_matching_credentials: [...mismatches.values()],
    }
  })

  return {
    ...result,
    input_descriptors: inputDescriptors,
  }
}

/**
 * Selects the first matching credential for each input descriptor that the submission requirements need.
 * Optional credentials are left out, so only the minimum amount of information is disclosed.
 */
export function selectCredentialsForRequest(queryResult: DifPexQueryResult): DifPexInputDescriptorToCredentials {
  if (!queryResult.can_be_satisfied) {
    throw new DifPresentationExchangeError('Could not find the required credentials for the presentation submission')
  }

  // Without submission requirements, all input descriptors must be satisfied
  const inputDescriptorIds = queryResult.submission_requirements
    ? selectInputDescriptorsForSubmissionRequirements(
        queryResult.input_descriptors,
        queryResult.submission_requirements
      )
    : queryResult.input_descriptors.map(({ input_descriptor_id }) => input_descriptor_id)

  // A request that only has optional requirements (e.g. min: 0) is seen as an error, as the presentation
  // definition should require at least some credentials.
  if (inputDescriptorIds.length === 0) {
    throw new DifPresentationExchangeError(
      'Presentation Definition does not require any credentials. Optional credentials are not included in the presentation submission.'
    )
  }

  const credentials: DifPexInputDescriptorToCredentials = {}
  for (const inputDescriptorId of inputDescriptorIds) {
    if (credentials[inputDescriptorId]) continue

    const inputDescriptorResult = queryResult.input_descriptors.find(
      ({ input_descriptor_id }) => input_descriptor_id === inputDescriptorId
    )
    const [match] = inputDescriptorResult?.matching_credentials ?? []
    if (!match) {
      throw new DifPresentationExchangeError(`No credential found for input descriptor '${inputDescriptorId}'`)
    }

    credentials[inputDescriptorId] = [getSubmissionEntryCredentialForMatch(match)]
  }

  return credentials
}

/**
 * Above this many input descriptors with a credential, the selection is made per submission requirement instead of
 * searched, as the search tries every combination.
 */
const MAX_SEARCHED_INPUT_DESCRIPTORS = 16

/**
 * The input descriptors to submit for the submission requirements: the fewest that satisfy all of them, so that the
 * least is disclosed, preferring input descriptors that come first in the presentation definition.
 *
 * An input descriptor can be in more than one group, and the verifier counts a submitted input descriptor for every
 * group it is in. So the selection is checked against all requirements at once: picking for each requirement on its
 * own can submit more members of a group than its `count` or `max` allows.
 */
function selectInputDescriptorsForSubmissionRequirements(
  inputDescriptors: DifPexQueryResult['input_descriptors'],
  requirements: SubmissionRequirementResult[]
): string[] {
  const satisfiesRequirements = (selected: Set<string>) =>
    requirements.every((requirement) => isSubmissionRequirementSatisfied(requirement, selected))

  // The input descriptors that have a credential and are in a group of a requirement, in definition order
  const groupMembers = new Set(requirements.flatMap(getGroupMembers))
  const candidates = inputDescriptors
    .filter(
      ({ input_descriptor_id, matching_credentials }) =>
        groupMembers.has(input_descriptor_id) && matching_credentials.length > 0
    )
    .map(({ input_descriptor_id }) => input_descriptor_id)

  if (candidates.length > MAX_SEARCHED_INPUT_DESCRIPTORS) {
    const selected = [...new Set(requirements.flatMap(getInputDescriptorIdsForSubmissionRequirement))]
    if (!satisfiesRequirements(new Set(selected))) {
      throw new DifPresentationExchangeError(
        'Could not select credentials that satisfy the submission requirements, as an input descriptor is in more than one group. Select the credentials manually.'
      )
    }
    return selected
  }

  for (let size = 0; size <= candidates.length; size++) {
    for (const selected of getCombinations(candidates, size)) {
      if (satisfiesRequirements(new Set(selected))) return selected
    }
  }

  throw new DifPresentationExchangeError(
    'Could not find the required credentials for the presentation submission, as no selection of the available credentials satisfies all submission requirements'
  )
}

/**
 * Whether submitting the `selected` input descriptors satisfies the requirement, as a verifier checks a submission:
 * `all` needs every member, and `pick` at least `needs_count`, and exactly `count`, or no more than `max`.
 */
function isSubmissionRequirementSatisfied(requirement: SubmissionRequirementResult, selected: Set<string>): boolean {
  const satisfiedCount = requirement.from_nested
    ? requirement.from_nested.filter((nested) => isSubmissionRequirementSatisfied(nested, selected)).length
    : requirement.input_descriptors.filter(({ input_descriptor_id }) => selected.has(input_descriptor_id)).length

  if (requirement.rule === 'all') return requirement.needs_count > 0 && satisfiedCount === requirement.needs_count
  if (satisfiedCount < requirement.needs_count) return false
  if (requirement.count !== undefined) return satisfiedCount === requirement.count
  return requirement.max === undefined || satisfiedCount <= requirement.max
}

function getGroupMembers(requirement: SubmissionRequirementResult): string[] {
  return requirement.from_nested
    ? requirement.from_nested.flatMap(getGroupMembers)
    : requirement.input_descriptors.map(({ input_descriptor_id }) => input_descriptor_id)
}

/**
 * The combinations of `size` items, keeping their order, and with the combinations of earlier items first.
 */
function* getCombinations<Item>(items: Item[], size: number, start = 0): Generator<Item[]> {
  if (size === 0) {
    yield []
    return
  }

  for (let index = start; index <= items.length - size; index++) {
    for (const rest of getCombinations(items, size - 1, index + 1)) {
      yield [items[index], ...rest]
    }
  }
}

/**
 * The input descriptors to submit for a satisfied submission requirement on its own: all of them for `all`, and the
 * first `needs_count` satisfied ones for `pick`.
 */
function getInputDescriptorIdsForSubmissionRequirement(submissionRequirement: SubmissionRequirementResult): string[] {
  if (submissionRequirement.from_nested) {
    const nested = submissionRequirement.from_nested
    const selected =
      submissionRequirement.rule === 'all'
        ? nested
        : nested.filter(({ satisfied }) => satisfied).slice(0, submissionRequirement.needs_count)

    return selected.flatMap(getInputDescriptorIdsForSubmissionRequirement)
  }

  const inputDescriptors =
    submissionRequirement.rule === 'all'
      ? submissionRequirement.input_descriptors
      : submissionRequirement.input_descriptors
          .filter(({ satisfied }) => satisfied)
          .slice(0, submissionRequirement.needs_count)

  return inputDescriptors.map(({ input_descriptor_id }) => input_descriptor_id)
}

/**
 * The credential to submit for a match, disclosing what the match discloses.
 */
export function getSubmissionEntryCredentialForMatch(match: DifPexCredentialMatch): SubmissionEntryCredential {
  if (match.record instanceof SdJwtVcRecord) {
    const { disclosure } = match as Extract<DifPexCredentialMatch, { record: SdJwtVcRecord }>
    return {
      claimFormat: ClaimFormat.SdJwtDc,
      credentialRecord: match.record,
      disclosedPayload: disclosure.output,
      disclosedPaths: disclosure.disclosed_paths,
    }
  }

  if (match.record instanceof MdocRecord) {
    const { disclosure } = match as Extract<DifPexCredentialMatch, { record: MdocRecord }>
    return {
      claimFormat: ClaimFormat.MsoMdoc,
      credentialRecord: match.record,
      disclosedPayload: disclosure.output,
    }
  }

  return {
    claimFormat: match.record.firstCredential.claimFormat,
    credentialRecord: match.record,
  }
}

/**
 * The match of a record for an input descriptor. An SD-JWT VC discloses the claims the matched fields resolved
 * to, whether or not the input descriptor sets `limit_disclosure`, as `@animo-id/pex` did. An mdoc discloses
 * the data elements the fields matched, as the device response holds them.
 */
function getCredentialMatch(
  credentialRecord: CredentialRecord,
  match: Omit<CredentialMatch, 'credential_index'>
): DifPexCredentialMatch {
  if (credentialRecord instanceof SdJwtVcRecord) {
    const paths: ClaimPath[] = match.fields.flatMap((fieldMatch) => fieldMatch.nodes.map(({ path }) => path))
    const { prettyClaims, disclosedPaths } = applyDisclosuresForPaths(credentialRecord.encoded, paths)

    return {
      ...match,
      record: credentialRecord,
      disclosure: { ...match.disclosure, output: prettyClaims, disclosed_paths: disclosedPaths },
    }
  }

  if (credentialRecord instanceof MdocRecord) {
    // The data elements the fields matched, which is also what presenting the mdoc requests
    const mdoc = credentialRecord.firstCredential
    const documentRequest = fieldMatchesToDocumentRequest(mdoc.docType, match.fields)
    const output = documentRequest ? MdocDeviceResponse.limitDisclosureToDocumentRequest(mdoc, documentRequest) : {}

    return { ...match, record: credentialRecord, disclosure: { ...match.disclosure, output } }
  }

  if (credentialRecord instanceof W3cCredentialRecord) {
    return { ...match, record: credentialRecord }
  }

  throw new DifPresentationExchangeError('Unrecognized credential record type')
}
