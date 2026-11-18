import { CredoError } from '../error'
import { CacheModule, type CacheModuleOptions, SingleContextStorageLruCache } from '../modules/cache'
import { DcqlModule } from '../modules/dcql/DcqlModule'
import { DidsModule } from '../modules/dids'
import type { DidsModuleConfigOptions } from '../modules/dids/DidsModuleConfig'
import { DifPresentationExchangeModule } from '../modules/dif-presentation-exchange'
import { GenericRecordsModule } from '../modules/generic-records'
import { KeyManagementModule } from '../modules/kms'
import type { KeyManagementModuleConfigOptions } from '../modules/kms/KeyManagementModuleConfig'
import { MdocModule } from '../modules/mdoc/MdocModule'
import { SdJwtVcModule } from '../modules/sd-jwt-vc'
import type { SdJwtVcModuleConfigOptions } from '../modules/sd-jwt-vc/SdJwtVcModuleConfig'
import { TokenStatusListModule } from '../modules/token-status-list/TokenStatusListModule'
import type { TokenStatusListModuleConfigOptions } from '../modules/token-status-list/TokenStatusListModuleConfig'
import { JsonLdModule, W3cCredentialsModule, W3cV2CredentialsModule } from '../modules/vc'
import type { JsonLdModuleConfigOptions } from '../modules/vc/jsonld/JsonLdModuleConfig'
import type { W3cV2CredentialsModuleConfigOptions } from '../modules/vc/W3cV2CredentialsModuleConfig'
import { W3cDataIntegrityModule } from '../modules/w3c-di'
import { X509Module } from '../modules/x509'
import type { X509ModuleConfigOptions } from '../modules/x509/X509ModuleConfig'
import type { ApiModule, DependencyManager, Module } from '../plugins'
import type { IsAny } from '../types'
import type { Constructor } from '../utils/mixins'

/**
 * Simple utility type that represent a map of modules. This is used to map from moduleKey (api key) to the api in the framework.
 */
export type ModulesMap = { [key: string]: Module }

// biome-ignore lint/complexity/noBannedTypes: no explanation
export type EmptyModuleMap = {}

type DefaultAgentModuleFactories = ReturnType<typeof getDefaultAgentModules>

/**
 * Type that represents the default agent modules. This is the {@link ModulesMap} variant for the default modules in the framework.
 * It uses the return type of the {@link getDefaultAgentModules} method to automatically infer which modules are always available on
 * the agent and in the agent. namespace.
 */
export type DefaultAgentModules = {
  [moduleKey in keyof DefaultAgentModuleFactories]: ReturnType<DefaultAgentModuleFactories[moduleKey]>
}

/**
 * The config options of the default modules that can be configured, keyed by module key.
 */
type DefaultAgentModuleOptions = {
  [moduleKey in keyof DefaultAgentModuleFactories as Parameters<DefaultAgentModuleFactories[moduleKey]> extends []
    ? never
    : moduleKey]: NonNullable<Parameters<DefaultAgentModuleFactories[moduleKey]>[0]>
}

/**
 * Modules provided in the agent constructor. A default module can be provided as module instance or as its config
 * options, but not as a different module.
 */
export type AgentModulesInput = {
  [moduleKey in keyof DefaultAgentModules]?: moduleKey extends keyof DefaultAgentModuleOptions
    ? DefaultAgentModules[moduleKey] | DefaultAgentModuleOptions[moduleKey]
    : DefaultAgentModules[moduleKey]
} & { [key: string]: Module | DefaultAgentModuleOptions[keyof DefaultAgentModuleOptions] | undefined }

/**
 * Requires modules that are not a default module to be a module instance, as config options are only accepted for
 * default modules.
 */
export type ValidateAgentModules<Modules> = {
  [moduleKey in keyof Modules]: moduleKey extends keyof DefaultAgentModules ? unknown : Module
}

export type WithoutDefaultModules<Modules extends AgentModulesInput> = {
  [moduleKey in Exclude<keyof Modules, keyof DefaultAgentModules>]: Extract<Modules[moduleKey], Module>
}

export type ModuleApiInstance<M extends Module> =
  M['api'] extends Constructor<unknown> ? InstanceType<M['api']> : undefined

/**
 * Type that represents the api object of the agent (`agent.xxx`). It will extract all keys of the modules and map this to the
 * registered {@link Module.api} class instance. If the module does not have an api class registered, the property will be removed
 * and won't be available on the api object.
 *
 * @example
 * If the following AgentModules type was passed:
 * ```ts
 * {
 *   connections: DidCommConnectionsModule
 *   indy: IndyModule
 * }
 * ```
 *
 * And we use the `AgentApi` type like this:
 * ```ts
 * type MyAgentApi = AgentApi<{
 *   connections: DidCommConnectionsModule
 *   indy: IndyModule
 * }>
 * ```
 *
 * the resulting agent api will look like:
 *
 * ```ts
 * {
 *   connections: ConnectionsApi
 * }
 * ```
 *
 * The `indy` module has been ignored because it doesn't define an api class.
 */
export type AgentApi<Modules extends ModulesMap> = {
  [moduleKey in keyof Modules as Modules[moduleKey]['api'] extends Constructor<unknown>
    ? moduleKey
    : never]: ModuleApiInstance<Modules[moduleKey]>
}

/**
 * Returns the `api` type from the CustomModuleType if the module is an ApiModule. If the module is not defined
 * which is the case if you don't configure a default agent module (e.g. credentials module), it will use the default
 * module type and use that for the typing. This will contain the default typing, and thus provide the correct agent api
 * interface
 */
export type CustomOrDefaultApi<CustomModuleType, DefaultModuleType extends ApiModule> =
  IsAny<CustomModuleType> extends true
    ? InstanceType<DefaultModuleType['api']>
    : CustomModuleType extends ApiModule
      ? InstanceType<CustomModuleType['api']>
      : CustomModuleType extends Module
        ? never
        : InstanceType<DefaultModuleType['api']>

/**
 * Method to get the default agent modules to be registered on any agent instance. The config options of a module
 * are taken from the options provided for its key in the agent constructor.
 */
function getDefaultAgentModules() {
  return {
    dcql: () => new DcqlModule(),
    genericRecords: () => new GenericRecordsModule(),
    dids: (options?: DidsModuleConfigOptions) => new DidsModule(options),
    jsonLd: (options?: JsonLdModuleConfigOptions) => new JsonLdModule(options),
    w3cCredentials: () => new W3cCredentialsModule(),
    w3cV2Credentials: (options?: W3cV2CredentialsModuleConfigOptions) => new W3cV2CredentialsModule(options),
    w3cDataIntegrity: () => new W3cDataIntegrityModule(),
    cache: (options: CacheModuleOptions = { cache: new SingleContextStorageLruCache({ limit: 500 }) }) =>
      new CacheModule(options),
    pex: () => new DifPresentationExchangeModule(),
    sdJwtVc: (options?: SdJwtVcModuleConfigOptions) => new SdJwtVcModule(options),
    x509: (options?: X509ModuleConfigOptions) => new X509Module(options),
    mdoc: () => new MdocModule(),
    kms: (options: KeyManagementModuleConfigOptions = {}) => new KeyManagementModule(options),
    tokenStatusList: (options?: TokenStatusListModuleConfigOptions) => new TokenStatusListModule(options),
  } as const
}

function isModule(value: unknown): value is Module {
  return typeof value === 'object' && value !== null && typeof (value as Module).register === 'function'
}

/**
 * Extend the provided modules object with the default agent modules. A default module provided as module instance is used as is,
 * and one provided as config options (or not provided) is created with those options. The agent constructor type ensures you can't
 * provide a different module for a key that registered on the default agent.
 */
export function extendModulesWithDefaultModules(modules: AgentModulesInput = {}): ModulesMap {
  // biome-ignore lint/suspicious/noExplicitAny: the options are checked by the AgentModulesInput type
  const defaultAgentModules: Record<string, (options?: any) => Module> = getDefaultAgentModules()
  const defaultAgentModuleKeys = Object.keys(defaultAgentModules)

  const defaultModules: Array<[string, Module]> = []
  const customModules: Array<[string, Module]> = []

  for (const [moduleKey, getConfiguredModule] of Object.entries(defaultAgentModules)) {
    const moduleOrOptions = modules[moduleKey]
    defaultModules.push([moduleKey, isModule(moduleOrOptions) ? moduleOrOptions : getConfiguredModule(moduleOrOptions)])
  }

  for (const [moduleKey, module] of Object.entries(modules)) {
    if (defaultAgentModuleKeys.includes(moduleKey)) continue
    if (!isModule(module)) {
      throw new CredoError(
        `Module '${moduleKey}' must be a module instance, config options are only supported for default modules.`
      )
    }
    customModules.push([moduleKey, module])
  }

  return Object.fromEntries([...defaultModules, ...customModules])
}

/**
 * Get the agent api object based on the modules registered in the dependency manager. For each registered module on the
 * dependency manager, the method will extract the api class from the module, resolve it and assign it to the module key
 * as provided in the agent constructor (or the {@link getDefaultAgentModules} method).
 *
 * Modules that don't have an api class defined ({@link Module.api} is undefined) will be ignored and won't be added to the
 * api object.
 *
 * If the api of a module is passed in the `excluded` array, the api will not be added to the resulting api object.
 *
 * @example
 * If the dependency manager has the following modules configured:
 * ```ts
 * {
 *   connections: DidCommConnectionsModule
 *   indy: IndyModule
 * }
 * ```
 *
 * And we call the `getAgentApi` method like this:
 * ```ts
 * const api = getAgentApi(dependencyManager)
 * ```
 *
 * the resulting agent api will look like:
 *
 * ```ts
 * {
 *   connections: ConnectionsApi
 * }
 * ```
 *
 * The `indy` module has been ignored because it doesn't define an api class.
 */
export function getAgentApi<AgentModules extends ModulesMap>(
  dependencyManager: DependencyManager,
  excludedApis: unknown[] = []
): AgentApi<AgentModules> {
  // Create the api object based on the `api` properties on the modules. If no `api` exists
  // on the module it will be ignored.
  const api = Object.entries(dependencyManager.registeredModules).reduce((api, [moduleKey, module]) => {
    // Module has no api
    if (!module.api) return api

    const apiInstance = dependencyManager.resolve(module.api)

    // Api is excluded
    if (excludedApis.includes(apiInstance)) return api
    // biome-ignore lint/performance/noAccumulatingSpread: no explanation
    return { ...api, [moduleKey]: apiInstance }
  }, {}) as AgentApi<AgentModules>

  return api
}
