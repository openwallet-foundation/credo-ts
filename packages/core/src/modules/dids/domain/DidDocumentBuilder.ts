import type { DidDocumentService } from './service'
import type { VerificationMethod } from './verificationMethod'

import { DidDocument } from './DidDocument'

export class DidDocumentBuilder {
  private didDocument: DidDocument

  public constructor(id: string) {
    this.didDocument = new DidDocument({
      id,
    })
  }

  public addContext(context: string) {
    if (typeof this.didDocument.context === 'string') {
      this.didDocument.context = [this.didDocument.context, context]
    } else {
      this.didDocument.context.push(context)
    }

    return this
  }

  public addService(service: DidDocumentService) {
    if (!this.didDocument.service) {
      this.didDocument.service = []
    }

    this.didDocument.service.push(service)

    return this
  }

  public addVerificationMethod(verificationMethod: VerificationMethod) {
    if (!this.didDocument.verificationMethod) {
      this.didDocument.verificationMethod = []
    }

    this.didDocument.verificationMethod.push(verificationMethod)

    return this
  }

  public addAuthentication(authentication: string | VerificationMethod) {
    if (!this.didDocument.authentication) {
      this.didDocument.authentication = []
    }

    this.didDocument.authentication.push(authentication)

    return this
  }

  public addAssertionMethod(assertionMethod: string | VerificationMethod) {
    if (!this.didDocument.assertionMethod) {
      this.didDocument.assertionMethod = []
    }

    this.didDocument.assertionMethod.push(assertionMethod)

    return this
  }

  public addCapabilityDelegation(capabilityDelegation: string | VerificationMethod) {
    if (!this.didDocument.capabilityDelegation) {
      this.didDocument.capabilityDelegation = []
    }

    this.didDocument.capabilityDelegation.push(capabilityDelegation)

    return this
  }
  public addCapabilityInvocation(capabilityInvocation: string | VerificationMethod) {
    if (!this.didDocument.capabilityInvocation) {
      this.didDocument.capabilityInvocation = []
    }

    this.didDocument.capabilityInvocation.push(capabilityInvocation)

    return this
  }

  public addKeyAgreement(keyAgreement: string | VerificationMethod) {
    if (!this.didDocument.keyAgreement) {
      this.didDocument.keyAgreement = []
    }

    this.didDocument.keyAgreement.push(keyAgreement)

    return this
  }

  public addSignatureMethodAndRelationships(verificationMethod: VerificationMethod) {
    this.addVerificationMethod(verificationMethod)
      .addAuthentication(verificationMethod.id)
      .addAssertionMethod(verificationMethod.id)
      .addCapabilityDelegation(verificationMethod.id)
      .addCapabilityInvocation(verificationMethod.id)

    return this
  }

  public build(): DidDocument {
    return this.didDocument
  }
}
