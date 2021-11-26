import { DidKey } from '../DidKey'

describe('DidKey', () => {
  it('should', async () => {
    console.log('ed25519')
    DidKey.fromDid('did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL')
    console.log('g1g2')
    DidKey.fromDid(
      'did:key:z5TcESXuYUE9aZWYwSdrUEGK1HNQFHyTt4aVpaCTVZcDXQmUheFwfNZmRksaAbBneNm5KyE52SdJeRCN1g6PJmF31GsHWwFiqUDujvasK3wTiDr3vvkYwEJHt7H5RGEKYEp1ErtQtcEBgsgY2DA9JZkHj1J9HZ8MRDTguAhoFtR4aTBQhgnkP4SwVbxDYMEZoF2TMYn3s'
    )
    console.log('g1')
    DidKey.fromDid('did:key:z3tEFALUKUzzCAvytMHX8X4SnsNsq6T5tC5Zb18oQEt1FqNcJXqJ3AA9umgzA9yoqPBeWA')
    console.log('g2')

    DidKey.fromDid(
      'did:key:zUC71nmwvy83x1UzNKbZbS7N9QZx8rqpQx3Ee3jGfKiEkZngTKzsRoqobX6wZdZF5F93pSGYYco3gpK9tc53ruWUo2tkBB9bxPCFBUjq2th8FbtT4xih6y6Q1K9EL4Th86NiCGT'
    )

    console.log('x25519')
    DidKey.fromDid('did:key:z6LShLeXRTzevtwcfehaGEzCMyL3bNsAeKCwcqwJxyCo63yE')
  })
})
