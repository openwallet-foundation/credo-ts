import type { AnonCredsCredential, AnonCredsCredentialDefinition } from '../models'
import type { ProcessCredentialOptions } from '@hyperledger/anoncreds-shared'

import { JsonTransformer, W3cJsonLdVerifiableCredential, type JsonObject } from '@credo-ts/core'
import { Credential, W3cCredential } from '@hyperledger/anoncreds-shared'

export async function legacyCredentialToW3cCredential(
  legacyCredential: AnonCredsCredential,
  credentialDefinition: AnonCredsCredentialDefinition,
  process?: Omit<ProcessCredentialOptions, 'credentialDefinition'>
) {
  let credential: W3cJsonLdVerifiableCredential
  let anonCredsCredential: Credential | undefined
  let w3cCredentialObj: W3cCredential | undefined
  let processed: W3cCredential | undefined

  try {
    anonCredsCredential = Credential.fromJson(legacyCredential as unknown as JsonObject)
    w3cCredentialObj = anonCredsCredential.toW3c({
      credentialDefinition: credentialDefinition as unknown as JsonObject,
      w3cVersion: '1.1',
    })

    const jsonObject = process
      ? w3cCredentialObj
          .process({ ...process, credentialDefinition: credentialDefinition as unknown as JsonObject })
          .toJson()
      : w3cCredentialObj.toJson()

    credential = JsonTransformer.fromJSON(jsonObject, W3cJsonLdVerifiableCredential)
  } finally {
    anonCredsCredential?.handle?.clear()
    w3cCredentialObj?.handle?.clear()
    processed?.handle?.clear()
  }

  return credential
}

export function w3cToLegacyCredential(credential: W3cJsonLdVerifiableCredential) {
  const credentialJson = JsonTransformer.toJSON(credential)
  const w3cCredentialObj = W3cCredential.fromJson(credentialJson)
  const legacyCredential = w3cCredentialObj.toLegacy().toJson() as unknown as AnonCredsCredential
  return legacyCredential
}
