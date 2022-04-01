import type { Key } from '../../crypto'
import type { JwsLinkedDataSignature, ProofPurpose } from '../../crypto/JwsLinkedDataSignature'
import type { SingleOrArray } from '../../utils/type'
import type { VerifyCredentialResult, W3cCredential, W3cVerifyCredentialResult } from './models'
import type { LinkedDataProof } from './models/LinkedDataProof'
import type { VerifyPresentationResult } from './models/presentation/VerifyPresentationResult'
import type { RemoteDocument, Url } from 'jsonld/jsonld-spec'

import jsonld, { expand } from '@digitalcredentials/jsonld'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import jsigs, { purposes } from '@digitalcredentials/jsonld-signatures'
import documentLoaderNode from '@digitalcredentials/jsonld/lib/documentLoaders/node'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import documentLoaderXhr from '@digitalcredentials/jsonld/lib/documentLoaders/xhr'
import vc from '@digitalcredentials/vc'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { KeyType } from '../../crypto'
import { Ed25519Signature2018 } from '../../crypto/Ed25519Signature2018'
import { createWalletKeyPairClass } from '../../crypto/WalletKeyPair'
import { AriesFrameworkError } from '../../error'
import { Logger } from '../../logger'
import { JsonTransformer, orArrayToArray } from '../../utils'
import { Wallet } from '../../wallet'
import { DidKey, DidResolverService, VerificationMethod } from '../dids'
import { getKeyDidMappingByVerificationMethod } from '../dids/domain/key-type'

import { W3cVerifiableCredential } from './models'
import { W3cCredentialRecord } from './models/credential/W3cCredentialRecord'
import { W3cCredentialRepository } from './models/credential/W3cCredentialRepository'
import { W3cPresentation } from './models/presentation/W3Presentation'
import { W3cVerifiablePresentation } from './models/presentation/W3cVerifiablePresentation'
import { CredentialIssuancePurpose } from './purposes/CredentialIssuancePurpose'

const LinkedDataSignature = jsigs.suites.LinkedDataSignature
export interface LdProofDetailOptions {
  proofType: string // TODO replace with enum
  proofPurpose?: ProofPurpose // TODO replace with enum
  verificationMethod: string
  created?: string
  domain?: string
  challenge?: string
  credentialStatus?: {
    type: string
  }
}

export interface LdProofDetail {
  credential: W3cCredential
  options: LdProofDetailOptions
}

// SUITE REGISTRY

interface SuiteInfo {
  suiteClass: typeof LinkedDataSignature
  proofType: string
  requiredKeyType: string
  keyType: string
}

class SignatureSuiteRegistry {
  private suiteMapping: SuiteInfo[] = [
    {
      suiteClass: Ed25519Signature2018,
      proofType: 'Ed25519Signature2018',
      requiredKeyType: 'Ed25519VerificationKey2018',
      keyType: KeyType.Ed25519,
    },
  ]

  public get supportedProofTypes(): string[] {
    return this.suiteMapping.map((x) => x.proofType)
  }

  public getByKeyType(keyType: KeyType) {
    return this.suiteMapping.find((x) => x.keyType === keyType)
  }

  public getByProofType(proofType: string) {
    const suiteInfo = this.suiteMapping.find((x) => x.proofType === proofType)

    if (!suiteInfo) {
      throw new AriesFrameworkError(`No signature suite for proof type: ${proofType}`)
    }

    return suiteInfo
  }

  public getKeyTypeByProofType(proofType: string): KeyType | undefined {
    return this.suiteMapping.find((x) => x.proofType === proofType)?.keyType
  }
}

@scoped(Lifecycle.ContainerScoped)
export class W3cCredentialService {
  private wallet: Wallet
  private w3cCredentialRepository: W3cCredentialRepository
  private didResolver: DidResolverService
  private agentConfig: AgentConfig
  private logger: Logger
  private suiteRegistry: SignatureSuiteRegistry

  public constructor(
    @inject('Wallet') wallet: Wallet,
    w3cCredentialRepository: W3cCredentialRepository,
    didResolver: DidResolverService,
    agentConfig: AgentConfig,
    logger: Logger
  ) {
    this.wallet = wallet
    this.w3cCredentialRepository = w3cCredentialRepository
    this.didResolver = didResolver
    this.agentConfig = agentConfig
    this.logger = logger
    this.suiteRegistry = new SignatureSuiteRegistry()
  }

  /**
   * Signs a credential
   *
   * @param credential the credential to be signed
   * @returns the signed credential
   */
  public async signCredential({ options, credential }: LdProofDetail): Promise<W3cVerifiableCredential> {
    const WalletKeyPair = createWalletKeyPairClass(this.wallet)

    const signingKey = await this.getPublicKeyFromVerificationMethod(options.verificationMethod)

    const suiteInfo = this.suiteRegistry.getByProofType(options.proofType)

    if (!suiteInfo) {
      throw new AriesFrameworkError(`The requested proofType ${options.proofType} is not supported`)
    }

    const keyPair = new WalletKeyPair({
      controller: credential.issuerId, // should we check this against the verificationMethod.controller?
      id: options.verificationMethod,
      key: signingKey,
      wallet: this.wallet,
    })

    const SuiteClass = suiteInfo.suiteClass

    const suite = new SuiteClass({
      key: keyPair,
      LDKeyClass: WalletKeyPair,
      proof: {
        verificationMethod: options.verificationMethod,
      },
      useNativeCanonize: false,
      date: options.created ?? new Date().toISOString(),
    })

    const result = await vc.issue({
      credential: JsonTransformer.toJSON(credential),
      suite: suite,
      purpose: options.proofPurpose,
      documentLoader: this.documentLoader,
    })

    return JsonTransformer.fromJSON(result, W3cVerifiableCredential)
  }

  /**
   * Verifies the signature(s) of a credential
   *
   * @param credential the credential to be verified
   * @returns the verification result
   */
  public async verifyCredential(options: {
    credential: W3cVerifiableCredential
    proofPurpose?: ProofPurpose
  }): Promise<W3cVerifyCredentialResult> {
    // create keyPair
    const WalletKeyPair = createWalletKeyPairClass(this.wallet)

    let proofs = options.credential.proof

    if (!Array.isArray(proofs)) {
      proofs = [proofs]
    }

    const suites = proofs.map((x) => {
      const SuiteClass = this.suiteRegistry.getByProofType(x.type)?.suiteClass
      if (SuiteClass) {
        return new SuiteClass({
          LDKeyClass: WalletKeyPair,
          proof: {
            verificationMethod: x.verificationMethod,
          },
          date: x.created,
          useNativeCanonize: false,
        })
      }
    })

    const verifyOptions: Record<string, any> = {
      credential: JsonTransformer.toJSON(options.credential),
      suite: suites,
      documentLoader: this.documentLoader,
    }

    // this is a hack because vcjs throws if purpose is passed as undefined or null
    if (options.proofPurpose) {
      verifyOptions['purpose'] = options.proofPurpose
    }

    const result = await vc.verifyCredential(verifyOptions)

    return result as unknown as W3cVerifyCredentialResult
  }

  /**
   * Verifies a presentation including the credentials it includes
   *
   * @param presentation the presentation to be verified
   * @returns the verification result
   */
  public async verifyPresentation(options: {
    presentation: W3cVerifiablePresentation
    proofType: string
    verificationMethod: string
    purpose: ProofPurpose
  }): Promise<VerifyPresentationResult> {
    // create keyPair
    const WalletKeyPair = createWalletKeyPairClass(this.wallet)

    let proofs = options.presentation.proof

    if (!Array.isArray(proofs)) {
      proofs = [proofs]
    }

    proofs = proofs.filter((x) => x.proofPurpose === options.purpose.term)

    const suites = proofs.map((x) => {
      const SuiteClass = this.suiteRegistry.getByProofType(x.type).suiteClass
      return new SuiteClass({
        LDKeyClass: WalletKeyPair,
        proof: {
          verificationMethod: x.verificationMethod,
        },
        date: x.created,
        useNativeCanonize: false,
      })
    })

    const verifyOptions: Record<string, any> = {
      presentation: JsonTransformer.toJSON(options.presentation),
      suite: suites,
      documentLoader: this.documentLoader,
    }

    // this is a hack because vcjs throws if purpose is passed as undefined or null
    if (options.purpose) {
      verifyOptions['presentationPurpose'] = options.purpose
    }

    const result = await vc.verify(verifyOptions)

    return result as unknown as VerifyPresentationResult
  }

  /**
   * Writes a credential to storage
   *
   * @param record the credential to be stored
   * @returns the credential record that was written to storage
   */
  public async storeCredential(record: W3cVerifiableCredential): Promise<W3cCredentialRecord> {
    // Get the expanded types
    const expandedTypes = (await expand(JsonTransformer.toJSON(record), { documentLoader: this.documentLoader }))[0][
      '@type'
    ]

    // Create an instance of the w3cCredentialRecord
    const w3cCredentialRecord = new W3cCredentialRecord({
      tags: { expandedTypes: orArrayToArray(expandedTypes) },
      credential: record,
    })

    // Store the w3c credential record
    await this.w3cCredentialRepository.save(w3cCredentialRecord)

    return w3cCredentialRecord
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
  public async createPresentation(
    credentials: SingleOrArray<W3cVerifiableCredential>,
    id?: string,
    holderUrl?: string
  ): Promise<W3cPresentation> {
    if (!Array.isArray(credentials)) {
      credentials = [credentials]
    }

    const presentationJson = vc.createPresentation({
      verifiableCredential: credentials.map((x) => JsonTransformer.toJSON(x)),
      id: id,
      holder: holderUrl,
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
    presentation: W3cPresentation,
    signatureType: string,
    purpose: ProofPurpose,
    verificationMethod: string
  ): Promise<W3cVerifiablePresentation> {
    // create keyPair
    const WalletKeyPair = createWalletKeyPairClass(this.wallet)

    const suiteInfo = this.suiteRegistry.getByProofType(signatureType)

    if (!suiteInfo) {
      throw new AriesFrameworkError(`The requested proofType ${signatureType} is not supported`)
    }

    const signingKey = await this.getPublicKeyFromVerificationMethod(verificationMethod)
    const verificationMethodObject = (await this.documentLoader(verificationMethod)).document as Record<string, any>

    const keyPair = new WalletKeyPair({
      controller: verificationMethodObject['controller'],
      id: verificationMethod,
      key: signingKey,
      wallet: this.wallet,
    })

    const suite = new suiteInfo.suiteClass({
      LDKeyClass: WalletKeyPair,
      proof: {
        verificationMethod: verificationMethod,
      },
      date: new Date().toISOString(),
      key: keyPair,
      useNativeCanonize: false,
    })

    const result = await vc.signPresentation({
      presentation: JsonTransformer.toJSON(presentation),
      suite: suite,
      purpose: purpose,
      documentLoader: this.documentLoader,
    })
    return JsonTransformer.fromJSON(result, W3cVerifiablePresentation)
  }

  /**
   * K-TODO: make sure this method validates that all given credential attributes are also in the JSON-LD context
   * @see https://github.com/gjgd/jsonld-checker
   * NOTE: the library above has NodeJS specific dependencies. We should consider copying it into this codebase
   * @param jsonLd
   */
  public validateCredential(jsonLd: string): Promise<any> {
    throw new Error('Method not implemented.')
  }

  private getVerificationMethod(did: string): string {
    // TODO resolve verification method through DID resolver / documentloader
    if (did.startsWith('did:key:')) {
      return DidKey.fromDid(did).keyId
    }
    if (did.startsWith('did:sov:')) {
      return did + '#key-1'
    }
    throw new AriesFrameworkError(`Unable to get verification method for DID: ${did}`)
  }

  private assertCanIssueWithIssuerIdAndProofType(issuerId: string, proofType: string): void {
    if (!this.suiteRegistry.supportedProofTypes.includes(proofType)) {
      throw new AriesFrameworkError(`Unsupported proof type: ${proofType}`)
    }

    if (!issuerId.startsWith('did:')) {
      throw new AriesFrameworkError(
        `Unable to issue credential with issuer id: ${issuerId}. Only issuance with DIDs is supported`
      )
    }

    // TODO validate if the DID is allowed to issue with this proof type
  }

  public documentLoader = async (url: Url): Promise<RemoteDocument> => {
    if (url.startsWith('did:')) {
      const result = await this.didResolver.resolve(url)

      if (result.didResolutionMetadata.error || !result.didDocument) {
        // TODO: we should probably handle this more gracefully
        throw new AriesFrameworkError(`Unable to resolve DID: ${url}`)
      }

      const framed = await jsonld.frame(
        result.didDocument.toJSON(),
        {
          '@context': result.didDocument.context,
          '@embed': '@never',
          id: url,
        },
        { compactToRelative: false }
      )

      return {
        contextUrl: result.didDocument.context[0],
        documentUrl: url,
        document: framed,
      }
    }

    const loader = documentLoaderNode.apply(jsonld, [])

    return await loader(url)
  }

  private getSignatureSuiteForDetail(detail: LdProofDetail) {}

  private async getPublicKeyFromVerificationMethod(verificationMethod: string): Promise<Key> {
    const verificationMethodObject = await this.documentLoader(verificationMethod)
    const verificationMethodClass = JsonTransformer.fromJSON(verificationMethodObject.document, VerificationMethod)

    const key = getKeyDidMappingByVerificationMethod(verificationMethodClass)

    return key.getKeyFromVerificationMethod(verificationMethodClass)
  }

  // private getSignatureSuite(options: {
  //   proofType: KeyType
  //   didInfo: DidInfo
  //   verificationMethod?: string
  //   proof?: Record<string, unknown>
  // }): JwsLinkedDataSignature {
  //   const SignatureClass = W3cCredentialService.SIGNATURE_SUITE_MAP[options.proofType]

  //   const WalletKeyPair = createWalletKeyPairClass(this.wallet)

  //   const proof = new LinkedDataProof({
  //     created: o
  //   })

  //   const walletKeyPair = new WalletKeyPair({
  //       controller: '',
  //       id: '',
  //       key: Key.fromPublicKeyBase58(options.didInfo.verkey, options.proofType),
  //       wallet: this.wallet,
  //     }),

  //   return new SignatureClass({
  //     key:
  //   })
  // }
}
