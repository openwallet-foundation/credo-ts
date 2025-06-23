import {
  W3cJsonLdVerifyCredentialOptions,
  W3cJwtVerifyCredentialOptions,
} from '../../../../W3cCredentialServiceOptions'

import { inflate } from 'pako'
import type { AgentContext } from '../../../../../../agent/context'
import { CredoError } from '../../../../../../error'
import { W3cCredentialService } from '../../../../W3cCredentialService'
import { ClaimFormat } from '../../../ClaimFormat'
import { W3cVerifyCredentialResult } from '../../../W3cVerifyResult'
import type { BitStringStatusListEntry } from './BitStringStatusList'
import type { BitStringStatusListCredential } from './BitStringStatusListCredential'

// Function to fetch and parse the bit string status list credential
const fetchBitStringStatusListCredential = async (
  agentContext: AgentContext,
  url: string
): Promise<BitStringStatusListCredential> => {
  agentContext.config.logger.debug('Fetching BitStringStatusListCredential')
  const response = await agentContext.config.agentDependencies.fetch(url)

  if (!response.ok) {
    throw new CredoError(`Failed to fetch BitStringStatusListCredential status list. HTTP Status: ${response.status}`)
  }
  agentContext.config.logger.debug('BitStringStatusListCredential fetched successfully')
  // Validate signature

  try {
    agentContext.config.logger.debug('returning fetched BitStringStatusListCredential')
    return (await response.json()) as BitStringStatusListCredential
  } catch (error) {
    throw new CredoError('Failed to parse the bit string status list credential', { cause: error })
  }
}

export const verifyBitStringCredentialStatus = async (
  credentialStatus: BitStringStatusListEntry,
  agentContext: AgentContext,
  credentialFormat: ClaimFormat.JwtVc | ClaimFormat.LdpVc
) => {
  try {
    if (Array.isArray(credentialStatus)) {
      agentContext.config.logger.debug('Credential status type is array')
      throw new CredoError(
        'Invalid credential status type. Currently only a single BitstringStatusListEntry is supported per credential'
      )
    }
    agentContext.config.logger.debug('Fetching BitString StatusList Credential for verifying BitStringCredentialStatus')
    // Fetch the bit string status list credential
    const bitStringStatusListCredential = await fetchBitStringStatusListCredential(
      agentContext,
      credentialStatus.statusListCredential
    )
    agentContext.config.logger.debug(
      'Fetched BitString StatusList Credential for verifying BitStringCredentialStatus successfully'
    )

    if (Array.isArray(bitStringStatusListCredential.credentialSubject)) {
      agentContext.config.logger.debug(
        'Credential subject type is array for the fetched Bitstring Status List Credential'
      )
      throw new CredoError(
        'Invalid credential subject type. Currently only a single credentialSubject is supported per BitstringStatusListCredential'
      )
    }

    agentContext.config.logger.debug(
      `This is the fetched BSLC ${JSON.stringify(bitStringStatusListCredential, null, 2)}`
    )

    // verify signatures of the credential
    const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)

    let result: W3cVerifyCredentialResult
    if (credentialFormat === ClaimFormat.JwtVc) {
      result = await w3cCredentialService.verifyCredential(
        agentContext,
        bitStringStatusListCredential as unknown as W3cJwtVerifyCredentialOptions
      )
    } else if (credentialFormat === ClaimFormat.LdpVc) {
      result = await w3cCredentialService.verifyCredential(
        agentContext,
        bitStringStatusListCredential as unknown as W3cJsonLdVerifyCredentialOptions
      )
    } else {
      throw new CredoError(
        'Unsupported credential type for BSLC. Credential must be either a W3cJsonLdVerifiableCredential or a W3cJwtVerifiableCredential'
      )
    }
    if (result && !result.isValid) {
      throw new CredoError(`Failed to validate credential, error = ${result.error}`)
    }

    // Decode the encoded bit string
    let decodedBitStringArray: Array<string>
    try {
      const encodedBitString = bitStringStatusListCredential.credentialSubject.encodedList
      // 3rd approach
      const decodedBitString = expand(encodedBitString)
      decodedBitStringArray = [...decodedBitString]
    } catch (err) {
      throw new CredoError('Error decoding Bitstring of fetched Bitstring StatusList Credential', { cause: err })
    }

    const statusListIndex = Number(credentialStatus.statusListIndex)

    agentContext.config.logger.debug(`This is decodedBitString length: ${decodedBitStringArray.length}`)

    // Ensure the statusListIndex is within bounds
    if (statusListIndex < 0 || statusListIndex >= decodedBitStringArray.length) {
      throw new CredoError('Status list index is out of bounds')
    }

    // Check if the credential is revoked
    if (decodedBitStringArray[statusListIndex] === '1') {
      // To do: The error can be updated once we add support for status messages
      throw new CredoError(
        `Credential at index ${credentialStatus.statusListIndex} is in ${bitStringStatusListCredential.credentialSubject.statusPurpose} state.`
      )
    }
    agentContext.config.logger.debug('BitStringStatusList Credential verified successfully')

    return true
  } catch (err) {
    throw new CredoError('Error verifying bitstring credential status', err)
  }
}

function expand(encodedList: string): string {
  // Step 1: Decode Base64url (assuming no Multibase prefix, otherwise use multibase)
  // biome-ignore lint/style/noRestrictedGlobals: <explanation>
  const compressedData = Buffer.from(encodedList, 'base64url')
  // Step 2: Decompress using GZIP (Pako)
  const decompressedData = inflate(compressedData)
  // Step 3: Convert Uint8Array to Bitstring
  return Array.from(decompressedData)
    .map((byte) => byte.toString(2).padStart(8, '0')) // Convert each byte to 8-bit binary
    .join('') // Join all bits into a string
}
