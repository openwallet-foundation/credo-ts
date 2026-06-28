/**
 * Thin client for the OpenID Foundation conformance suite HTTP API.
 *
 * The suite is driven entirely over its REST API (create plan, start module,
 * poll state, export logs) rather than via browser UI automation. All requests
 * go through the suite's nginx TLS frontend, so we pin the suite's self-signed
 * CA (extracted in `oidf-setup.ts`) on the undici dispatcher instead of
 * disabling TLS verification.
 *
 * Adapted from the OpenWallet Foundation EUDIPLO conformance client:
 * https://github.com/openwallet-foundation/eudiplo/tree/main/apps/backend/test/oidf
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { Agent } from 'undici'

import { OIDF_HTTPD_CA_PATH } from './oidf-setup'

export interface TestInstance {
  id: string
  url: string
}

interface TestResult {
  status: string
  result: string
}

export interface OIDFPlanModule {
  testModule: string
  variant: Record<string, string>
}

/**
 * Returns a positive integer env override, or undefined when unset/invalid.
 */
function getPositiveNumberEnv(name: string): number | undefined {
  const raw = process.env[name]
  if (!raw) return undefined
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined
  return Math.floor(parsed)
}

function toJson(value: unknown, maxLength = 2000): string {
  if (value === undefined) return 'undefined'
  try {
    const serialized = JSON.stringify(value, null, 2)
    return serialized.length > maxLength ? `${serialized.slice(0, maxLength)}... [truncated]` : serialized
  } catch {
    return String(value)
  }
}

export class OIDFSuite {
  private readonly baseUrl: string
  private readonly token?: string
  /**
   * Lazily-created undici dispatcher that trusts the conformance httpd CA. The
   * CA is extracted by `setupOidfContainers()` (in `beforeAll`), so it is not on
   * disk when this class is constructed at module load time — hence the lazy
   * read. The suite cert CN is `localhost` with no SAN, so we keep chain
   * validation on but skip the hostname check.
   */
  private dispatcherInstance?: Agent

  public constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.token = token
  }

  private get dispatcher(): Agent {
    if (!this.dispatcherInstance) {
      this.dispatcherInstance = new Agent({
        connect: {
          ca: readFileSync(OIDF_HTTPD_CA_PATH),
          // CN is `localhost`, no SAN — keep chain validation, skip hostname check.
          checkServerIdentity: () => undefined,
        },
      })
    }
    return this.dispatcherInstance
  }

  private async request<T = unknown>(
    path: string,
    init: RequestInit & { params?: Record<string, string | undefined> } = {}
  ): Promise<T> {
    const { params, ...requestInit } = init
    const url = new URL(`${this.baseUrl}${path}`)
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined) url.searchParams.set(key, value)
    }

    const headers = new Headers(requestInit.headers)
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`)
    if (requestInit.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

    const response = await fetch(url, {
      ...requestInit,
      headers,
      dispatcher: this.dispatcher,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`OIDF request ${init.method ?? 'GET'} ${path} failed (${response.status}): ${text}`)
    }

    const contentType = response.headers.get('content-type') ?? ''
    return (contentType.includes('application/json') ? await response.json() : await response.text()) as T
  }

  /**
   * Creates a test plan and returns its id. `variant` constrains the matrix of
   * modules the plan exposes; `config` is the suite test configuration.
   */
  public async createPlan(planName: string, variant: object, config: unknown): Promise<string> {
    const data = await this.request<{ id: string }>('/api/plan', {
      method: 'POST',
      params: { planName, variant: JSON.stringify(variant) },
      body: JSON.stringify(config),
    })
    return data.id
  }

  public async getPlan(planId: string): Promise<{ modules: OIDFPlanModule[] }> {
    return this.request(`/api/plan/${planId}`)
  }

  /**
   * Returns the module names exposed by a plan.
   */
  public async getPlanModuleNames(planId: string): Promise<string[]> {
    const plan = await this.getPlan(planId)
    return (plan.modules ?? []).map((module) => module.testModule)
  }

  /**
   * Starts a runner for a single module using the module's plan-level variant.
   */
  public async startTest(planId: string, testModule: string): Promise<TestInstance> {
    const plan = await this.getPlan(planId)
    const module = plan.modules.find((m) => m.testModule === testModule)
    const variant = module?.variant ?? {}

    return this.request<TestInstance>('/api/runner', {
      method: 'POST',
      params: { test: testModule, plan: planId, variant: JSON.stringify(variant) },
      headers: { Accept: 'application/json' },
    })
  }

  /**
   * Returns the current runner status/result.
   */
  public async getInfo(testInstanceId: string): Promise<TestResult> {
    return this.request<TestResult>(`/api/info/${testInstanceId}`)
  }

  /**
   * Polls until the runner reaches `WAITING`, the state in which it is ready to
   * be driven (i.e. handed an authorization request).
   */
  public async waitForWaiting(testInstanceId: string, maxAttempts = 100): Promise<void> {
    let state = ''
    let attempts = 0
    while (state !== 'WAITING' && attempts < maxAttempts) {
      const info = await this.getInfo(testInstanceId)
      state = info.status
      if (state !== 'WAITING') {
        await new Promise((r) => setTimeout(r, 300))
        attempts++
      }
    }
    if (state !== 'WAITING') {
      throw new Error(`Runner ${testInstanceId} did not reach WAITING after ${maxAttempts} attempts`)
    }
  }

  /**
   * Polls a runner until it reaches a terminal state (`FINISHED`/`INTERRUPTED`),
   * bailing out early when status stops changing so a hung module fails fast
   * instead of waiting out the full `maxAttempts`. Thresholds are overridable
   * via the `OIDF_WAIT_*` env vars (see README.md for calibration).
   */
  public async waitForFinished(
    testInstanceId: string,
    options: { maxAttempts?: number; noProgressAttempts?: number } = {}
  ): Promise<TestResult> {
    const TERMINAL_STATUSES = new Set(['FINISHED', 'INTERRUPTED'])

    const maxAttempts = options.maxAttempts ?? getPositiveNumberEnv('OIDF_WAIT_MAX_ATTEMPTS') ?? 240
    const noProgressAttempts =
      options.noProgressAttempts ?? getPositiveNumberEnv('OIDF_WAIT_NO_PROGRESS_ATTEMPTS') ?? 120
    const waitingNoProgressAttempts =
      getPositiveNumberEnv('OIDF_WAIT_NO_PROGRESS_ATTEMPTS_WAITING') ?? Math.min(noProgressAttempts, 40)
    const pollIntervalMs = getPositiveNumberEnv('OIDF_WAIT_POLL_INTERVAL_MS') ?? 300

    let attempts = 0
    let lastStatus: string | undefined
    let attemptsSinceStatusChange = 0
    let lastResult: TestResult | undefined
    const startedAt = Date.now()

    while (attempts < maxAttempts) {
      lastResult = await this.getInfo(testInstanceId)

      if (lastResult.status === lastStatus) {
        attemptsSinceStatusChange++
      } else {
        lastStatus = lastResult.status
        attemptsSinceStatusChange = 0
      }

      if (TERMINAL_STATUSES.has(lastResult.status)) return lastResult

      const noProgressLimit = lastResult.status === 'WAITING' ? waitingNoProgressAttempts : noProgressAttempts
      if (attemptsSinceStatusChange >= noProgressLimit) {
        throw new Error(
          [
            `Module made no progress for ${noProgressLimit} attempts (status="${lastStatus}", ${Date.now() - startedAt}ms).`,
            `testInstance.id=${testInstanceId}`,
            `Log detail: ${this.baseUrl}/log-detail.html?log=${testInstanceId}`,
            `Last /api/info payload: ${toJson(lastResult)}`,
          ].join('\n')
        )
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs))
      attempts++
    }

    throw new Error(
      [
        `Module did not finish after ${maxAttempts} attempts (${Date.now() - startedAt}ms).`,
        `testInstance.id=${testInstanceId}`,
        `Log detail: ${this.baseUrl}/log-detail.html?log=${testInstanceId}`,
        `Last /api/info payload: ${toJson(lastResult)}`,
      ].join('\n')
    )
  }

  /**
   * Exports a single module's human-readable HTML log to `outputDir` and returns
   * the written path. Used to surface failure artifacts in CI.
   */
  public async storeTestLog(testInstanceId: string, outputDir: string): Promise<string> {
    const html = await this.request<string>('/log-detail.html', {
      params: { log: testInstanceId },
    })
    mkdirSync(outputDir, { recursive: true })
    const outputPath = `${outputDir}/test-log-${testInstanceId}.html`
    writeFileSync(outputPath, html, 'utf-8')
    return outputPath
  }

  /**
   * Exports the full plan log archive (zip) to `outputPath`. We store the raw
   * archive rather than unpacking it to avoid an extra dependency.
   */
  public async storePlanLog(planId: string, outputPath: string): Promise<void> {
    const url = new URL(`${this.baseUrl}/api/plan/exporthtml/${planId}`)
    url.searchParams.set('public', 'false')
    const headers = new Headers()
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`)

    const response = await fetch(url, {
      headers,
      dispatcher: this.dispatcher,
    })
    if (!response.ok) {
      throw new Error(`Failed to export plan log for ${planId} (${response.status})`)
    }

    const bytes = new Uint8Array(await response.arrayBuffer())
    mkdirSync(outputPath.replace(/\/[^/]*$/, ''), { recursive: true })
    writeFileSync(outputPath, bytes)
  }

  public logDetailUrl(testInstanceId: string): string {
    return `${this.baseUrl}/log-detail.html?log=${testInstanceId}`
  }

  public planDetailUrl(planId: string): string {
    return `${this.baseUrl}/plan-detail.html?plan=${planId}`
  }
}
