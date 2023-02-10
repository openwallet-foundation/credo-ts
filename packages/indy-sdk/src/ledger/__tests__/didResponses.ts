import type { IndySdkPoolConfig } from '../IndySdkPool'
import type * as Indy from 'indy-sdk'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line import/no-extraneous-dependencies
import IndyError from 'indy-sdk/src/IndyError'

export function getDidResponse({ did, verkey }: { did: string; verkey: string }) {
  const response: Indy.LedgerReadReplyResponse = {
    op: 'REPLY',
    result: {
      txnTime: 1632680963,
      reqId: 1632681194706196000,
      state_proof: {
        multi_signature: {
          participants: ['Node3', 'Node4', 'Node2'],
          value: {
            state_root_hash: 'AqMNuzJHeHduhggd8URobGyc1W89oGEjmohRXkB66JZo',
            ledger_id: 1,
            pool_state_root_hash: 'NCGqbfRWDWtLB2bDuL6TC5BhrRdQMc5MyKdXQqXii44',
            timestamp: 1632680963,
            txn_root_hash: 'AxqfyyDFuY74kiXcfvkYCWCVrHsrQutKaoi3ao4Vp8K7',
          },
          signature:
            'QwkoPr9pwXyBdtMMUtJ841QjX3pTEQP6bumBpHCWiBCn4AduEW55SQXHjfQZd7EXEjArMfjNyDjgC3Qsvh51WAFGK74C3Tq7k5zYbm7kbVZdUse2i27XiDkMuB6sriroi7XHfnV3Bo55ig3APAFXD7mQrKTGE2ov17CF6yn1ns81vf',
        },
        proof_nodes:
          '+QHS+JygNttWkmVHYjZyCCk0TNJr5l7AJOnuLNU99qWyNhfBuWq4efh3uHV7ImlkZW50aWZpZXIiOiJWNFNHUlU4Nlo1OGQ2VFY3UEJVZTZmIiwicm9sZSI6IjAiLCJzZXFObyI6MTEsInR4blRpbWUiOjE2MzI2ODA5NjMsInZlcmtleSI6In40M1g0TmhBRnFSRWZmSzdlV2RLZ0ZIIn35ATGg09I/bgmxWmztC58rrZwebgwutUGli7VUyVOFwmuLFqOAoNrtARUl8FhzgOfGsZGlm8IVqgH1wB5KaoajR9sA53e2oJqauj70Qf++s0g43b1zvnQEyQJh2lfNqxFRtmaADvkwgKACG8f0w2NsuDibWYibc1TYySAgUKSeIevHF6wVZdMBL6BEAIIJs0un9jVqVEABbCWTkc0rybTVrFgaKU6LD6ciGYCAgICgJHIm3oUOYlDrQlw95UDkRdOc2tGIsE9g2r12AjpJiUKAoH0lXE47VtUlFvwnCC5rgY878m6TpeEZTJIKd4SUxXtqoBvSoTludXD0XkhTPm4YxfCcAdCaiDvkzM8w6O4v5/e1oDs6GXxRL8inD2b3RY1v/ufksDHNqfFKaK2MEIjNIZwagA==',
        root_hash: 'AqMNuzJHeHduhggd8URobGyc1W89oGEjmohRXkB66JZo',
      },
      seqNo: 11,
      identifier: 'LibindyDid111111111111',
      dest: did,
      data: `{"dest":"${did}","identifier":"V4SGRU86Z58d6TV7PBUe6f","role":"0","seqNo":11,"txnTime":1632680963,"verkey":"${verkey}"}`,
      type: '105',
    },
  }

  return response
}

export function getDidResponsesForDid(
  did: string,
  pools: IndySdkPoolConfig[],
  responses: { [key: string]: string | undefined }
) {
  return pools.map((pool) => {
    const verkey = responses[pool.indyNamespace]

    if (verkey) {
      return () => Promise.resolve(getDidResponse({ did, verkey }))
    }

    // LedgerNotFound
    return () => Promise.reject(new IndyError(309))
  })
}
