export interface GetRequestedCredentialsConfig {
  /**
   * Whether to filter the retrieved credentials using the presentation preview.
   * This configuration will only have effect if a presentation proposal message is available
   * containing a presentation preview.
   *
   * @default false
   */
  filterByPresentationPreview?: boolean

  /**
   * Whether to filter the retrieved credentials using the non-revocation request in the proof request.
   * This configuration will only have effect if the proof request requires proof on non-revocation of any kind.
   * Default to true
   *
   * @default true
   */
  filterByNonRevocationRequirements?: boolean
}
