/**
 * Receives a credential from the OpenID4VC issuer of the Express server sample: `pnpm express`, then
 * `pnpm client:openid4vc`.
 */

import { AskarModule } from '@credo-ts/askar'
import { Agent, ConsoleLogger, Kms, LogLevel } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { OpenId4VcModule } from '@credo-ts/openid4vc'
import { NativeAskar } from '@openwallet-foundation/askar-nodejs'

const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3004'

const agent = new Agent({
  // The sample runs on http://localhost, OpenID4VC requires https otherwise
  config: { logger: new ConsoleLogger(LogLevel.Warn), allowInsecureHttpUrls: true },
  dependencies: agentDependencies,
  modules: {
    askar: new AskarModule({
      askar: NativeAskar,
      store: { id: 'client', key: 'client', database: { type: 'sqlite', config: { inMemory: true } } },
    }),
    openid4vc: new OpenId4VcModule(),
  },
})

await agent.initialize()

const credentialOffer = await (await fetch(`${serverUrl}/credential-offer`)).text()
const resolvedCredentialOffer = await agent.openid4vc.holder.resolveCredentialOffer(credentialOffer)
const tokenResponse = await agent.openid4vc.holder.requestToken({ resolvedCredentialOffer })

const start = Date.now()
const { credentials } = await agent.openid4vc.holder.requestCredentials({
  resolvedCredentialOffer,
  ...tokenResponse,
  credentialBindingResolver: async () => {
    const key = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    return { method: 'jwk', keys: [Kms.PublicJwk.fromPublicJwk(key.publicJwk)] }
  },
})
console.log(`client: the server responded with ${credentials.length} credential(s) after ${Date.now() - start}ms`)

await agent.shutdown()
