import type { W3cCredentialRecord } from '../../vc'
import type {
  DifPexCredentialsForRequest,
  DifPexCredentialsForRequestRequirement,
  DifPexCredentialsForRequestSubmissionEntry,
} from '../models'
import type { IPresentationDefinition, SelectResults, SubmissionRequirementMatch } from '@sphereon/pex'
import type { InputDescriptorV1, InputDescriptorV2, SubmissionRequirement } from '@sphereon/pex-models'

import { PEX } from '@sphereon/pex'
import { Rules } from '@sphereon/pex-models'
import { default as jp } from 'jsonpath'

import { deepEquality } from '../../../utils'
import { DifPresentationExchangeError } from '../DifPresentationExchangeError'

import { getSphereonOriginalVerifiableCredential } from './transform'

export async function getCredentialsForRequest(
  presentationDefinition: IPresentationDefinition,
  credentialRecords: Array<W3cCredentialRecord>,
  holderDIDs: Array<string>
): Promise<DifPexCredentialsForRequest> {
  if (!presentationDefinition) {
    throw new DifPresentationExchangeError('Presentation Definition is required to select credentials for submission.')
  }

  const pex = new PEX()

  const encodedCredentials = credentialRecords.map((c) => getSphereonOriginalVerifiableCredential(c.credential))

  // FIXME: there is a function for this in the VP library, but it is not usable atm
  const selectResultsRaw = pex.selectFrom(presentationDefinition, encodedCredentials, {
    holderDIDs,
    // limitDisclosureSignatureSuites: [],
    // restrictToDIDMethods,
    // restrictToFormats
  })

  const selectResults = {
    ...selectResultsRaw,
    // Map the encoded credential to their respective w3c credential record
    verifiableCredential: selectResultsRaw.verifiableCredential?.map((encoded) => {
      const credentialRecord = credentialRecords.find((record) => {
        const originalVc = getSphereonOriginalVerifiableCredential(record.credential)
        return deepEquality(originalVc, encoded)
      })

      if (!credentialRecord) {
        throw new DifPresentationExchangeError('Unable to find credential in credential records.')
      }

      return credentialRecord
    }),
  }

  const presentationSubmission: DifPexCredentialsForRequest = {
    requirements: [],
    areRequirementsSatisfied: false,
    name: presentationDefinition.name,
    purpose: presentationDefinition.purpose,
  }

  // If there's no submission requirements, ALL input descriptors MUST be satisfied
  if (!presentationDefinition.submission_requirements || presentationDefinition.submission_requirements.length === 0) {
    presentationSubmission.requirements = getSubmissionRequirementsForAllInputDescriptors(
      presentationDefinition.input_descriptors,
      selectResults
    )
  } else {
    presentationSubmission.requirements = getSubmissionRequirements(presentationDefinition, selectResults)
  }

  // There may be no requirements if we filter out all optional ones. To not makes things too complicated, we see it as an error
  // for now if a request is made that has no required requirements (but only e.g. min: 0, which means we don't need to disclose anything)
  // I see this more as the fault of the presentation definition, as it should have at least some requirements.
  if (presentationSubmission.requirements.length === 0) {
    throw new DifPresentationExchangeError(
      'Presentation Definition does not require any credentials. Optional credentials are not included in the presentation submission.'
    )
  }
  if (selectResultsRaw.areRequiredCredentialsPresent === 'error') {
    return presentationSubmission
  }

  return {
    ...presentationSubmission,

    // If all requirements are satisfied, the presentation submission is satisfied
    areRequirementsSatisfied: presentationSubmission.requirements.every(
      (requirement) => requirement.isRequirementSatisfied
    ),
  }
}

function getSubmissionRequirements(
  presentationDefinition: IPresentationDefinition,
  selectResults: W3cCredentialRecordSelectResults
): Array<DifPexCredentialsForRequestRequirement> {
  const submissionRequirements: Array<DifPexCredentialsForRequestRequirement> = []

  // There are submission requirements, so we need to select the input_descriptors
  // based on the submission requirements
  for (const submissionRequirement of presentationDefinition.submission_requirements ?? []) {
    // Check: if the submissionRequirement uses `from_nested`, as we don't support this yet
    if (submissionRequirement.from_nested) {
      throw new DifPresentationExchangeError(
        "Presentation definition contains requirement using 'from_nested', which is not supported yet."
      )
    }

    // Check if there's a 'from'. If not the structure is not as we expect it
    if (!submissionRequirement.from) {
      throw new DifPresentationExchangeError("Missing 'from' in submission requirement match")
    }

    if (submissionRequirement.rule === Rules.All) {
      const selectedSubmission = getSubmissionRequirementRuleAll(
        submissionRequirement,
        presentationDefinition,
        selectResults
      )
      submissionRequirements.push(selectedSubmission)
    } else {
      const selectedSubmission = getSubmissionRequirementRulePick(
        submissionRequirement,
        presentationDefinition,
        selectResults
      )

      submissionRequirements.push(selectedSubmission)
    }
  }

  // Submission may have requirement that doesn't require a credential to be submitted (e.g. min: 0)
  // We use minimization strategy, and thus only disclose the minimum amount of information
  const requirementsWithCredentials = submissionRequirements.filter((requirement) => requirement.needsCount > 0)

  return requirementsWithCredentials
}

function getSubmissionRequirementsForAllInputDescriptors(
  inputDescriptors: Array<InputDescriptorV1> | Array<InputDescriptorV2>,
  selectResults: W3cCredentialRecordSelectResults
): Array<DifPexCredentialsForRequestRequirement> {
  const submissionRequirements: Array<DifPexCredentialsForRequestRequirement> = []

  for (const inputDescriptor of inputDescriptors) {
    const submission = getSubmissionForInputDescriptor(inputDescriptor, selectResults)

    submissionRequirements.push({
      rule: Rules.Pick,
      needsCount: 1, // Every input descriptor is a distinct requirement, so the count is always 1,
      submissionEntry: [submission],
      isRequirementSatisfied: submission.verifiableCredentials.length >= 1,
    })
  }

  return submissionRequirements
}

function getSubmissionRequirementRuleAll(
  submissionRequirement: SubmissionRequirement,
  presentationDefinition: IPresentationDefinition,
  selectResults: W3cCredentialRecordSelectResults
) {
  // Check if there's a 'from'. If not the structure is not as we expect it
  if (!submissionRequirement.from)
    throw new DifPresentationExchangeError("Missing 'from' in submission requirement match.")

  const selectedSubmission: DifPexCredentialsForRequestRequirement = {
    rule: Rules.All,
    needsCount: 0,
    name: submissionRequirement.name,
    purpose: submissionRequirement.purpose,
    submissionEntry: [],
    isRequirementSatisfied: false,
  }

  for (const inputDescriptor of presentationDefinition.input_descriptors) {
    // We only want to get the submission if the input descriptor belongs to the group
    if (!inputDescriptor.group?.includes(submissionRequirement.from)) continue

    const submission = getSubmissionForInputDescriptor(inputDescriptor, selectResults)

    // Rule ALL, so for every input descriptor that matches in this group, we need to add it
    selectedSubmission.needsCount += 1
    selectedSubmission.submissionEntry.push(submission)
  }

  return {
    ...selectedSubmission,

    // If all submissions have a credential, the requirement is satisfied
    isRequirementSatisfied: selectedSubmission.submissionEntry.every(
      (submission) => submission.verifiableCredentials.length >= 1
    ),
  }
}

function getSubmissionRequirementRulePick(
  submissionRequirement: SubmissionRequirement,
  presentationDefinition: IPresentationDefinition,
  selectResults: W3cCredentialRecordSelectResults
) {
  // Check if there's a 'from'. If not the structure is not as we expect it
  if (!submissionRequirement.from) {
    throw new DifPresentationExchangeError("Missing 'from' in submission requirement match.")
  }

  const selectedSubmission: DifPexCredentialsForRequestRequirement = {
    rule: Rules.Pick,
    needsCount: submissionRequirement.count ?? submissionRequirement.min ?? 1,
    name: submissionRequirement.name,
    purpose: submissionRequirement.purpose,
    // If there's no count, min, or max we assume one credential is required for submission
    // however, the exact behavior is not specified in the spec
    submissionEntry: [],
    isRequirementSatisfied: false,
  }

  const satisfiedSubmissions: Array<DifPexCredentialsForRequestSubmissionEntry> = []
  const unsatisfiedSubmissions: Array<DifPexCredentialsForRequestSubmissionEntry> = []

  for (const inputDescriptor of presentationDefinition.input_descriptors) {
    // We only want to get the submission if the input descriptor belongs to the group
    if (!inputDescriptor.group?.includes(submissionRequirement.from)) continue

    const submission = getSubmissionForInputDescriptor(inputDescriptor, selectResults)

    if (submission.verifiableCredentials.length >= 1) {
      satisfiedSubmissions.push(submission)
    } else {
      unsatisfiedSubmissions.push(submission)
    }

    // If we have found enough credentials to satisfy the requirement, we could stop
    // but the user may not want the first x that match, so we continue and return all matches
    // if (satisfiedSubmissions.length === selectedSubmission.needsCount) break
  }

  return {
    ...selectedSubmission,

    // If there are enough satisfied submissions, the requirement is satisfied
    isRequirementSatisfied: satisfiedSubmissions.length >= selectedSubmission.needsCount,

    // if the requirement is satisfied, we only need to return the satisfied submissions
    // however if the requirement is not satisfied, we include all entries so the wallet could
    // render which credentials are missing.
    submission:
      satisfiedSubmissions.length >= selectedSubmission.needsCount
        ? satisfiedSubmissions
        : [...satisfiedSubmissions, ...unsatisfiedSubmissions],
  }
}

function getSubmissionForInputDescriptor(
  inputDescriptor: InputDescriptorV1 | InputDescriptorV2,
  selectResults: W3cCredentialRecordSelectResults
): DifPexCredentialsForRequestSubmissionEntry {
  // https://github.com/Sphereon-Opensource/PEX/issues/116
  // If the input descriptor doesn't contain a name, the name of the match will be the id of the input descriptor that satisfied it
  const matchesForInputDescriptor = selectResults.matches?.filter(
    (m) =>
      m.name === inputDescriptor.id ||
      // FIXME: this is not collision proof as the name doesn't have to be unique
      m.name === inputDescriptor.name
  )

  const submissionEntry: DifPexCredentialsForRequestSubmissionEntry = {
    inputDescriptorId: inputDescriptor.id,
    name: inputDescriptor.name,
    purpose: inputDescriptor.purpose,
    verifiableCredentials: [],
  }

  // return early if no matches.
  if (!matchesForInputDescriptor?.length) return submissionEntry

  // FIXME: This can return multiple credentials for multiple input_descriptors,
  // which I think is a bug in the PEX library
  // Extract all credentials from the match
  const verifiableCredentials = matchesForInputDescriptor.flatMap((matchForInputDescriptor) =>
    extractCredentialsFromMatch(matchForInputDescriptor, selectResults.verifiableCredential)
  )

  submissionEntry.verifiableCredentials = verifiableCredentials

  return submissionEntry
}

function extractCredentialsFromMatch(
  match: SubmissionRequirementMatch,
  availableCredentials?: Array<W3cCredentialRecord>
) {
  const verifiableCredentials: Array<W3cCredentialRecord> = []

  for (const vcPath of match.vc_path) {
    const [verifiableCredential] = jp.query({ verifiableCredential: availableCredentials }, vcPath) as [
      W3cCredentialRecord
    ]
    verifiableCredentials.push(verifiableCredential)
  }

  return verifiableCredentials
}

/**
 * Custom SelectResults that include the W3cCredentialRecord instead of the encoded verifiable credential
 */
export type W3cCredentialRecordSelectResults = Omit<SelectResults, 'verifiableCredential'> & {
  verifiableCredential?: Array<W3cCredentialRecord>
}
