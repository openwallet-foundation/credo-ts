import { bodyParser } from '@koa/bodyparser'
import { Provider } from 'oidc-provider'

// I can't figure out how to bind a custom request parameter to the session
// so it can be bound to the access token. This is a very hacky 'global' issuer_state
// and only works if only person is authenticating. Of course very unsecure, but it's a demo
let issuer_state: string | undefined

const PROVIDER_HOST = process.env.PROVIDER_HOST ?? 'http://localhost:3042'
const ISSUER_HOST = process.env.ISSUER_HOST ?? 'http://localhost:2000'

const oidc = new Provider(PROVIDER_HOST, {
  clientAuthMethods: ['client_secret_basic', 'client_secret_post', 'none'],
  clients: [
    {
      client_id: 'wallet',
      client_secret: 'wallet',
      grant_types: ['authorization_code'],
      id_token_signed_response_alg: 'ES256',
      redirect_uris: [],
      application_type: 'native',
    },
    {
      client_id: 'issuer-server',
      client_secret: 'issuer-server',
      id_token_signed_response_alg: 'ES256',
      redirect_uris: [],
    },
  ],
  jwks: {
    keys: [
      {
        alg: 'ES256',
        kid: 'first-key',
        kty: 'EC',
        d: '2hdTKWEZza_R-DF4l3aoWEuGZPy6L6PGmUT_GqeJczM',
        crv: 'P-256',
        x: '73lW9QyiXTvpOOXuT_LoRRvM3oEWKSLyzfNGe04sV5k',
        y: 'AiFefLdnP-cWkdsevwozKdxNGvF_VSSZ1K5yDQ4jWwM',
      },
    ],
  },
  scopes: [],
  extraTokenClaims: async (_context, token) => {
    if (token.kind === 'AccessToken') {
      return {
        issuer_state,
      }
    }
    return undefined
  },
  clientBasedCORS: () => true,
  extraParams: {
    issuer_state: (_, value) => {
      issuer_state = value
    },
  },
  features: {
    dPoP: { enabled: true },
    pushedAuthorizationRequests: {
      enabled: true,
      requirePushedAuthorizationRequests: true,
      allowUnregisteredRedirectUris: true,
    },
    introspection: {
      enabled: true,
    },
    resourceIndicators: {
      defaultResource: () => `${ISSUER_HOST}/oid4vci/726222ad-7624-4f12-b15b-e08aa7042ffa`,
      enabled: true,
      getResourceServerInfo: (context) => {
        return {
          scope: Array.from(context.oidc.requestParamScopes).join(' '),
          accessTokenTTL: 5 * 60, // 5 minutes

          // NOTE: switch this between opaque and jwt to use JWT tokens or Token introspection
          accessTokenFormat: 'jwt',
          audience: `${ISSUER_HOST}/oid4vci/726222ad-7624-4f12-b15b-e08aa7042ffa`,
          jwt: {
            sign: {
              kid: 'first-key',
              alg: 'ES256',
            },
          },
        }
      },
      useGrantedResource: () => {
        return true
      },
    },
  },

  async findAccount(_, id) {
    return {
      accountId: id,
      async claims() {
        return { sub: id }
      },
    }
  },
})
oidc.proxy = true

oidc.use(bodyParser())
oidc.use(async (ctx, next) => {
  if (!ctx.path.startsWith('/interaction') && !ctx.path.startsWith('/.well-known/')) {
    console.log(
      'Request',
      JSON.stringify({ path: ctx.path, body: ctx.request.body, headers: ctx.request.headers }, null, 2)
    )
  }

  // We hack the client secret (to allow public client with unregistered redirect uri)
  if (ctx.path === '/request' || ctx.path === '/token') {
    // @ts-expect-error
    ctx.request.body.client_id = 'wallet'
    // @ts-expect-error
    ctx.request.body.client_secret = 'wallet'
  }

  await next()

  if (!ctx.path.startsWith('/interaction') && !ctx.path.startsWith('/.well-known/')) {
    console.log(
      'Response',
      JSON.stringify(
        { path: ctx.path, body: ctx.response.body, status: ctx.response.status, headers: ctx.response.headers },
        null,
        2
      )
    )
  }
})

oidc.listen(3042, () => {
  console.log(`oidc-provider listening on port 3042, check ${PROVIDER_HOST}/.well-known/openid-configuration`)
})
