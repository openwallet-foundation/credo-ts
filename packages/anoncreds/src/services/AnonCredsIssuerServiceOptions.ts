import type {
  AnonCredsCredential,
  AnonCredsCredentialOffer,
  AnonCredsCredentialRequest,
  CredValue,
} from '../models/exchange'
import type { AnonCredsSchema } from '../models/registry'

export interface CreateSchemaOptions {
  issuerId: string
  name: string
  version: string
  attrNames: string[]
}

export interface CreateCredentialDefinitionOptions {
  issuerId: string
  tag: string
  supportRevocation?: boolean

  schemaId: string
  schema: AnonCredsSchema
}

export interface CreateCredentialOfferOptions {
  credentialDefinitionId: string
}

export interface CreateCredentialOptions {
  credentialOffer: AnonCredsCredentialOffer
  credentialRequest: AnonCredsCredentialRequest
  credentialValues: Record<string, CredValue>
  revocationRegistryId?: string
  // TODO: should this just be the tails file instead of a path?
  tailsFilePath?: string
}

export interface CreateCredentialReturn {
  credential: AnonCredsCredential
  credentialRevocationId?: string
}
