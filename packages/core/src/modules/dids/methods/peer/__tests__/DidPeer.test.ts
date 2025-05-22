import { PeerDidNumAlgo, getNumAlgoFromPeerDid, isValidPeerDid } from '../didPeer'

describe('didPeer', () => {
  test('isValidPeerDid', () => {
    expect(isValidPeerDid('did:peer:0z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL')).toBe(true)
    expect(isValidPeerDid('did:peer:1zQmZMygzYqNwU6Uhmewx5Xepf2VLp5S4HLSwwgf2aiKZuwa')).toBe(true)
    expect(
      isValidPeerDid(
        'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc.Vz6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V.Vz6MkgoLTnTypo3tDRwCkZXSccTPHRLhF4ZnjhueYAFpEX6vg.SeyJ0IjoiZG0iLCJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9lbmRwb2ludCIsInIiOlsiZGlkOmV4YW1wbGU6c29tZW1lZGlhdG9yI3NvbWVrZXkiXSwiYSI6WyJkaWRjb21tL3YyIiwiZGlkY29tbS9haXAyO2Vudj1yZmM1ODciXX0'
      )
    ).toBe(true)
    expect(
      isValidPeerDid(
        'did:peer:4zQmUgFc9wpM9XnHRwUMoe7Q2JNR3ohxGi3X7kZSULHUoshW:zqnSoyMuJhPmvnGSRJyrk4V9ENoEdPsCM5bEUsbjb4eT1GHC57x9bT3AqddWsUdCYvtzfkBBhoPrX9gX5ekVX7BNb4ekzP2qTSATWsJdfFSpTtHXzNaK4RUifSvmpjqueV9cqGgdJQtQwy8Nx2UWpLdFPeuDWxWVzkP28tPhDqAnU6b4bht8qRtNMyyf3mSij2Cq3ccJe6HnruCFCEbapB2wUmbBzJBEMyzEFJmM1ghXm21qWjyb5Bq819xXSmAHo2hY8E5e6V2etNSfpi37fVa5zQmqSMPjqAqejP2RM4poF5F4J9ZqitA9LyuEUFnrYjfuYCZGUa2geZfAHAQ9MShXxPkVyMfjgGE4VjfaUjFncxXCcNhoeULJ843s65J4derLxTB9G3V9Lbk5zrjQYNbMWRHH8DtcrCL73vPPV4CmM1FsRquvS6W3j4p8rENxzLKiekrxfn6oMRH32e6AgZokPQn177G5sjaBDyoj5ZRkNdosDEWdN6F8qYp3K5a2hwBeVLLzUm3WpLjty4QAJmNcbKLVwgEhDHWqfzqmnEB1LgBwV1YXsSsbX25gmpP1tKUTYV4k5yErhAemgDRCChBiRS4tk2pDSSwFCEhDZAp75nfUYgZkXDX1pA2bqLfv'
      )
    ).toBe(true)
    expect(isValidPeerDid('did:peer:4zQmXU3HDFaMvdiuUh7eC2hUzFxZHgaKUJpiCAkSDfRE6qSn')).toBe(true)
    expect(
      isValidPeerDid(
        'did:peer:4z2gxx5mnuv7Tuc5GxjJ3BgJ69g1ucM27iVW9xYSg9tbBjjGLKsWGSpEwqQPbCdCt4qs1aoB3HSM4eoUQALBvR52hCEq2quLwo5RzuZBjZZmuNf6FXvVCrRLQdMG52QJ285W5MUd3hK9QGCUoCNAHJprhtpvcJpoohcg5otvuHeZiffYDRWrfxKUGS83X4X7Hp2vYqdFPgBQcwoveyJcyYByu7zT3Fn8faMffCE5oP125gwsHxjkquEnCy3RMbf64NVL9bLDDk391k7W4HyScbLyh7ooJcWaDDjiFMtoi1J856cDocYtxZ7rjmWmG15pgTcBLX7o8ebKhWCrFSMWtspRuKs9VFaY366Sjce5ZxTUsBWUMCpWhQZxeZQ2h42UST5XiJJ7TV1E13a3ttWrHijPcHgX1MvvDAPGKVgU2jXSgH8bCL4mKuVjdEm4Kx5wMdDW88ougUFuLfwhXkDfP7sYAfuaCFWx286kWqkfYdopcGntPjCvDu6uonghRmxeC2qNfXkYmk3ZQJXzsxgQToixevEvfxQgFY1uuNo5288zJPQcfLHtTvgxEhHxD5wwYYeGFqgV6FTg9mZVU5xqg7w6456cLuZNPuARkfpZK78xMEUHtnr95tK91UY'
      )
    ).toBe(false)

    expect(
      isValidPeerDid(
        'did:peer:5.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc.Vz6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V.Vz6MkgoLTnTypo3tDRwCkZXSccTPHRLhF4ZnjhueYAFpEX6vg.SeyJ0IjoiZG0iLCJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9lbmRwb2ludCIsInIiOlsiZGlkOmV4YW1wbGU6c29tZW1lZGlhdG9yI3NvbWVrZXkiXSwiYSI6WyJkaWRjb21tL3YyIiwiZGlkY29tbS9haXAyO2Vudj1yZmM1ODciXX0'
      )
    ).toBe(false)
  })

  describe('getNumAlgoFromPeerDid', () => {
    test('extracts the numAlgo from the peer did', async () => {
      // NumAlgo 0
      expect(getNumAlgoFromPeerDid('did:peer:0z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL')).toBe(
        PeerDidNumAlgo.InceptionKeyWithoutDoc
      )

      // NumAlgo 1
      expect(getNumAlgoFromPeerDid('did:peer:1zQmZMygzYqNwU6Uhmewx5Xepf2VLp5S4HLSwwgf2aiKZuwa')).toBe(
        PeerDidNumAlgo.GenesisDoc
      )

      // NumAlgo 2
      expect(
        getNumAlgoFromPeerDid(
          'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc.Vz6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V.Vz6MkgoLTnTypo3tDRwCkZXSccTPHRLhF4ZnjhueYAFpEX6vg.SeyJ0IjoiZG0iLCJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9lbmRwb2ludCIsInIiOlsiZGlkOmV4YW1wbGU6c29tZW1lZGlhdG9yI3NvbWVrZXkiXSwiYSI6WyJkaWRjb21tL3YyIiwiZGlkY29tbS9haXAyO2Vudj1yZmM1ODciXX0'
        )
      ).toBe(PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc)

      // NumAlgo 4
      expect(
        getNumAlgoFromPeerDid(
          'did:peer:4zQmUgFc9wpM9XnHRwUMoe7Q2JNR3ohxGi3X7kZSULHUoshW:zqnSoyMuJhPmvnGSRJyrk4V9ENoEdPsCM5bEUsbjb4eT1GHC57x9bT3AqddWsUdCYvtzfkBBhoPrX9gX5ekVX7BNb4ekzP2qTSATWsJdfFSpTtHXzNaK4RUifSvmpjqueV9cqGgdJQtQwy8Nx2UWpLdFPeuDWxWVzkP28tPhDqAnU6b4bht8qRtNMyyf3mSij2Cq3ccJe6HnruCFCEbapB2wUmbBzJBEMyzEFJmM1ghXm21qWjyb5Bq819xXSmAHo2hY8E5e6V2etNSfpi37fVa5zQmqSMPjqAqejP2RM4poF5F4J9ZqitA9LyuEUFnrYjfuYCZGUa2geZfAHAQ9MShXxPkVyMfjgGE4VjfaUjFncxXCcNhoeULJ843s65J4derLxTB9G3V9Lbk5zrjQYNbMWRHH8DtcrCL73vPPV4CmM1FsRquvS6W3j4p8rENxzLKiekrxfn6oMRH32e6AgZokPQn177G5sjaBDyoj5ZRkNdosDEWdN6F8qYp3K5a2hwBeVLLzUm3WpLjty4QAJmNcbKLVwgEhDHWqfzqmnEB1LgBwV1YXsSsbX25gmpP1tKUTYV4k5yErhAemgDRCChBiRS4tk2pDSSwFCEhDZAp75nfUYgZkXDX1pA2bqLfv'
        )
      ).toBe(PeerDidNumAlgo.ShortFormAndLongForm)
    })
  })
})
