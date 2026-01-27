import { CredoError } from '@credo-ts/core'
import type { AnonCredsNonRevokedInterval } from '../models'

// This sets the `to` value to be required. We do this check in the `assertBestPracticeRevocationInterval` method,
// and it makes it easier to work with the object in TS
interface BestPracticeNonRevokedInterval {
  from?: number
  to: number
}

// Check revocation interval in accordance with https://github.com/hyperledger/aries-rfcs/blob/main/concepts/0441-present-proof-best-practices/README.md#semantics-of-non-revocation-interval-endpoints
export function assertBestPracticeRevocationInterval(
  revocationInterval: AnonCredsNonRevokedInterval
): asserts revocationInterval is BestPracticeNonRevokedInterval {
  if (!revocationInterval.to) {
    throw new CredoError(`Presentation requests proof of non-revocation with no 'to' value specified`)
  }

  if ((revocationInterval.from || revocationInterval.from === 0) && revocationInterval.to !== revocationInterval.from) {
    throw new CredoError(
      `Presentation requests proof of non-revocation with an interval from: '${revocationInterval.from}' that does not match the interval to: '${revocationInterval.to}', as specified in Aries RFC 0441`
    )
  }
}
