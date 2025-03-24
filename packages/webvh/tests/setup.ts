import { DidDocument, DidDocumentService, VerificationMethod } from '@credo-ts/core'

export const validDid =
  'did:webvh:QmPEQVM1JPTyrvEgBcDXwjK4TeyLGSX1PxjgyeAisdWM1p:gist.githubusercontent.com:brianorwhatever:9c4633d18eb644f7a47f93a802691626:raw'

export function validVerificationMethod(did: string) {
  return new VerificationMethod({
    id: did + '#key-1',
    type: 'Multikey',
    controller: did,
    publicKeyMultibase: 'z6MkkBaWtQKyx7Mr54XaXyMAEpNKqphK4x7ztuBpSfR6Wqwr',
  })
}

export function validService(did: string) {
  return new DidDocumentService({
    id: did + '#service-1',
    type: 'CustomType',
    serviceEndpoint: 'https://example.com',
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
