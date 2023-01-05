export interface AnonCredsSchema {
  name: string
  version: string
  attrNames: string[]
}

export interface AnonCredsCredentialDefinition {
  schemaId: string
  type: 'CL'
  tag: string
  // TODO: work out in more detail
  value: {
    primary: Record<string, unknown>
    revocation?: unknown
  }
}

export interface AnonCredsRevocationRegistryDefinition {
  type: 'CL_ACCUM'
  credDefId: string
  tag: string
  publicKeys: {
    accumKey: {
      z: string
    }
  }
  maxCredNum: number
  tailsLocation: string
  tailsHash: string
}

export interface AnonCredsRevocationList {
  // TODO: this is a new property, but do we keep abbreviation or not?
  revRegId: string
  revocationList: number[]
  currentAccumulator: string
  timestamp: number
}
