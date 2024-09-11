import { bodyParser } from '@koa/bodyparser'
import Provider from 'oidc-provider'

const oidc = new Provider('http://localhost:3042', {
  clients: [
    {
      client_id: 'foo',
      client_secret: 'bar',
      redirect_uris: ['http://example.com'],
      scope: 'openid',
      grant_types: ['authorization_code'],
    },
  ],
  pkce: {
    methods: ['S256'],
    required: () => {
      console.log('checking pkce')
      return true
    },
  },
  features: {
    dPoP: { enabled: false },
    pushedAuthorizationRequests: {
      enabled: true,
      //requirePushedAuthorizationRequests: true,
    },
  },

  async findAccount(ctx, id) {
    console.log('called findAccount')
    return {
      accountId: id,
      async claims(use, scope) {
        console.log('called claims', scope)
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
    ctx.request.body.client_secret = 'bar'
  }

  if (ctx.path.includes('auth')) {
    const match = ctx.body?.match(/code=([^&]*)/)
    const code = match ? match[1] : null
    console.log('code', code)
  }

  if (ctx.path.includes('token')) {
    console.log('token endpoint')
    ctx.request.body.client_secret = 'bar'
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
