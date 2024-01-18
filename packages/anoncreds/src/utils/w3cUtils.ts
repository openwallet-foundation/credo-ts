import type { AnonCredsCredential } from '../models'
import type { ProcessCredentialOptions } from '@hyperledger/anoncreds-shared'

import {
  JsonTransformer,
  W3cJsonLdVerifiableCredential,
  type AgentContext,
  type JsonObject,
} from '@aries-framework/core'
import { Credential, W3cCredential } from '@hyperledger/anoncreds-shared'

import { fetchObjectsFromLedger } from './ledgerObjects'

export async function legacyCredentialToW3cCredential(
  agentContext: AgentContext,
  legacyCredential: AnonCredsCredential,
  process?: ProcessCredentialOptions
) {
  const { credentialDefinitionReturn } = await fetchObjectsFromLedger(agentContext, {
    credentialDefinitionId: legacyCredential.cred_def_id,
  })
  if (!credentialDefinitionReturn.credentialDefinition) throw new Error('Credential definition not found.')

  let credential: W3cJsonLdVerifiableCredential
  let anonCredsCredential: Credential | undefined
  let w3cCredentialObj: W3cCredential | undefined
  let processed: W3cCredential | undefined

  try {
    anonCredsCredential = Credential.fromJson(legacyCredential as unknown as JsonObject)
    w3cCredentialObj = anonCredsCredential.toW3c({
      credentialDefinition: credentialDefinitionReturn.credentialDefinition as unknown as JsonObject,
      w3cVersion: '1.1',
    })

    processed = process ? w3cCredentialObj.process(process) : w3cCredentialObj
    const jsonObject = processed.toJson()
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
