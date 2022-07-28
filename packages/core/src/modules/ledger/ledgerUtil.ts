import type { CredentialDefinitionTemplate, SchemaTemplate } from './services/IndyLedgerService'
import type * as Indy from 'indy-sdk'

export function isLedgerRejectResponse(response: Indy.LedgerResponse): response is Indy.LedgerRejectResponse {
  return response.op === 'REJECT'
}

export function isLedgerReqnackResponse(response: Indy.LedgerResponse): response is Indy.LedgerReqnackResponse {
  return response.op === 'REQNACK'
}

export function generateSchemaId(did: string, name: string, version: string) {
  return `${did}:2:${name}:${version}`
}

export function generateCredentialDefinitionId(did: string, seqNo: number, tag: string) {
  return `${did}:3:CL:${seqNo}:${tag}`
}

export function generateCredDefFromTemplate(
  credentialDefinitionId: string,
  credentialDefinitionTemplate: CredentialDefinitionTemplate | Omit<CredentialDefinitionTemplate, 'signatureType'>
): Indy.CredDef {
  return {
    id: credentialDefinitionId,
    schemaId: credentialDefinitionTemplate.schema.id,
    type: 'CL', // Irrelevant for qualifiedIdentifier construction
    tag: credentialDefinitionTemplate.tag,
    version: credentialDefinitionTemplate.schema.version,
    ver: credentialDefinitionTemplate.schema.ver,
    value: {
      primary: { ...credentialDefinitionTemplate.schema },
      revocation: credentialDefinitionTemplate.supportRevocation,
    },
  } as Indy.CredDef
}

export function generateSchemaFromTemplate(schemaId: string, schema: SchemaTemplate): Indy.Schema {
  return {
    id: schemaId,
    attrNames: schema.attributes, // relevant for type checking
    name: schema.name,
    ver: schema.version,
    version: schema.version,
    seqNo: 42, // not relevant for conversion, just pick one
  } as Indy.Schema
}
