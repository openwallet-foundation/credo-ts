import { transformPrivateKeyToPrivateJwk } from '@credo-ts/askar'
import type { InitConfig, KeyDidCreateOptions, ModulesMap, VerificationMethod } from '@credo-ts/core'
import { Agent, Buffer, ConsoleLogger, DidKey, LogLevel } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import type { Express } from 'express'
import express from 'express'
import type { Server } from 'http'
import { greenText } from './OutputClass'

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
  }: {
    port: number
    name: string
    modules: AgentModules
  }) {
    this.name = name
    this.port = port
    this.app = express()

    const config = {
      allowInsecureHttpUrls: true,
      logger: new ConsoleLogger(LogLevel.off),
    } satisfies InitConfig

    this.config = config

    this.agent = new Agent({
      config,
      dependencies: agentDependencies,
      modules,
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
      privateKey: Buffer.from(secretPrivateKey),
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
