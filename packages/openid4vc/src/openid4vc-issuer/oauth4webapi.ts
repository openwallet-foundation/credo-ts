export type * as oauth from 'oauth4webapi'

export async function importOauth4webapi() {
  try {
    // NOTE: 'oauth4webapi' is required in when using OpenID4VC Issuer module.
    // eslint-disable-next-line import/no-extraneous-dependencies, @typescript-eslint/no-var-requires
    const oauth4webapi = await import('oauth4webapi')
    return oauth4webapi.default
  } catch (error) {
    throw new Error(`Could not import oauth4webapi. ${error.message}`)
  }
}
