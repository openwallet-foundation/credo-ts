import { titleCase } from '../../../utils/textCase'

export interface CredentialInfoOptions {
  metadata?: IndyCredentialMetadata
  claims: Record<string, string>
}

export interface IndyCredentialMetadata {
  credentialDefinitionId?: string
  schemaId?: string
}

export class CredentialInfo {
  public constructor(options: CredentialInfoOptions) {
    this.metadata = options.metadata ?? {}
    this.claims = options.claims
  }

  public metadata: IndyCredentialMetadata
  public claims: Record<string, string>

  /**
   * Get the claims with title cased keys, and sorted by ASCII character order
   */
  public getFormattedClaims(): Record<string, string> {
    const formattedClaims = Object.entries(this.claims)
      // transform keys to title case
      .map(([key, value]) => [titleCase(key), value])
      // sort keys in ascending, ASCII character order.
      .sort(([key], [otherKey]) => {
        if (key < otherKey) return -1
        if (key > otherKey) return 1
        return 0
      })
      // transform back into object
      .reduce(
        (accumulator, [key, value]) => ({
          ...accumulator,
          [key]: value,
        }),
        {}
      )

    return formattedClaims
  }
}
