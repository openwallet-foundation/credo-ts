import type { JwsLinkedDataSignature } from '../../crypto/JwsLinkedDataSignature'
import type { VerifyCredentialResult, W3cCredential, W3cVerifyCredentialResult } from './models'
import type { VerifyPresentationResult } from './models/presentation/VerifyPresentationResult'
import type { W3cPresentation } from './models/presentation/W3Presentation'
import type { RemoteDocument, Url } from 'jsonld/jsonld-spec'

import jsonld, { expand } from '@digitalcredentials/jsonld'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import documentLoaderNode from '@digitalcredentials/jsonld/lib/documentLoaders/node'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import documentLoaderXhr from '@digitalcredentials/jsonld/lib/documentLoaders/xhr'
import vc from '@digitalcredentials/vc'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Key, KeyType } from '../../crypto'
import { Ed25519Signature2018 } from '../../crypto/Ed25519Signature2018'
import { createWalletKeyPairClass } from '../../crypto/WalletKeyPair'
import { AriesFrameworkError } from '../../error'
import { Logger } from '../../logger'
import { JsonTransformer, orArrayToArray } from '../../utils'
import { Wallet } from '../../wallet'
import { DidKey, DidResolverService } from '../dids'

import { W3cVerifiableCredential } from './models'
import { W3cCredentialRecord } from './models/credential/W3cCredentialRecord'
import { W3cCredentialRepository } from './models/credential/W3cCredentialRepository'
import { W3cVerifiablePresentation } from './models/presentation/W3cVerifiablePresentation'

interface LdProofDetailOptions {
  proofType: string // TODO replace with enum
  proofPurpose?: string // TODO replace with enum
  verificationMethod: string
  created?: string
  domain?: string
  challenge?: string
  credentialStatus?: {
    type: string
  }
}

interface LdProofDetail {
  credential: W3cCredential
  options: LdProofDetailOptions
}

class SignatureSuiteRegistry {
  private suites: typeof JwsLinkedDataSignature[] = [Ed25519Signature2018]

  public get supportedProofTypes(): string[] {
    return this.suites.map((suite) => suite.type)
  }

  public getSuiteByKeyType(keyType: KeyType): typeof JwsLinkedDataSignature | undefined {
    return this.suites.find((suite) => suite.keyType === keyType)
  }

  public getSuiteByProofType(proofType: string): typeof JwsLinkedDataSignature | undefined {
    return this.suites.find((suite) => suite.proofType === proofType)
  }

  public getKeyTypeBySuite(suiteClass: typeof JwsLinkedDataSignature): KeyType {
    return suiteClass.key
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

  private static SIGNATURE_SUITE_MAP: { [type in KeyType]?: typeof Ed25519Signature2018 } = {
    [KeyType.Ed25519]: Ed25519Signature2018,
  }

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
    // create keyPair
    const WalletKeyPair = createWalletKeyPairClass(this.wallet)

    // VERIFY check where we should get out pub lic key from
    // Replace this later on with
    const publicKey = this.wallet.publicDid?.verkey

    if (!publicKey) {
      throw new AriesFrameworkError('No public key found in wallet')
    }

    const keyPair = new WalletKeyPair({
      controller: credential.issuerId,
      id: options.verificationMethod,
      key: Key.fromPublicKeyBase58(publicKey, KeyType.Ed25519),
      wallet: this.wallet,
    })

    const suite = new Ed25519Signature2018({
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
  public async verifyCredential(credential: W3cVerifiableCredential): Promise<W3cVerifyCredentialResult> {
    // MOCK
    return {
      verified: true,
      statusResult: {},
      results: [
        {
          credential: new W3cVerifiableCredential(credential),
          verified: true,
        },
      ],
    }
  }

  /**
   * Verifies a presentation including the credentials it includes
   *
   * @param presentation the presentation to be verified
   * @returns the verification result
   */
  public async verifyPresentation(presentation: W3cVerifiablePresentation): Promise<VerifyPresentationResult> {
    // MOCK
    let results: Array<VerifyCredentialResult> = []
    if (Array.isArray(presentation.verifiableCredential)) {
      results = await Promise.all(
        presentation.verifiableCredential.map(async (credential) => {
          return {
            credential,
            verified: true,
          }
        })
      )
    } else {
      results = [
        {
          credential: new W3cVerifiableCredential(presentation.verifiableCredential),
          verified: true,
        },
      ]
    }

    return {
      verified: true,
      presentationResult: {},
      credentialResults: results,
      // error?:
    }
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
   * Signs a presentation including the credentials it includes
   *
   * @param presentation the presentation to be signed
   * @returns the signed presentation
   */
  public async signPresentation(presentation: W3cPresentation): Promise<W3cVerifiablePresentation> {
    // MOCK
    return new W3cVerifiablePresentation({
      ...presentation,
      proof: {
        type: 'Ed25519Signature2020',
        created: '2022-02-25T14:58:43Z',
        verificationMethod: 'https://example.edu/issuers/14#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: 'z3BXsFfx1qJ5NsTkKqREjQ3AGh6RAmCwvgu1HcDSzK3P5QEg2TAw8ufktJBw8QkAQRciMGyBf5T2AHyRg2w13Uvhp',
      },
    })
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
      return {
        contextUrl: result.didDocument.context[0],
        documentUrl: url,
        document: result.didDocument.toJSON(),
      }
    }

    const loader = documentLoaderNode.apply(jsonld, [])

    return await loader(url)

    // // @ts-ignore
    // if (!navigator) {
    //   // nodejs
    //   console.log('DOCUMENT LOADER -- NODEJS')

    //   // @ts-ignore
    // } else {
    //   console.log('DOCUMENT LOADER -- RN')
    //   return documentLoaderXhr(url)
    // }
  }

  private getSignatureSuiteForDetail(detail: LdProofDetail) {}

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
