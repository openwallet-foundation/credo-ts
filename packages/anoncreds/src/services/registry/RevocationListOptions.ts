import type { AnonCredsRevocationList } from '../../models/registry'
import type { AnonCredsResolutionMetadata, Extensible } from './base'

export interface GetRevocationListReturn {
  revocationList: AnonCredsRevocationList | null
  resolutionMetadata: AnonCredsResolutionMetadata
  revocationListMetadata: Extensible
}

// TODO: Support for issuance of revocable credentials
// export interface RegisterRevocationListOptions {
//   // Timestamp is often calculated by the ledger, otherwise method should just take current time
//   // Return type does include the timestamp.
//   revocationList: Omit<AnonCredsRevocationList, 'timestamp'>
// }
// export interface RegisterRevocationListReturn {
//   timestamp: string
// }
