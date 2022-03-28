import type { RequestedAttribute } from '../../../protocol/v1/models/RequestedAttribute'
import type { RequestedPredicate } from '../../../protocol/v1/models/RequestedPredicate'

export interface RetrievedCredentialsOptions {
  requestedAttributes?: Record<string, RequestedAttribute[]>
  requestedPredicates?: Record<string, RequestedPredicate[]>
}

/**
 * Lists of requested credentials for Indy proof creation
 */
export class RetrievedCredentials {
  public requestedAttributes: Record<string, RequestedAttribute[]>
  public requestedPredicates: Record<string, RequestedPredicate[]>

  public constructor(options: RetrievedCredentialsOptions = {}) {
    this.requestedAttributes = options.requestedAttributes ?? {}
    this.requestedPredicates = options.requestedPredicates ?? {}
  }
}
