import { bodyParser } from '@koa/bodyparser'
import Provider from 'oidc-provider'

const oidc = new Provider('http://localhost:3042', {
  clients: [
    {
      client_id: 'foo',
      // client_secret: 'bar',
      redirect_uris: ['http://localhost:1234/redirect'],
      grant_types: ['authorization_code'],
    },
    {
      client_id: 'issuer-server',
      client_secret: 'issuer-server',
    },
  ],
  // scopes: ['UniversityDegreeCredential'],
  pkce: {
    methods: ['S256'],
    required: () => {
      console.log('checking pkce')
      return true
    },
  },
  extraTokenClaims: async (context, token) => {
    if (token.kind === 'AccessToken') {
      console.log(context.body)
      return {
        issuer_state: (context.body as Record<string, unknown>).issuer_state,
      }
    }
    return undefined
  },
  features: {
    dPoP: { enabled: false },
    pushedAuthorizationRequests: {
      enabled: true,
      //requirePushedAuthorizationRequests: true,
    },
    resourceIndicators: {
      defaultResource: () => 'http://localhost:1234',
      enabled: true,
      getResourceServerInfo: (ctx, resourceIndicator, client) => {
        return {
          scope: 'UniversityDegreeCredential',
          accessTokenTTL: 5 * 60, // 5 minutes
          accessTokenFormat: 'jwt',
        }
      },
      useGrantedResource: (ctx, model) => {
        // @param ctx - koa request context
        // @param model - depending on the request's grant_type this can be either an AuthorizationCode, BackchannelAuthenticationRequest,
        //                RefreshToken, or DeviceCode model instance.
        return true
      },
    },
  },

  async findAccount(ctx, id) {
    return {
      accountId: id,
      async claims(use, scope) {
        return { sub: id }
      },
    }
  },
})

oidc.use(bodyParser())
oidc.use(async (ctx, next) => {
  /** pre-processing
   * you may target a specific action here by matching `ctx.path`
   */

  console.log('pre middleware', ctx.method, ctx.path)

  if (ctx.path.includes('request')) {
    console.log(ctx.request.body)
    // ctx.request.body.client_secret = 'bar'
  }

  if (ctx.path.includes('auth')) {
    const match = ctx.body?.match(/code=([^&]*)/)
    const code = match ? match[1] : null
    console.log('code', code)
  }

  if (ctx.path.includes('token')) {
    console.log('token endpoint')
    // ctx.request.body.client_secret = 'bar'
  }

  await next()

  /** post-processing
   * since internal route matching was already executed you may target a specific action here
   * checking `ctx.oidc.route`, the unique route names used are
   */

  console.log('post middleware', ctx.method, ctx.oidc?.route)
  if (ctx.path.includes('token')) {
    console.log('token endpoint')
    ctx.response.body
  }
})

oidc.listen(3042, () => {
  console.log('oidc-provider listening on port 3042, check http://localhost:3042/.well-known/openid-configuration')
})
