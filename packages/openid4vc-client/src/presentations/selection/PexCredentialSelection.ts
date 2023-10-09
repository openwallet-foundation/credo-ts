import type { PresentationSubmission, PresentationSubmissionRequirement, SubmissionEntry } from './types'
import type { W3cCredentialRecord } from '@aries-framework/core'
import type { SelectResults, SubmissionRequirementMatch } from '@sphereon/pex'
import type { PresentationDefinitionV1, SubmissionRequirement, InputDescriptorV1 } from '@sphereon/pex-models'
import type { OriginalVerifiableCredential } from '@sphereon/ssi-types'

import { AriesFrameworkError } from '@aries-framework/core'
import { PEXv1 } from '@sphereon/pex'
import { Rules } from '@sphereon/pex-models'
import { default as jp } from 'jsonpath'

import { getSphereonW3cVerifiableCredential } from '../transform'

export function selectCredentialsForRequest(
  presentationDefinition: PresentationDefinitionV1,
  credentialRecords: W3cCredentialRecord[]
): PresentationSubmission {
  const pex = new PEXv1()

  const encodedCredentials: OriginalVerifiableCredential[] = credentialRecords.map((c) =>
    getSphereonW3cVerifiableCredential(c.credential)
  )

  const selectResultsRaw = pex.selectFrom(presentationDefinition, encodedCredentials)

  const selectResults = {
    ...selectResultsRaw,
    // Map the encoded credential to their respective w3c credential record
    verifiableCredential: selectResultsRaw.verifiableCredential?.map((encoded): W3cCredentialRecord => {
      const credentialIndex = encodedCredentials.indexOf(encoded)
      const credentialRecord = credentialRecords[credentialIndex]
      if (!credentialRecord) {
        throw new AriesFrameworkError('Unable to find credential in credential records')
      }

      return credentialRecord
    }),
  }

  const presentationSubmission: PresentationSubmission = {
    areRequirementsSatisfied: false,
    requirements: [],
    name: presentationDefinition.name,
    purpose: presentationDefinition.purpose,
  }

  // If there's no submission requirements, ALL input descriptors MUST be satisfied
  if (!presentationDefinition.submission_requirements || presentationDefinition.submission_requirements.length === 0) {
    presentationSubmission.requirements = getSubmissionRequirementsAllInputDescriptors(
      presentationDefinition,
      selectResults
    )
  } else {
    presentationSubmission.requirements = getSubmissionRequirements(presentationDefinition, selectResults)
  }

  // There may be no requirements if we filter out all optional ones. To not makes things too complicated, we see it as an error
  // for now if a request is made that has no required requirements (but only e.g. min: 0, which means we don't need to disclose anything)
  // I see this more as the fault of the presentation definition, as it should have at least some requirements.
  if (presentationSubmission.requirements.length === 0) {
    throw new AriesFrameworkError(
      'Presentation Definition does not require any credentials. Optional credentials are not included in the presentation submission.'
    )
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
  presentationDefinition: PresentationDefinitionV1,
  selectResults: W3cCredentialRecordSelectResults
): PresentationSubmissionRequirement[] {
  const submissionRequirements: PresentationSubmissionRequirement[] = []

  // There are submission requirements, so we need to select the input_descriptors
  // based on the submission requirements
  for (const submissionRequirement of presentationDefinition.submission_requirements ?? []) {
    // Check if the submissionRequirement uses `from_nested`, as we don't support this yet
    if (submissionRequirement.from_nested) {
      throw new AriesFrameworkError(
        "Presentation definition contains requirement using 'from_nested', which is not supported yet."
      )
    }

    // Check if there's a 'from'. If not the structure is not as we expect it
    if (!submissionRequirement.from) {
      throw new AriesFrameworkError("Missing 'from' in submission requirement match")
    }

    // Rule is all
    if (submissionRequirement.rule === Rules.All) {
      const selectedSubmission = getSubmissionRequirementRuleAll(
        submissionRequirement,
        presentationDefinition,
        selectResults
      )

      // Submission may have requirement that doesn't require a credential to be submitted (e.g. min: 0)
      // We use minimization strategy, and thus only disclose the minimum amount of information
      // TODO: is this the right place to do this?
      if (selectedSubmission.needsCount > 0) {
        submissionRequirements.push(selectedSubmission)
      }
    }
    // Rule is Pick
    else {
      const selectedSubmission = getSubmissionRequirementRulePick(
        submissionRequirement,
        presentationDefinition,
        selectResults
      )

      // Submission may have requirement that doesn't require a credential to be submitted (e.g. min: 0)
      // We use minimization strategy, and thus only disclose the minimum amount of information
      // TODO: is this the right place to do this?
      if (selectedSubmission.needsCount > 0) {
        submissionRequirements.push(selectedSubmission)
      }
    }
  }

  return submissionRequirements
}

function getSubmissionRequirementsAllInputDescriptors(
  presentationDefinition: PresentationDefinitionV1,
  selectResults: W3cCredentialRecordSelectResults
): PresentationSubmissionRequirement[] {
  const submissionRequirements: PresentationSubmissionRequirement[] = []

  for (const inputDescriptor of presentationDefinition.input_descriptors) {
    const submission = getSubmissionForInputDescriptor(inputDescriptor, selectResults)

    submissionRequirements.push({
      isRequirementSatisfied: submission.verifiableCredential !== undefined,
      submission: [submission],
      // Every input descriptor is a separate requirement, so the count is always 1
      needsCount: 1,
    })
  }

  return submissionRequirements
}

function getSubmissionRequirementRuleAll(
  submissionRequirement: SubmissionRequirement,
  presentationDefinition: PresentationDefinitionV1,
  selectResults: W3cCredentialRecordSelectResults
) {
  // Check if there's a 'from'. If not the structure is not as we expect it
  if (!submissionRequirement.from) {
    throw new AriesFrameworkError("Missing 'from' in submission requirement match")
  }

  const selectedSubmission: PresentationSubmissionRequirement = {
    name: submissionRequirement.name,
    purpose: submissionRequirement.purpose,
    isRequirementSatisfied: false,
    needsCount: 0,
    submission: [],
  }

  for (const inputDescriptor of presentationDefinition.input_descriptors) {
    // We only want to get the submission if the input descriptor belongs to the group
    if (!inputDescriptor.group?.includes(submissionRequirement.from)) continue

    const submission = getSubmissionForInputDescriptor(inputDescriptor, selectResults)

    // Rule ALL, so for every input descriptor that matches in this group, we need to add it
    selectedSubmission.needsCount += 1
    selectedSubmission.submission.push(submission)
  }

  return {
    ...selectedSubmission,

    // If all submissions have a credential, the requirement is satisfied
    isRequirementSatisfied: selectedSubmission.submission.every(
      (submission) => submission.verifiableCredential !== undefined
    ),
  }
}

function getSubmissionRequirementRulePick(
  submissionRequirement: SubmissionRequirement,
  presentationDefinition: PresentationDefinitionV1,
  selectResults: W3cCredentialRecordSelectResults
) {
  // Check if there's a 'from'. If not the structure is not as we expect it
  if (!submissionRequirement.from) {
    throw new AriesFrameworkError("Missing 'from' in submission requirement match")
  }

  const selectedSubmission: PresentationSubmissionRequirement = {
    name: submissionRequirement.name,
    purpose: submissionRequirement.purpose,
    isRequirementSatisfied: false,
    submission: [],

    // TODO: if there's no count, min, max should we then assume the number to include is 1?
    // TODO: if there's no count, min, but there is a max. Should we assume the min is 0 or 1?
    needsCount: submissionRequirement.count ?? submissionRequirement.min ?? 1,
  }

  const satisfiedSubmissions: SubmissionEntry[] = []
  const unsatisfiedSubmissions: SubmissionEntry[] = []

  for (const inputDescriptor of presentationDefinition.input_descriptors) {
    // We only want to get the submission if the input descriptor belongs to the group
    if (!inputDescriptor.group?.includes(submissionRequirement.from)) continue

    const submission = getSubmissionForInputDescriptor(inputDescriptor, selectResults)

    if (submission.verifiableCredential) {
      satisfiedSubmissions.push(submission)
    } else {
      unsatisfiedSubmissions.push(submission)
    }

    if (satisfiedSubmissions.length === selectedSubmission.needsCount) {
      break
    }
  }

  return {
    ...selectedSubmission,

    // If there's enough satisfied submissions, the requirement is satisfied
    isRequirementSatisfied: satisfiedSubmissions.length === selectedSubmission.needsCount,

    // if the requirement is satisfied, we only need to return the satisfied submissions
    // however if the requirement is not satisfied, we include all entries so the wallet could
    // render which credentials are missing.
    submission:
      satisfiedSubmissions.length === selectedSubmission.needsCount
        ? satisfiedSubmissions
        : [...satisfiedSubmissions, ...unsatisfiedSubmissions],
  }
}

function getSubmissionForInputDescriptor(
  inputDescriptor: InputDescriptorV1,
  selectResults: W3cCredentialRecordSelectResults
): SubmissionEntry {
  // https://github.com/Sphereon-Opensource/PEX/issues/116
  // FIXME: the match.name is only the id if the input_descriptor has no name
  // Find first match
  const match = selectResults.matches?.find(
    (m) =>
      m.name === inputDescriptor.id ||
      // FIXME: this is not collision proof as the name doesn't have to be unique
      m.name === inputDescriptor.name
  )

  const submissionEntry: SubmissionEntry = {
    inputDescriptorId: inputDescriptor.id,
    name: inputDescriptor.name,
    purpose: inputDescriptor.purpose,
  }

  // return early if no match.
  if (!match) return submissionEntry

  // FIXME: This can return multiple credentials for multiple input_descriptors,
  // which I think is a bug in the PEX library
  // Extract all credentials from the match
  const [verifiableCredential] = extractCredentialsFromMatch(match, selectResults.verifiableCredential)

  return {
    ...submissionEntry,
    verifiableCredential,
  }
}

function extractCredentialsFromMatch(match: SubmissionRequirementMatch, availableCredentials?: W3cCredentialRecord[]) {
  const verifiableCredentials: W3cCredentialRecord[] = []

  for (const vcPath of match.vc_path) {
    const [verifiableCredential] = jp.query(
      {
        verifiableCredential: availableCredentials,
      },
      vcPath
    ) as [W3cCredentialRecord]
    verifiableCredentials.push(verifiableCredential)
  }

  return verifiableCredentials
}

/**
 * Custom SelectResults that include the W3cCredentialRecord instead of the encoded verifiable credential
 */
export type W3cCredentialRecordSelectResults = Omit<SelectResults, 'verifiableCredential'> & {
  verifiableCredential?: W3cCredentialRecord[]
}
