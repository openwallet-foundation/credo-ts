import { CredoError } from '../../../error'
import { ClaimFormat } from '../models/ClaimFormat'

export interface W3cV2DataIntegrityIssue {
  code: string
  message: string
  path?: string
}

export function mapDataIntegrityIssuesToCredoError(options: {
  operation: 'signCredential' | 'verifyCredential' | 'signPresentation' | 'verifyPresentation'
  claimFormat: ClaimFormat.DiVc | ClaimFormat.DiVp
  issues?: W3cV2DataIntegrityIssue[]
}): CredoError | undefined {
  const issues = options.issues ?? []
  if (issues.length === 0) return undefined

  const details = issues
    .map((issue) => {
      const location = issue.path ? ` (path: ${issue.path})` : ''
      return `[${issue.code}] ${issue.message}${location}`
    })
    .join('; ')

  return new CredoError(
    `Data Integrity ${options.operation} for '${options.claimFormat}' reported ${issues.length} issue(s): ${details}`
  )
}
