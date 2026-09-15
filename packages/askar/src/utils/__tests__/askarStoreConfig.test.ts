import { uriFromStoreConfig } from '../askarStoreConfig'

describe('uriFromStoreConfig', () => {
  test('creates postgres uri with config, credentials and connection parameters', () => {
    const { uri, path } = uriFromStoreConfig(
      {
        id: 'my wallet',
        key: 'key',
        database: {
          type: 'postgres',
          config: {
            host: 'localhost:5432',
            connectTimeout: 10,
            maxConnections: 5,
            connectionParameters: {
              sslmode: 'verify-full',
              sslrootcert: '/etc/ssl/certs/root ca.pem',
              'statement-cache-capacity': 50,
              application_name: undefined,
            },
          },
          credentials: {
            account: 'user',
            password: 'p@ss',
            adminAccount: 'admin',
          },
        },
      },
      '/data'
    )

    expect(path).toBeUndefined()
    expect(uri).toEqual(
      'postgres://user:p%40ss@localhost:5432/my%20wallet?connect_timeout=10&admin_account=admin&sslmode=verify-full&sslrootcert=%2Fetc%2Fssl%2Fcerts%2Froot%20ca.pem&statement-cache-capacity=50&max_connections=5'
    )
  })

  test.each([
    'connect_timeout',
    'admin_account',
    'max_connections',
    'user',
    'password',
    'dbname',
    'host',
  ])('throws when connection parameters contain reserved parameter %s', (parameter) => {
    expect(() =>
      uriFromStoreConfig(
        {
          id: 'wallet',
          key: 'key',
          database: {
            type: 'postgres',
            config: { host: 'localhost:5432', connectionParameters: { [parameter]: 'value' } },
            credentials: { account: 'user', password: 'pass' },
          },
        },
        '/data'
      )
    ).toThrow(`Postgres connection parameter '${parameter}' is not allowed in 'connectionParameters'`)
  })

  test('creates postgres uri without query parameters', () => {
    const { uri } = uriFromStoreConfig(
      {
        id: 'wallet',
        key: 'key',
        database: {
          type: 'postgres',
          config: { host: 'localhost:5432' },
          credentials: { account: 'user', password: 'pass' },
        },
      },
      '/data'
    )

    expect(uri).toEqual('postgres://user:pass@localhost:5432/wallet')
  })

  test('creates sqlite uri', () => {
    expect(uriFromStoreConfig({ id: 'wallet', key: 'key' }, '/data')).toEqual({
      uri: 'sqlite:///data/wallet/wallet/sqlite.db',
      path: '/data/wallet/wallet/sqlite.db',
    })
    expect(
      uriFromStoreConfig(
        { id: 'wallet', key: 'key', database: { type: 'sqlite', config: { inMemory: true } } },
        '/data'
      ).uri
    ).toEqual('sqlite://:memory:')
  })
})
