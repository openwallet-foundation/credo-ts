import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../src/agent/Agent'
import { KeyDerivationMethod } from '../src/types'

import { getBaseConfig } from './helpers'

import { WalletDuplicateError, WalletInvalidKeyError, WalletNotFoundError } from '@aries-framework/core'

const aliceConfig = getBaseConfig('wallet-tests-Alice', {
  endpoints: ['rxjs:alice'],
})

describe('wallet', () => {
  let aliceAgent: Agent

  beforeEach(async () => {
    const aliceMessages = new Subject<SubjectMessage>()
    const bobMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:alice': aliceMessages,
      'rxjs:bob': bobMessages,
    }

    aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(aliceMessages, subjectMap))
    return aliceAgent
  })

  afterEach(async () => {
    await aliceAgent.shutdown()
    if (aliceAgent.wallet.isProvisioned) {
      await aliceAgent.wallet.delete()
    }
  })

  test('open, create and open wallet with different wallet key that it is in agent config', async () => {
    const walletConfig = {
      id: 'mywallet',
      key: 'mysecretwalletkey',
    }

    try {
      await aliceAgent.wallet.open(walletConfig)
    } catch (error) {
      if (error instanceof WalletNotFoundError) {
        await aliceAgent.wallet.create(walletConfig)
        await aliceAgent.wallet.open(walletConfig)
      }
    }

    await aliceAgent.initialize()

    expect(aliceAgent.isInitialized).toBe(true)
  })

  test('when creating already existing wallet throw WalletDuplicateError', async () => {
    const walletConfig = {
      id: 'mywallet',
      key: 'mysecretwalletkey',
    }

    await aliceAgent.wallet.create(walletConfig)

    await expect(aliceAgent.wallet.create(walletConfig)).rejects.toThrowError(WalletDuplicateError)
  })

  test('when opening non-existing wallet throw WalletNotFoundError', async () => {
    const walletConfig = {
      id: 'mywallet',
      key: 'mysecretwalletkey',
    }

    await expect(aliceAgent.wallet.open(walletConfig)).rejects.toThrowError(WalletNotFoundError)
  })

  test('when opening wallet with invalid key throw WalletInvalidKeyError', async () => {
    const walletConfig = {
      id: 'mywallet',
      key: 'mysecretwalletkey',
    }

    await aliceAgent.wallet.create(walletConfig)
    await expect(aliceAgent.wallet.open({ ...walletConfig, key: 'abcd' })).rejects.toThrowError(WalletInvalidKeyError)
  })

  test('when create wallet and shutdown, wallet is closed', async () => {
    const walletConfig = {
      id: 'mywallet',
      key: 'mysecretwalletkey',
    }

    await aliceAgent.wallet.create(walletConfig)

    await aliceAgent.shutdown()

    await expect(aliceAgent.wallet.open(walletConfig)).resolves.toBeUndefined()
  })

  test('create wallet with custom key derivation method', async () => {
    const walletConfig = {
      id: 'mywallet',
      key: 'mysecretwalletkey',
      keyDerivationMethod: KeyDerivationMethod.Argon2IInt,
    }

    await aliceAgent.wallet.create(walletConfig)
    await aliceAgent.wallet.open(walletConfig)

    expect(aliceAgent.wallet.isInitialized).toBe(true)
  })
})
