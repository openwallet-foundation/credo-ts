import type { AgentContext } from '../../../../agent'
import type { W3cCredentialStatus } from '../../models/credential/w3c-credential-status/W3cCredentialStatus'

import { CredoError } from '../../../../error/CredoError'
import type { SingleOrArray } from '../../../../types'
import { ClaimFormat } from '../../models'
import {
  BitStringStatusListEntry,
  verifyBitStringCredentialStatus,
} from '../../models/credential/w3c-credential-status'
import { W3cCredentialStatusSupportedTypes } from '../../models/credential/w3c-credential-status/W3cCredentialStatus'

// Function to validate the status using the updated method
export const validateStatus = async (
  credentialStatus: SingleOrArray<W3cCredentialStatus>,
  agentContext: AgentContext,
  credentialFormat: ClaimFormat.JwtVc | ClaimFormat.LdpVc
): Promise<boolean> => {
  if (Array.isArray(credentialStatus)) {
    agentContext.config.logger.debug('Credential status type is array')
    throw new CredoError(
      'Invalid credential status type. Currently only a single credentialStatus is supported per credential'
    )
  }

  switch (credentialStatus.type) {
    case W3cCredentialStatusSupportedTypes.BitstringStatusListEntry:
      agentContext.config.logger.debug('Credential status type is BitstringStatusListEntry')
      try {
        await verifyBitStringCredentialStatus(
          credentialStatus as unknown as BitStringStatusListEntry,
          agentContext,
          credentialFormat
        )
      } catch (errors) {
        throw new CredoError('Error while validating credential status', errors)
      }
      break
    default:
      throw new CredoError(
        `Invalid credential status type. Supported types are: ${Object.values(W3cCredentialStatusSupportedTypes).join(
          ', '
        )}`
      )
  }
  return true
}
