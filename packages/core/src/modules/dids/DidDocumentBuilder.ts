import type { ServiceEndpoint, DIDDocument, VerificationMethod } from './types'

export class DidDocumentBuilder {
  private context = ['https://www.w3.org/ns/did/v1']
  private service: ServiceEndpoint[] = []
  private verificationMethod: VerificationMethod[] = []
  private authentication: Array<string | VerificationMethod> = []
  private assertionMethod: Array<string | VerificationMethod> = []
  private capabilityDelegation: Array<string | VerificationMethod> = []
  private capabilityInvocation: Array<string | VerificationMethod> = []
  private keyAgreement: Array<string | VerificationMethod> = []

  private id: string

  public constructor(id: string) {
    this.id = id
  }

  public addContext(context: string) {
    this.context.push(context)

    return this
  }

  public addService(service: ServiceEndpoint) {
    this.service.push(service)

    return this
  }

  public addVerificationMethod(verificationMethod: VerificationMethod) {
    this.verificationMethod.push(verificationMethod)

    return this
  }

  public addAuthentication(authentication: string | VerificationMethod) {
    this.authentication.push(authentication)

    return this
  }

  public addAssertionMethod(assertionMethod: string | VerificationMethod) {
    this.assertionMethod.push(assertionMethod)

    return this
  }
  public addCapabilityDelegation(capabilityDelegation: string | VerificationMethod) {
    this.capabilityDelegation.push(capabilityDelegation)

    return this
  }
  public addCapabilityInvocation(capabilityInvocation: string | VerificationMethod) {
    this.capabilityInvocation.push(capabilityInvocation)

    return this
  }
  public addKeyAgreement(keyAgreement: string | VerificationMethod) {
    this.keyAgreement.push(keyAgreement)

    return this
  }

  public build(): DIDDocument {
    return {
      '@context': this.context,
      id: this.id,
      service: this.service,
      authentication: this.authentication,
      verificationMethod: this.verificationMethod,
      assertionMethod: this.assertionMethod,
      capabilityDelegation: this.capabilityDelegation,
      capabilityInvocation: this.capabilityInvocation,
      keyAgreement: this.keyAgreement,
    }
  }
}
