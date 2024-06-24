jest.setTimeout(60000)

import { DidDocument, DidDocumentService, VerificationMethod } from '@credo-ts/core'

export const validDid = 'did:cheqd:testnet:SiVQgrFZ7jFZFrTGstT4ZD'

export function validVerificationMethod(did: string) {
  return new VerificationMethod({
    id: did + '#key-1',
    type: 'Ed25519VerificationKey2020',
    controller: did,
    publicKeyMultibase: 'z6MkkBaWtQKyx7Mr54XaXyMAEpNKqphK4x7ztuBpSfR6Wqwr',
  })
}

export function validService(did: string) {
  return new DidDocumentService({
    id: did + '#service-1',
    type: 'CustomType',
    serviceEndpoint: 'https://rand.io',
  })
}

export function validDidDoc() {
  const service = [validService(validDid)]
  const verificationMethod = [validVerificationMethod(validDid)]

  return new DidDocument({
    id: validDid,
    verificationMethod,
    service,
  })
}
