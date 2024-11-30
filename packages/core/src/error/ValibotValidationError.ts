import * as v from 'valibot'

import { mergeDeep } from '../utils/object'

import { CredoError } from './CredoError'

export function valibotRecursiveFlattenIssues(issues: v.BaseIssue<unknown>[]): Record<string, unknown> {
  let flattened: unknown = v.flatten(issues as [v.BaseIssue<unknown>])

  for (const issue of issues) {
    if (issue.issues) {
      flattened = mergeDeep(flattened, valibotRecursiveFlattenIssues(issue.issues))
    }
  }

  return flattened as Record<string, unknown>
}

export class ValibotValidationError<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Schema extends v.BaseSchema<any, any, any> = v.BaseSchema<any, any, any>
> extends CredoError {
  public constructor(message: string, public readonly valibotIssues: Array<v.InferIssue<Schema>> = []) {
    const errorDetails =
      valibotIssues.length > 0
        ? JSON.stringify(valibotRecursiveFlattenIssues(valibotIssues), null, 2)
        : 'No details provided'
    super(`${message}\n${errorDetails}`)
  }
}
