import type { DependencyManager } from '@credo-ts/core'

export async function resolveDidCommCredentialExchangeRepository(dependencyManager: DependencyManager) {
  const didCommModule = await loadDidCommModule()
  if (!didCommModule) {
    return { repository: undefined, unavailableReason: '@credo-ts/didcomm is not installed' } as const
  }

  const { DidCommCredentialExchangeRepository } = didCommModule
  if (!dependencyManager.isRegistered(DidCommCredentialExchangeRepository, true)) {
    return { repository: undefined, unavailableReason: 'the DIDComm credentials module is not registered' } as const
  }

  return {
    repository: dependencyManager.resolve(DidCommCredentialExchangeRepository),
    unavailableReason: undefined,
  } as const
}

async function loadDidCommModule() {
  try {
    return await import('@credo-ts/didcomm')
  } catch (error) {
    if (isMissingDidCommPackage(error)) return undefined
    throw error
  }
}

function isMissingDidCommPackage(error: unknown): boolean {
  const seen = new Set<object>()
  let current = error

  while (typeof current === 'object' && current !== null && !seen.has(current)) {
    seen.add(current)
    if ('code' in current && 'message' in current) {
      const { code, message } = current
      if (
        (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') &&
        typeof message === 'string' &&
        (message.includes(`Cannot find package '@credo-ts/didcomm'`) ||
          message.includes(`Cannot find module '@credo-ts/didcomm'`))
      ) {
        return true
      }
    }

    current = 'cause' in current ? current.cause : undefined
  }

  return false
}
