import type z from 'zod'

/**
 * Some code comes from `zod-validation-error` package (MIT License) and
 * was slightly simplified to fit our needs.
 */
const constants = {
  // biome-ignore lint/suspicious/noMisleadingCharacterClass: expected
  identifierRegex: /[$_\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*/u,
  unionSeparator: ', or ',
  issueSeparator: '\n\t- ',
}

function escapeQuotes(str: string): string {
  return str.replace(/"/g, '\\"')
}

function joinPath(path: Array<PropertyKey>): string {
  if (path.length === 1) {
    return path[0].toString()
  }

  return path.reduce<string>((acc, item) => {
    // handle numeric indices
    if (typeof item === 'number') {
      return `${acc}[${item.toString()}]`
    }

    const stringItem = item.toString()

    // handle quoted values
    if (stringItem.includes('"')) {
      return `${acc}["${escapeQuotes(stringItem)}"]`
    }

    // handle special characters
    if (!constants.identifierRegex.test(stringItem)) {
      return `${acc}["${stringItem}"]`
    }

    // handle normal values
    const separator = acc.length === 0 ? '' : '.'
    return acc + separator + stringItem
  }, '')
}

function getMessageFromZodIssue(issue: z.core.$ZodIssue): string {
  if (issue.code === 'invalid_union') {
    return getMessageFromUnionErrors(issue.errors)
  }

  if (issue.code === 'invalid_key') {
    return [issue.message, ...issue.issues.map((issue) => getMessageFromZodIssue(issue))].join(constants.issueSeparator)
  }

  if (issue.code === 'invalid_element') {
    return [issue.message, ...issue.issues.map((issue) => getMessageFromZodIssue(issue))].join(constants.issueSeparator)
  }

  if (issue.path.length !== 0) {
    // handle array indices
    if (issue.path.length === 1) {
      const identifier = issue.path[0]

      if (typeof identifier === 'number') {
        return `${issue.message} at index ${identifier}`
      }
    }

    return `${issue.message} at "${joinPath(issue.path)}"`
  }

  return issue.message
}

function getMessageFromUnionErrors(unionErrors: z.core.$ZodIssue[][]): string {
  return unionErrors
    .reduce<string[]>((acc, zodIssue) => {
      const newIssues = zodIssue.map((issue) => getMessageFromZodIssue(issue)).join(constants.issueSeparator)

      if (!acc.includes(newIssues)) acc.push(newIssues)

      return acc
    }, [])
    .join(constants.unionSeparator)
}

export function formatZodError(error?: z.ZodError): string {
  if (!error) return ''

  return `\t- ${error?.issues.map((issue) => getMessageFromZodIssue(issue)).join(constants.issueSeparator)}`
}
