export const InjectionSymbols = {
  MessagePickupRepository: Symbol('MessagePickupRepository'), // TODO: Move to DIDComm
  StorageService: Symbol('StorageService'),
  Logger: Symbol('Logger'),
  AgentContextProvider: Symbol('AgentContextProvider'),
  AgentDependencies: Symbol('AgentDependencies'),
  OpenId4VcIssuerModuleConfig: Symbol('OpenId4VcIssuerModuleConfig'),
  Stop$: Symbol('Stop$'),
  FileSystem: Symbol('FileSystem'),
  Wallet: Symbol('Wallet'),
  WebCrypto: Symbol('WebCrypto'),
}
