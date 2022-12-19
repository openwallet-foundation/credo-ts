import type {
  AnonCredsCredential,
  AnonCredsCredentialOffer,
  AnonCredsCredentialRequest,
  CredValue,
} from '../models/exchange'
import type { AnonCredsSchema } from '../models/vdr'

export interface CreateSchemaOptions {
  issuerId: string
  name: string
  version: string
  attrNames: string[]
}

export interface CreateCredentialDefinitionOptions {
  issuerId: string
  tag: string // TODO: this was initially defined as optional, is that the case?
  supportRevocation?: boolean

  // If schema doesn't include the id, we need to add it as a separate input parameter
  schema: {
    value: AnonCredsSchema
    id: string
  }
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
