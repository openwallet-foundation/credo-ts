export interface AnonCredsSchema {
  issuerId: string
  name: string
  version: string
  attrNames: string[]
}

export interface AnonCredsCredentialDefinition {
  issuerId: string
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
  issuerId: string
  revocDefType: 'CL_ACCUM'
  credDefId: string
  tag: string
  value: AnonCredsRevocationRegistryDefinitionValue
}

export interface AnonCredsRevocationRegistryDefinitionValue {
  publicKeys: {
    accumKey: {
      z: string
    }
  }
  maxCredNum: number
  tailsLocation: string
  tailsHash: string
}

export interface AnonCredsRevocationStatusList {
  issuerId: string
  revRegDefId: string
  revocationList: Array<number>
  currentAccumulator: string
  timestamp: number
}
