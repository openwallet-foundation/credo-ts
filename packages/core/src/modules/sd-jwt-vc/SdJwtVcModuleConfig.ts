import type { SdJwtVcTypeMetadata } from './typeMetadata'

export type CustomTypeMetadataResolverOptions = {
  /**
   * Whether the vct value is a vct from an `extends` field.
   */
  isExtendedVct: boolean

  /**
   * Configuration option provided to the resolve method. The custom resolver
   * is expected to adhere to this, and return undefined if set to `false` and
   * a fetch error occurs. This value is also provided to the `defaultResolver`.
   *
   * If you want to override the default behavior, the custom resolver can ignore
   * this value
   */
  throwErrorOnFetchError?: boolean

  /**
   * Configuration option provided to the resolve method. The custom resolver
   * is expected to adhere to this, and return undefined if set to `false` and
   * an unsupported vct value is provided. This value is also provided to the
   * `defaultResolver`.
   *
   * If you want to override the default behavior, the custom resolver can ignore
   * this value
   */
  throwErrorOnUnsupportedVctValue?: boolean

  /**
   * The default resolver for Type Metadata. This will only return a value
   * if the `vct` is an HTTPS URL.
   *
   * You can use this in your custom resolver, to avoid re-implementing
   * the default HTTPS resolving of Type Metadata.
   *
   * NOTE: the default resolver only fetches the document and extracts
   * the JSON payload. Validation only happens AFTER returning the document
   * from the custom resolver.
   */
  defaultResolver: (
    options: Pick<CustomTypeMetadataResolverOptions, 'throwErrorOnFetchError' | 'throwErrorOnUnsupportedVctValue'>
  ) => Promise<Record<string, unknown> | undefined>
}

/**
 * Custom vct resolver for SD-JWT Type Metadata.
 *
 * The returned value is validated after the it is returned. For this reason the type
 * is Record<string, unknown>. If an invalid document is returned this will cause the
 * resolving to fail.
 *
 * An integrity field (`vct#integrity` or `extends#integrity`) field is optionally provided.
 * If provided, you MUST verify the integrity based on the resolved document in the custom
 * resolver implementation due to the integrity requiring against the raw structure, as parsing
 * to JSON might change the structure of the document, resulting in an invalid hash. When using
 * the `defaultResolver` callback this is handled for HTTPS documents by default. For custom
 * resolve documents you can use the `IntegrityVerifier` class exported from `@credo-ts/core`.
 *
 * The `isExtendedVct` indicates whether the vct value is extracted from the `extends` field
 * of an extending Type Metadata object.
 *
 * The resolver can return undefined to indicate there's no Type Metadata. If the resolving should
 * fail due to the VCT url not being resolvable, you can also throw an error.
 *
 * When `isExtendedVct` is true, the method MUST always return a Type Metadata object, as the
 * VCT is then referenced by another Type Metadata document and is thus intended to be resolved.
 */
export type CustomTypeMetadataResolver = (
  vct: string,
  integrity: string | undefined,
  options: CustomTypeMetadataResolverOptions
) => Promise<SdJwtVcTypeMetadata | Record<string, unknown> | undefined>

export type CustomStatusListFetcherOptions = {
  /**
   * The default fetcher: an HTTP GET of the uri with the `Accept` header
   * `application/statuslist+jwt`, through the `fetch` of the agent dependencies.
   */
  defaultFetcher: () => Promise<string>
}

/**
 * Custom fetcher for the status list JWT that the `status.status_list.uri` claim of an
 * SD-JWT VC references. Use it to apply a network policy to the fetch, or to serve the
 * status list JWT from a cache. The status list JWT is verified AFTER it is returned.
 */
export type CustomStatusListFetcher = (uri: string, options: CustomStatusListFetcherOptions) => Promise<string>

export interface SdJwtVcModuleConfigOptions {
  /**
   * @see {@link CustomTypeMetadataResolver}
   */
  customTypeMetadataResolver?: CustomTypeMetadataResolver

  /**
   * @see {@link CustomStatusListFetcher}
   */
  customStatusListFetcher?: CustomStatusListFetcher
}

/**
 * @public
 */
export class SdJwtVcModuleConfig {
  private options: SdJwtVcModuleConfigOptions

  public constructor(options?: SdJwtVcModuleConfigOptions) {
    this.options = options ?? {}
  }

  public get customTypeMetadataResolver() {
    return this.options.customTypeMetadataResolver
  }

  public get customStatusListFetcher() {
    return this.options.customStatusListFetcher
  }
}
