import { asArray } from '../../../utils'
import { DidDocument } from './DidDocument'
import type { DidDocumentService } from './service'
import { VerificationMethod } from './verificationMethod'

export class DidDocumentBuilder {
  private didDocument: DidDocument

  public constructor(id: string) {
    this.didDocument = new DidDocument({
      id,
    })
  }

  public addContext(context: string) {
    const currentContexts = asArray(this.didDocument.context)
    if (currentContexts.includes(context)) return this

    this.didDocument.context = [...currentContexts, context]
    return this
  }

  public addController(controller: string) {
    const currentControllers = asArray(this.didDocument.controller)
    if (currentControllers.includes(controller)) return this

    this.didDocument.controller = [...currentControllers, controller]
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

    this.didDocument.verificationMethod.push(
      verificationMethod instanceof VerificationMethod ? verificationMethod : new VerificationMethod(verificationMethod)
    )

    return this
  }

  public addAuthentication(authentication: string | VerificationMethod) {
    if (!this.didDocument.authentication) {
      this.didDocument.authentication = []
    }

    const verificationMethod =
      authentication instanceof VerificationMethod || typeof authentication === 'string'
        ? authentication
        : new VerificationMethod(authentication)

    this.didDocument.authentication.push(verificationMethod)

    return this
  }

  public addAssertionMethod(assertionMethod: string | VerificationMethod) {
    if (!this.didDocument.assertionMethod) {
      this.didDocument.assertionMethod = []
    }

    const verificationMethod =
      assertionMethod instanceof VerificationMethod || typeof assertionMethod === 'string'
        ? assertionMethod
        : new VerificationMethod(assertionMethod)

    this.didDocument.assertionMethod.push(verificationMethod)

    return this
  }

  public addCapabilityDelegation(capabilityDelegation: string | VerificationMethod) {
    if (!this.didDocument.capabilityDelegation) {
      this.didDocument.capabilityDelegation = []
    }

    const verificationMethod =
      capabilityDelegation instanceof VerificationMethod || typeof capabilityDelegation === 'string'
        ? capabilityDelegation
        : new VerificationMethod(capabilityDelegation)

    this.didDocument.capabilityDelegation.push(verificationMethod)

    return this
  }
  public addCapabilityInvocation(capabilityInvocation: string | VerificationMethod) {
    if (!this.didDocument.capabilityInvocation) {
      this.didDocument.capabilityInvocation = []
    }

    const verificationMethod =
      capabilityInvocation instanceof VerificationMethod || typeof capabilityInvocation === 'string'
        ? capabilityInvocation
        : new VerificationMethod(capabilityInvocation)

    this.didDocument.capabilityInvocation.push(verificationMethod)

    return this
  }

  public addKeyAgreement(keyAgreement: string | VerificationMethod) {
    if (!this.didDocument.keyAgreement) {
      this.didDocument.keyAgreement = []
    }

    const verificationMethod =
      keyAgreement instanceof VerificationMethod || typeof keyAgreement === 'string'
        ? keyAgreement
        : new VerificationMethod(keyAgreement)

    this.didDocument.keyAgreement.push(verificationMethod)

    return this
  }

  public build(): DidDocument {
    return this.didDocument
  }
}
