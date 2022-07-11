import type { DidDocumentService } from './service'

import { VerificationMethod } from '../verificationMethod'

import { DidDocument } from './DidDocument'

export class DidDocumentBuilder {
  private didDocument: DidDocument

  public constructor(id: string) {
    this.didDocument = new DidDocument({
      id,
    })
  }

  public addContext(context: string) {
    this.didDocument.context = [...this.didDocument.context, context]

    return this
  }

  public addService(service: DidDocumentService) {
    this.didDocument.service = [...this.didDocument.service, service]

    return this
  }

  public addVerificationMethod(verificationMethod: VerificationMethod) {
    this.didDocument.verificationMethod = [
      ...this.didDocument.verificationMethod,
      verificationMethod instanceof VerificationMethod
        ? verificationMethod
        : new VerificationMethod(verificationMethod),
    ]

    return this
  }

  public addAuthentication(authentication: string | VerificationMethod) {
    const verificationMethod =
      authentication instanceof VerificationMethod || typeof authentication === 'string'
        ? authentication
        : new VerificationMethod(authentication)

    this.didDocument.authentication = [...this.didDocument.authentication, verificationMethod]

    return this
  }

  public addAssertionMethod(assertionMethod: string | VerificationMethod) {
    const verificationMethod =
      assertionMethod instanceof VerificationMethod || typeof assertionMethod === 'string'
        ? assertionMethod
        : new VerificationMethod(assertionMethod)

    this.didDocument.assertionMethod = [...this.didDocument.assertionMethod, verificationMethod]

    return this
  }
  public addCapabilityDelegation(capabilityDelegation: string | VerificationMethod) {
    const verificationMethod =
      capabilityDelegation instanceof VerificationMethod || typeof capabilityDelegation === 'string'
        ? capabilityDelegation
        : new VerificationMethod(capabilityDelegation)

    this.didDocument.capabilityDelegation = [...this.didDocument.capabilityDelegation, verificationMethod]

    return this
  }
  public addCapabilityInvocation(capabilityInvocation: string | VerificationMethod) {
    const verificationMethod =
      capabilityInvocation instanceof VerificationMethod || typeof capabilityInvocation === 'string'
        ? capabilityInvocation
        : new VerificationMethod(capabilityInvocation)

    this.didDocument.capabilityInvocation = [...this.didDocument.capabilityInvocation, verificationMethod]

    return this
  }
  public addKeyAgreement(keyAgreement: string | VerificationMethod) {
    const verificationMethod =
      keyAgreement instanceof VerificationMethod || typeof keyAgreement === 'string'
        ? keyAgreement
        : new VerificationMethod(keyAgreement)

    this.didDocument.keyAgreement = [...this.didDocument.keyAgreement, verificationMethod]

    return this
  }

  public build(): DidDocument {
    return this.didDocument
  }
}
