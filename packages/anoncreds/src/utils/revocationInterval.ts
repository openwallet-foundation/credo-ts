import type { AnonCredsNonRevokedInterval } from '../models'

import { AriesFrameworkError } from '@aries-framework/core'

// TODO: Add Test
// Check revocation interval in accordance with https://github.com/hyperledger/aries-rfcs/blob/main/concepts/0441-present-proof-best-practices/README.md#semantics-of-non-revocation-interval-endpoints
export function assertRevocationInterval(nonRevokedInterval: AnonCredsNonRevokedInterval) {
  if (!nonRevokedInterval.to) {
    throw new AriesFrameworkError(`Presentation requests proof of non-revocation with no 'to' value specified`)
  }

  if ((nonRevokedInterval.from || nonRevokedInterval.from === 0) && nonRevokedInterval.to !== nonRevokedInterval.from) {
    throw new AriesFrameworkError(
      `Presentation requests proof of non-revocation with an interval from: '${nonRevokedInterval.from}' that does not match the interval to: '${nonRevokedInterval.to}', as specified in Aries RFC 0441`
    )
  }
}
