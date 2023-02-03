import type { AnonCredsResolutionMetadata, Extensible } from './base'
import type { AnonCredsRevocationStatusList } from '../../models/registry'

export interface GetRevocationStatusListReturn {
  revocationStatusList?: AnonCredsRevocationStatusList
  resolutionMetadata: AnonCredsResolutionMetadata
  revocationStatusListMetadata: Extensible
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
