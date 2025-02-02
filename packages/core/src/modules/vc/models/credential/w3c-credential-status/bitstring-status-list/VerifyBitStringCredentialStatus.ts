import type { BitStringStatusListEntry } from './BitStringStatusList'
import type { BitStringStatusListCredential } from './BitStringStatusListCredential'
import type { AgentContext } from '../../../../../../agent/context'

import { inflate } from 'pako'

import { CredoError } from '../../../../../../error'

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
    throw new CredoError('Failed to parse the bit string status list credential')
  }
}

export const verifyBitStringCredentialStatus = async (
  credentialStatus: BitStringStatusListEntry,
  agentContext: AgentContext
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

    // TODO: Add logic to validate Credential signature

    // Decode the encoded bit string
    let decodedBitStringArray;
    try {
      const encodedBitString = bitStringStatusListCredential.credentialSubject.encodedList
      // 3rd approach
      const decodedBitString = expand(encodedBitString)
      decodedBitStringArray = [...decodedBitString]
    } catch(err) {
      throw new CredoError('Error decoding Bitstring of fetched Bitstring StatusList Credential')
    }
    
    // 1st approach
    // agentContext.config.logger.debug(`This is encodedBitString: ${encodedBitString}`)
    // const compressedBuffer = Uint8Array.from(atob(encodedBitString), (char) => char.charCodeAt(0))
    // agentContext.config.logger.debug('Decoding the encoded bit string for fetched BitString StatusList Credential')

    // // Decompress the bit string using pako
    // const decodedBitString = ungzip(compressedBuffer, { to: 'string' })

    // 2nd approach - worked
    // const base64ToUint8Array = (base64: string): Uint8Array => {
    //   const binaryString = atob(base64.replace(/-/g, '+').replace(/_/g, '/')) // Handle URL-safe Base64
    //   return new Uint8Array([...binaryString].map((char) => char.charCodeAt(0)))
    // }

    // const compressedBuffer = base64ToUint8Array(encodedBitString)

    // console.debug(`compressedBuffer: ${compressedBuffer}`)
    // console.debug('Decoding the encoded bit string for fetched BitString StatusList Credential')

    // // Decompress the bit string using pako
    // const decodedBitString = new TextDecoder().decode(ungzip(compressedBuffer))

    // console.debug(`Decoded BitString: ${decodedBitString}`)

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
    const compressedData = Buffer.from(encodedList, "base64url");
    // Step 2: Decompress using GZIP (Pako)
    const decompressedData = inflate(compressedData);
    // Step 3: Convert Uint8Array to Bitstring
    return Array.from(decompressedData)
        .map(byte => byte.toString(2).padStart(8, "0")) // Convert each byte to 8-bit binary
        .join(""); // Join all bits into a string
}

