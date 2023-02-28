import type { W3cVerifyCredentialResult } from './models'
import type {
  CreatePresentationOptions,
  DeriveProofOptions,
  SignCredentialOptions,
  SignPresentationOptions,
  StoreCredentialOptions,
  VerifyCredentialOptions,
  VerifyPresentationOptions,
} from './models/W3cCredentialServiceOptions'
import type { VerifyPresentationResult } from './models/presentation/VerifyPresentationResult'
import type { AgentContext } from '../../agent/context'
import type { Key } from '../../crypto/Key'
import type { Query } from '../../storage/StorageService'

import { createWalletKeyPairClass } from '../../crypto/WalletKeyPair'
import { AriesFrameworkError } from '../../error'
import { injectable } from '../../plugins'
import { JsonTransformer } from '../../utils'
import { VerificationMethod } from '../dids'
import { getKeyFromVerificationMethod } from '../dids/domain/key-type'

import { SignatureSuiteRegistry } from './SignatureSuiteRegistry'
import { W3cVcModuleConfig } from './W3cVcModuleConfig'
import { deriveProof } from './deriveProof'
import { orArrayToArray, w3cDate } from './jsonldUtil'
import jsonld from './libraries/jsonld'
import vc from './libraries/vc'
import { W3cVerifiableCredential } from './models'
import { W3cPresentation } from './models/presentation/W3cPresentation'
import { W3cVerifiablePresentation } from './models/presentation/W3cVerifiablePresentation'
import { W3cCredentialRecord, W3cCredentialRepository } from './repository'

@injectable()
export class W3cCredentialService {
  private w3cCredentialRepository: W3cCredentialRepository
  private signatureSuiteRegistry: SignatureSuiteRegistry
  private w3cVcModuleConfig: W3cVcModuleConfig

  public constructor(
    w3cCredentialRepository: W3cCredentialRepository,
    signatureSuiteRegistry: SignatureSuiteRegistry,
    w3cVcModuleConfig: W3cVcModuleConfig
  ) {
    this.w3cCredentialRepository = w3cCredentialRepository
    this.signatureSuiteRegistry = signatureSuiteRegistry
    this.w3cVcModuleConfig = w3cVcModuleConfig
  }

  /**
   * Signs a credential
   *
   * @param credential the credential to be signed
   * @returns the signed credential
   */
  public async signCredential(
    agentContext: AgentContext,
    options: SignCredentialOptions
  ): Promise<W3cVerifiableCredential> {
    const WalletKeyPair = createWalletKeyPairClass(agentContext.wallet)

    const signingKey = await this.getPublicKeyFromVerificationMethod(agentContext, options.verificationMethod)
    const suiteInfo = this.signatureSuiteRegistry.getByProofType(options.proofType)

    if (!suiteInfo.keyTypes.includes(signingKey.keyType)) {
      throw new AriesFrameworkError('The key type of the verification method does not match the suite')
    }

    const keyPair = new WalletKeyPair({
      controller: options.credential.issuerId, // should we check this against the verificationMethod.controller?
      id: options.verificationMethod,
      key: signingKey,
      wallet: agentContext.wallet,
    })

    const SuiteClass = suiteInfo.suiteClass

    const suite = new SuiteClass({
      key: keyPair,
      LDKeyClass: WalletKeyPair,
      proof: {
        verificationMethod: options.verificationMethod,
      },
      useNativeCanonize: false,
      date: options.created ?? w3cDate(),
    })

    const result = await vc.issue({
      credential: JsonTransformer.toJSON(options.credential),
      suite: suite,
      purpose: options.proofPurpose,
      documentLoader: this.w3cVcModuleConfig.documentLoader(agentContext),
    })

    return JsonTransformer.fromJSON(result, W3cVerifiableCredential)
  }

  /**
   * Verifies the signature(s) of a credential
   *
   * @param credential the credential to be verified
   * @returns the verification result
   */
  public async verifyCredential(
    agentContext: AgentContext,
    options: VerifyCredentialOptions,
    verifyRevocationState = true
  ): Promise<W3cVerifyCredentialResult> {
    const suites = this.getSignatureSuitesForCredential(agentContext, options.credential)

    const verifyOptions: Record<string, unknown> = {
      credential: JsonTransformer.toJSON(options.credential),
      suite: suites,
      documentLoader: this.w3cVcModuleConfig.documentLoader(agentContext),
      checkStatus: () => {
        if (verifyRevocationState) {
          throw new AriesFrameworkError('Revocation for W3C credentials is currently not supported')
        }
        return {
          verified: true,
        }
      },
    }

    // this is a hack because vcjs throws if purpose is passed as undefined or null
    if (options.proofPurpose) {
      verifyOptions['purpose'] = options.proofPurpose
    }

    const result = await vc.verifyCredential(verifyOptions)

    return result as unknown as W3cVerifyCredentialResult
  }

  /**
   * Utility method that creates a {@link W3cPresentation} from one or more {@link W3cVerifiableCredential}s.
   *
   * **NOTE: the presentation that is returned is unsigned.**
   *
   * @param credentials One or more instances of {@link W3cVerifiableCredential}
   * @param [id] an optional unique identifier for the presentation
   * @param [holderUrl] an optional identifier identifying the entity that is generating the presentation
   * @returns An instance of {@link W3cPresentation}
   */
  public async createPresentation(options: CreatePresentationOptions): Promise<W3cPresentation> {
    if (!Array.isArray(options.credentials)) {
      options.credentials = [options.credentials]
    }

    const presentationJson = vc.createPresentation({
      verifiableCredential: options.credentials.map((credential) => JsonTransformer.toJSON(credential)),
      id: options.id,
      holder: options.holderUrl,
    })

    return JsonTransformer.fromJSON(presentationJson, W3cPresentation)
  }

  /**
   * Signs a presentation including the credentials it includes
   *
   * @param presentation the presentation to be signed
   * @returns the signed presentation
   */
  public async signPresentation(
    agentContext: AgentContext,
    options: SignPresentationOptions
  ): Promise<W3cVerifiablePresentation> {
    // create keyPair
    const WalletKeyPair = createWalletKeyPairClass(agentContext.wallet)

    const suiteInfo = this.signatureSuiteRegistry.getByProofType(options.signatureType)

    if (!suiteInfo) {
      throw new AriesFrameworkError(`The requested proofType ${options.signatureType} is not supported`)
    }

    const signingKey = await this.getPublicKeyFromVerificationMethod(agentContext, options.verificationMethod)

    if (!suiteInfo.keyTypes.includes(signingKey.keyType)) {
      throw new AriesFrameworkError('The key type of the verification method does not match the suite')
    }

    const documentLoader = this.w3cVcModuleConfig.documentLoader(agentContext)
    const verificationMethodObject = (await documentLoader(options.verificationMethod)).document as Record<
      string,
      unknown
    >

    const keyPair = new WalletKeyPair({
      controller: verificationMethodObject['controller'] as string,
      id: options.verificationMethod,
      key: signingKey,
      wallet: agentContext.wallet,
    })

    const suite = new suiteInfo.suiteClass({
      LDKeyClass: WalletKeyPair,
      proof: {
        verificationMethod: options.verificationMethod,
      },
      date: new Date().toISOString(),
      key: keyPair,
      useNativeCanonize: false,
    })

    const result = await vc.signPresentation({
      presentation: JsonTransformer.toJSON(options.presentation),
      suite: suite,
      challenge: options.challenge,
      documentLoader: this.w3cVcModuleConfig.documentLoader(agentContext),
    })

    return JsonTransformer.fromJSON(result, W3cVerifiablePresentation)
  }

  /**
   * Verifies a presentation including the credentials it includes
   *
   * @param presentation the presentation to be verified
   * @returns the verification result
   */
  public async verifyPresentation(
    agentContext: AgentContext,
    options: VerifyPresentationOptions
  ): Promise<VerifyPresentationResult> {
    // create keyPair
    const WalletKeyPair = createWalletKeyPairClass(agentContext.wallet)

    let proofs = options.presentation.proof

    if (!Array.isArray(proofs)) {
      proofs = [proofs]
    }
    if (options.purpose) {
      proofs = proofs.filter((proof) => proof.proofPurpose === options.purpose.term)
    }

    const presentationSuites = proofs.map((proof) => {
      const SuiteClass = this.signatureSuiteRegistry.getByProofType(proof.type).suiteClass
      return new SuiteClass({
        LDKeyClass: WalletKeyPair,
        proof: {
          verificationMethod: proof.verificationMethod,
        },
        date: proof.created,
        useNativeCanonize: false,
      })
    })

    const credentials = Array.isArray(options.presentation.verifiableCredential)
      ? options.presentation.verifiableCredential
      : [options.presentation.verifiableCredential]

    const credentialSuites = credentials.map((credential) =>
      this.getSignatureSuitesForCredential(agentContext, credential)
    )
    const allSuites = presentationSuites.concat(...credentialSuites)

    const verifyOptions: Record<string, unknown> = {
      presentation: JsonTransformer.toJSON(options.presentation),
      suite: allSuites,
      challenge: options.challenge,
      documentLoader: this.w3cVcModuleConfig.documentLoader(agentContext),
    }

    // this is a hack because vcjs throws if purpose is passed as undefined or null
    if (options.purpose) {
      verifyOptions['presentationPurpose'] = options.purpose
    }

    const result = await vc.verify(verifyOptions)

    return result as unknown as VerifyPresentationResult
  }

  public async deriveProof(agentContext: AgentContext, options: DeriveProofOptions): Promise<W3cVerifiableCredential> {
    // TODO: make suite dynamic
    const suiteInfo = this.signatureSuiteRegistry.getByProofType('BbsBlsSignatureProof2020')
    const SuiteClass = suiteInfo.suiteClass

    const suite = new SuiteClass()

    const proof = await deriveProof(JsonTransformer.toJSON(options.credential), options.revealDocument, {
      suite: suite,
      documentLoader: this.w3cVcModuleConfig.documentLoader(agentContext),
    })

    return proof
  }

  private async getPublicKeyFromVerificationMethod(
    agentContext: AgentContext,
    verificationMethod: string
  ): Promise<Key> {
    const documentLoader = this.w3cVcModuleConfig.documentLoader(agentContext)
    const verificationMethodObject = await documentLoader(verificationMethod)
    const verificationMethodClass = JsonTransformer.fromJSON(verificationMethodObject.document, VerificationMethod)

    const key = getKeyFromVerificationMethod(verificationMethodClass)
    return key
  }

  /**
   * Writes a credential to storage
   *
   * @param record the credential to be stored
   * @returns the credential record that was written to storage
   */
  public async storeCredential(
    agentContext: AgentContext,
    options: StoreCredentialOptions
  ): Promise<W3cCredentialRecord> {
    // Get the expanded types
    const expandedTypes = (
      await jsonld.expand(JsonTransformer.toJSON(options.credential), {
        documentLoader: this.w3cVcModuleConfig.documentLoader(agentContext),
      })
    )[0]['@type']

    // Create an instance of the w3cCredentialRecord
    const w3cCredentialRecord = new W3cCredentialRecord({
      tags: { expandedTypes: orArrayToArray<string>(expandedTypes) },
      credential: options.credential,
    })

    // Store the w3c credential record
    await this.w3cCredentialRepository.save(agentContext, w3cCredentialRecord)

    return w3cCredentialRecord
  }

  public async removeCredentialRecord(agentContext: AgentContext, id: string) {
    const credential = await this.w3cCredentialRepository.getById(agentContext, id)
    await this.w3cCredentialRepository.delete(agentContext, credential)
  }

  public async getAllCredentialRecords(agentContext: AgentContext): Promise<W3cCredentialRecord[]> {
    return await this.w3cCredentialRepository.getAll(agentContext)
  }

  public async getCredentialRecordById(agentContext: AgentContext, id: string): Promise<W3cCredentialRecord> {
    return await this.w3cCredentialRepository.getById(agentContext, id)
  }

  public async findCredentialsByQuery(
    agentContext: AgentContext,
    query: Query<W3cCredentialRecord>
  ): Promise<W3cVerifiableCredential[]> {
    const result = await this.w3cCredentialRepository.findByQuery(agentContext, query)
    return result.map((record) => record.credential)
  }

  public getVerificationMethodTypesByProofType(proofType: string): string[] {
    return this.signatureSuiteRegistry.getByProofType(proofType).verificationMethodTypes
  }

  public getKeyTypesByProofType(proofType: string): string[] {
    return this.signatureSuiteRegistry.getByProofType(proofType).keyTypes
  }

  public async findCredentialRecordByQuery(
    agentContext: AgentContext,
    query: Query<W3cCredentialRecord>
  ): Promise<W3cVerifiableCredential | undefined> {
    const result = await this.w3cCredentialRepository.findSingleByQuery(agentContext, query)
    return result?.credential
  }
  public getProofTypeByVerificationMethodType(verificationMethodType: string): string {
    const suite = this.signatureSuiteRegistry.getByVerificationMethodType(verificationMethodType)

    if (!suite) {
      throw new AriesFrameworkError(`No suite found for verification method type ${verificationMethodType}}`)
    }

    return suite.proofType
  }

  private getSignatureSuitesForCredential(agentContext: AgentContext, credential: W3cVerifiableCredential) {
    const WalletKeyPair = createWalletKeyPairClass(agentContext.wallet)

    let proofs = credential.proof

    if (!Array.isArray(proofs)) {
      proofs = [proofs]
    }

    return proofs.map((proof) => {
      const SuiteClass = this.signatureSuiteRegistry.getByProofType(proof.type)?.suiteClass
      if (SuiteClass) {
        return new SuiteClass({
          LDKeyClass: WalletKeyPair,
          proof: {
            verificationMethod: proof.verificationMethod,
          },
          date: proof.created,
          useNativeCanonize: false,
        })
      }
    })
  }
}
