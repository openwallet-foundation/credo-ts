export const InjectionSymbols = {
  MessagePickupRepository: Symbol('MessagePickupRepository'), // TODO: Move to DIDComm
  StorageService: Symbol('StorageService'),
  Logger: Symbol('Logger'),
  AgentContextProvider: Symbol('AgentContextProvider'),
  AgentDependencies: Symbol('AgentDependencies'),
  Stop$: Symbol('Stop$'),
  FileSystem: Symbol('FileSystem'),
  WebCrypto: Symbol('WebCrypto'),
}
