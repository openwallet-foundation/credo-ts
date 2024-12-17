import type { AgentContext } from '../../agent'
import type { JwtPayload } from '../../crypto'
import type { Mdoc } from '../mdoc/Mdoc'
import type { MdocDeviceResponse } from '../mdoc/MdocDeviceResponse'
import type { SdJwtVc } from '../sd-jwt-vc'
import type { W3cJwtVerifiableCredential, W3cJwtVerifiablePresentation } from '../vc'

import { X509Certificate } from './X509Certificate'

type X509VerificationTypeCredential = {
  type: 'credential'
  credential: SdJwtVc | Mdoc | MdocDeviceResponse | W3cJwtVerifiableCredential | W3cJwtVerifiablePresentation

  /**
   * The `id` of the `DidCommProofRecord` that this verification is bound to.
   */
  didcommProofRecordId?: string

  /**
   * The `id` of the `OpenId4VcVerificationSessionRecord` that this verification is bound to.
   */
  openId4VcVerificationSessionId?: string
}

type X509VerificationTypeOauth2SecuredAuthorizationRequest = {
  type: 'oauth2SecuredAuthorizationRequest'
  authorizationRequest: {
    jwt: string
    payload: JwtPayload
  }
}

export interface X509VerificationContext {
  /**
   * The certificate chain provided with the data to be verified. The trusted certificates
   * are determined before verification and thus it is not verified that the data was actually
   * signed by the private key assocaited with the leaf certificate in the certificate chain, or
   * whether the certificate chain is valid. However if the certificate
   * does not match, or is not valid, verification will always fail at a later stage
   */
  certificateChain: X509Certificate[]

  verification: X509VerificationTypeCredential | X509VerificationTypeOauth2SecuredAuthorizationRequest
}

export interface X509ModuleConfigOptions {
  /**
   *
   * Array of trusted base64-encoded certificate strings in the DER-format.
   */
  trustedCertificates?: [string, ...string[]]

  /**
   * Optional callback method that will be called to dynamically get trusted certificates for a verification.
   * It will provide the `agentContext` and `verificationContext` allowing to dynamically set the trusted certificates
   * for a tenant or verificaiton context.
   *
   * If no certificaets should be trusted an empty array should be returned. If `undefined` is returned
   * it will fallback to the globally registered trusted certificates
   *
   * @returns An array of base64-encoded certificate strings or PEM certificate strings.
   */
  getTrustedCertificatesForVerification?(
    agentContext: AgentContext,
    verificationContext: X509VerificationContext
  ): Promise<string[] | undefined> | string[] | undefined
}

export class X509ModuleConfig {
  #trustedCertificates?: X509Certificate[]
  #getTrustedCertificatesForVerification?: X509ModuleConfigOptions['getTrustedCertificatesForVerification']

  public constructor(options?: X509ModuleConfigOptions) {
    this.setTrustedCertificates(options?.trustedCertificates)
    if (options?.getTrustedCertificatesForVerification) {
      this.setTrustedCertificatesForVerification(options.getTrustedCertificatesForVerification)
    }
  }

  public get trustedCertificates() {
    // TODO: we should probably update this API to return the instances, but don't want to
    // break too much now
    return this.#trustedCertificates?.map((cert) => cert.toString('pem'))
  }

  public get getTrustedCertificatesForVerification() {
    return this.#getTrustedCertificatesForVerification
  }

  public setTrustedCertificatesForVerification(fn: X509ModuleConfigOptions['getTrustedCertificatesForVerification']) {
    this.#getTrustedCertificatesForVerification = fn
  }

  public setTrustedCertificates(trustedCertificates?: [string, ...string[]]) {
    this.#trustedCertificates = trustedCertificates
      ? trustedCertificates.map((certificate) => X509Certificate.fromEncodedCertificate(certificate))
      : undefined
  }

  public addTrustedCertificate(trustedCertificate: string) {
    if (!this.#trustedCertificates) {
      this.#trustedCertificates = [X509Certificate.fromEncodedCertificate(trustedCertificate)]
      return
    }
    this.#trustedCertificates.push(X509Certificate.fromEncodedCertificate(trustedCertificate))
  }
}
