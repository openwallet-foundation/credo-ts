import { bodyParser } from '@koa/bodyparser'
import { Provider } from 'oidc-provider'

const oidc = new Provider('http://localhost:3042', {
  clients: [
    {
      client_id: 'foo',
      client_secret: 'bar',
      redirect_uris: ['http://localhost:3000/redirect'],
      grant_types: ['authorization_code'],
      id_token_signed_response_alg: 'ES256',
    },
    {
      client_id: 'issuer-server',
      client_secret: 'issuer-server',
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
  scopes: [
    'openid4vc:credential:UniversityDegreeCredential-jwtvcjson',
    'openid4vc:credential:OpenBadgeCredential-ldpvc',
    'openid4vc:credential:OpenBadgeCredential-sdjwt',
    'openid4vc:credential:OpenBadgeCredential-mdoc',
  ],
  pkce: {
    methods: ['S256'],
    required: () => true,
  },
  extraTokenClaims: async (context, token) => {
    if (token.kind === 'AccessToken') {
      return {
        issuer_state: context.request.body.issuer_state,
      }
    }
    return undefined
  },
  features: {
    dPoP: { enabled: true },
    pushedAuthorizationRequests: {
      enabled: true,
      requirePushedAuthorizationRequests: true,
    },
    introspection: {
      enabled: true,
    },
    resourceIndicators: {
      defaultResource: () => 'http://localhost:2000/oid4vci/726222ad-7624-4f12-b15b-e08aa7042ffa',
      enabled: true,
      getResourceServerInfo: () => {
        return {
          scope: 'openid4vc:credential:OpenBadgeCredential-sdjwt',
          accessTokenTTL: 5 * 60, // 5 minutes
          accessTokenFormat: 'opaque',
          audience: 'http://localhost:2000/oid4vci/726222ad-7624-4f12-b15b-e08aa7042ffa',
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

oidc.use(bodyParser())
oidc.use(async (ctx, next) => {
  console.log('pre middleware', ctx.method, ctx.path)

  // We hack the client secret (to allow public client)
  if (ctx.path.includes('request')) {
    ctx.request.body.client_secret = 'bar'
  }

  if (ctx.path.includes('auth')) {
    const match = ctx.body?.match(/code=([^&]*)/)
    const code = match ? match[1] : null
    console.log('code', code)
  }

  if (ctx.path.includes('token')) {
    console.log('token endpoint')
    console.log(ctx.request.body)
    ctx.request.body.client_id = 'foo'
    ctx.request.body.client_secret = 'bar'
  }

  await next()

  /** post-processing
   * since internal route matching was already executed you may target a specific action here
   * checking `ctx.oidc.route`, the unique route names used are
   */

  console.log('post middleware', ctx.method, ctx.oidc?.route)
  if (ctx.path.includes('token')) {
    console.log('token endpoint', ctx.response.body)
  }
})

oidc.listen(3042, () => {
  console.log('oidc-provider listening on port 3042, check http://localhost:3042/.well-known/openid-configuration')
})
