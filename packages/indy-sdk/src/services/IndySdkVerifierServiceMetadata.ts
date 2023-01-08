export type VerifyProofMetadata = {
  schemas: {
    [key: string]: {
      ver: string
      seqNo: number
    }
  }
  credentialDefinitions: {
    [key: string]: {
      ver: string
    }
  }
  revocationRegistryDefinition: {
    [key: string]: {
      issuanceType: 'ISSUANCE_BY_DEFAULT' | 'ISSUANCE_ON_DEMAND'
      ver: string
    }
  }
}
