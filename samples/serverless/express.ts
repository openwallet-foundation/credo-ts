/**
 * A server agent with DIDComm and an OpenID4VC issuer for platforms that stop the CPU once a response is sent, such as Google Cloud Run with request based
 * billing. Each request keeps the promises Credo hands to `waitUntil` in an `AsyncLocalStorage`, and the response is
 * held until they have settled.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { setTimeout as sleep } from 'node:timers/promises'
import { AskarModule } from '@credo-ts/askar'
import type { KeyDidCreateOptions } from '@credo-ts/core'
import { Agent, ClaimFormat, ConsoleLogger, DidKey, LogLevel } from '@credo-ts/core'
import type { DidCommBasicMessageStateChangedEvent } from '@credo-ts/didcomm'
import { DidCommBasicMessageEventTypes, DidCommHttpOutboundTransport, DidCommModule } from '@credo-ts/didcomm'
import { agentDependencies, DidCommHttpInboundTransport } from '@credo-ts/node'
import type { OpenId4VcIssuanceSessionStateChangedEvent } from '@credo-ts/openid4vc'
import {
  OpenId4VcIssuanceSessionState,
  OpenId4VcIssuerEvents,
  OpenId4VciCredentialFormatProfile,
  OpenId4VcModule,
} from '@credo-ts/openid4vc'
import { NativeAskar } from '@openwallet-foundation/askar-nodejs'
import express from 'express'

const port = 3004
const requestStorage = new AsyncLocalStorage<{ id: number; receivedAt: number; pending: Promise<unknown>[] }>()
let requestCount = 0

function log(message: string) {
  const request = requestStorage.getStore()
  // The time since the request came in
  console.log(request ? `[request ${request.id} +${Date.now() - request.receivedAt}ms] ${message}` : message)
}

const app = express()

// The issuer DID is created once the agent has been initialized
let issuerDidUrl: string

// Registered before the agent adds its routes, so it also covers the DIDComm and OpenID4VC routes. Express has no hook
// that runs before a response goes out, so it wraps `res.end`, as express-session does to save the session first.
app.use((req, res, next) => {
  const request = { id: ++requestCount, receivedAt: Date.now(), pending: [] as Promise<unknown>[] }
  const end = res.end.bind(res)

  res.end = ((...args: Parameters<typeof end>) => {
    const start = Date.now()
    log(`${req.method} ${req.originalUrl} ready to respond with ${res.statusCode}, waiting for the work Credo started`)
    // Routing can continue after a response, and Express sends a 404 if the headers haven't been sent by then
    res.flushHeaders()

    void (async () => {
      // Settled work can start new work, so wait until no new promises come in
      let settled = 0
      while (settled < request.pending.length) {
        settled = request.pending.length
        await Promise.allSettled(request.pending)
      }

      log(`${req.method} ${req.originalUrl} responded after waiting ${Date.now() - start}ms for ${settled} promise(s)`)
      end(...args)
    })()

    return res
  }) as typeof res.end

  requestStorage.run(request, next)
})

const agent = new Agent({
  config: {
    logger: new ConsoleLogger(LogLevel.Warn),
    // The sample runs on http://localhost, OpenID4VC requires https otherwise
    allowInsecureHttpUrls: true,
    waitUntil: (promise) => requestStorage.getStore()?.pending.push(promise),
  },
  dependencies: agentDependencies,
  modules: {
    askar: new AskarModule({
      askar: NativeAskar,
      store: { id: 'server', key: 'server', database: { type: 'sqlite', config: { inMemory: true } } },
    }),
    didcomm: new DidCommModule({
      endpoints: [`http://localhost:${port}`],
      transports: {
        inbound: [new DidCommHttpInboundTransport({ app, port, respondAfterProcessing: true })],
        outbound: [new DidCommHttpOutboundTransport()],
      },
      connections: { autoAcceptConnections: true },
    }),
    openid4vc: new OpenId4VcModule({
      app,
      issuer: {
        baseUrl: `http://localhost:${port}/oid4vci`,
        credentialRequestToCredentialMapper: async ({ holderBinding }) => ({
          type: 'credentials',
          format: ClaimFormat.SdJwtDc,
          credentials: holderBinding.keys.map((holder) => ({
            payload: { vct: 'ExampleCredential', name: 'Client' },
            holder,
            issuer: { method: 'did', didUrl: issuerDidUrl },
          })),
        }),
      },
    }),
  },
})

// Stands in for slow work after Credo did something, such as calling a webhook
async function callWebhook(event: string) {
  log(`listener: ${event}, calling the webhook`)
  await sleep(1000)
  log('listener: webhook called')
}

agent.events.on<DidCommBasicMessageStateChangedEvent>(
  DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged,
  ({ payload }) => callWebhook(`received "${payload.message.content}"`)
)
agent.events.on<OpenId4VcIssuanceSessionStateChangedEvent>(
  OpenId4VcIssuerEvents.IssuanceSessionStateChanged,
  async ({ payload }) => {
    if (payload.issuanceSession.state === OpenId4VcIssuanceSessionState.Completed) {
      await callWebhook('issued a credential')
    }
  }
)

await agent.initialize()

const { didState } = await agent.dids.create<KeyDidCreateOptions>({
  method: 'key',
  options: { createKey: { type: { kty: 'OKP', crv: 'Ed25519' } } },
})
const issuerDid = DidKey.fromDid(didState.did as string)
issuerDidUrl = `${didState.did}#${issuerDid.publicJwk.fingerprint}`

const { issuerId } = await agent.openid4vc.issuer.createIssuer({
  credentialConfigurationsSupported: {
    ExampleCredential: {
      format: OpenId4VciCredentialFormatProfile.SdJwtDc,
      vct: 'ExampleCredential',
      cryptographic_binding_methods_supported: ['jwk'],
      credential_signing_alg_values_supported: ['EdDSA'],
      proof_types_supported: { jwt: { proof_signing_alg_values_supported: ['EdDSA'] } },
    },
  },
})

app.get('/invitation', async (_req, res) => {
  const { outOfBandInvitation } = await agent.didcomm.oob.createInvitation()
  res.send(outOfBandInvitation.toUrl({ domain: `http://localhost:${port}/invitation` }))
})

app.get('/credential-offer', async (_req, res) => {
  const { credentialOffer } = await agent.openid4vc.issuer.createCredentialOffer({
    issuerId,
    credentialConfigurationIds: ['ExampleCredential'],
    preAuthorizedCodeFlowConfig: {},
  })
  res.send(credentialOffer)
})

console.log(`Server listening on http://localhost:${port}`)
