import { transformPrivateKeyToPrivateJwk } from '@credo-ts/askar'
import type {
  GetTrustedIssuersForVerification,
  InitConfig,
  KeyDidCreateOptions,
  ModulesMap,
  VerificationMethod,
  VerificationSigner,
} from '@credo-ts/core'
import { Agent, ConsoleLogger, DidKey, LogLevel, TypedArrayEncoder } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import type { Express } from 'express'
import express from 'express'
import type { Server } from 'http'
import { greenText } from './OutputClass'

/**
 * Trusts every signer on the did, key or leaf certificate it presents. Only suitable for a demo,
 * as it accepts any issuer or verifier.
 */
export const trustAllSigners: GetTrustedIssuersForVerification<VerificationSigner, { type: string }> = async (
  _agentContext,
  { signer, verification }
) => {
  console.log(greenText(`dynamically trusting ${signer.method} signer for verification of ${verification.type}`, true))

  if (signer.method === 'x509') {
    return { trustedIssuers: [{ method: 'x509', issuance: [signer.certificateChain[0].toString('pem')] }] }
  }
  if (signer.method === 'did') return { trustedIssuers: [{ method: 'did', issuance: signer.didUrl }] }
  return { trustedIssuers: [{ method: 'jwk', issuance: signer.publicJwk.toJson() }] }
}

export class BaseAgent<AgentModules extends ModulesMap> {
  public app: Express
  public port: number
  public name: string
  public config: InitConfig
  public agent: Agent<AgentModules>
  public server?: Server
  public did!: string
  public didKey!: DidKey
  public kid!: string
  public verificationMethod!: VerificationMethod

  public constructor({
    port,
    name,
    modules,
    getTrustedIssuersForVerification,
  }: {
    port: number
    name: string
    modules: (app: Express) => AgentModules
    getTrustedIssuersForVerification?: InitConfig['getTrustedIssuersForVerification']
  }) {
    this.name = name
    this.port = port
    this.app = express()

    const config = {
      allowInsecureHttpUrls: true,
      logger: new ConsoleLogger(LogLevel.Off),
      getTrustedIssuersForVerification,
    } satisfies InitConfig

    this.config = config

    this.agent = new Agent({
      config,
      dependencies: agentDependencies,
      modules: modules(this.app),
    })
  }

  public async initializeAgent(secretPrivateKey: string) {
    await this.agent.initialize()

    this.server = this.app.listen(this.port)

    const { privateJwk } = transformPrivateKeyToPrivateJwk({
      type: {
        crv: 'Ed25519',
        kty: 'OKP',
      },
      privateKey: TypedArrayEncoder.fromUtf8String(secretPrivateKey),
    })

    const { keyId } = await this.agent.kms.importKey({
      privateJwk,
    })

    const didCreateResult = await this.agent.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: {
        keyId,
      },
    })

    this.did = didCreateResult.didState.did as string
    this.didKey = DidKey.fromDid(this.did)
    this.kid = `${this.did}#${this.didKey.publicJwk.fingerprint}`

    const verificationMethod = didCreateResult.didState.didDocument?.dereferenceKey(this.kid, ['authentication'])
    if (!verificationMethod) throw new Error('No verification method found')
    this.verificationMethod = verificationMethod

    console.log(greenText(`\nAgent ${this.name} created!\n`))
  }

  public async shutdown() {
    this.server?.close()
    await this.agent.shutdown()
  }
}
