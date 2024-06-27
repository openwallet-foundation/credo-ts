export const InjectionSymbols = {
  MessagePickupRepository: Symbol('MessagePickupRepository'),
  StorageService: Symbol('StorageService'),
  Logger: Symbol('Logger'),
  AgentContextProvider: Symbol('AgentContextProvider'),
  AgentDependencies: Symbol('AgentDependencies'),
  Stop$: Symbol('Stop$'),
  FileSystem: Symbol('FileSystem'),
  Wallet: Symbol('Wallet'),
  WebCrypto: Symbol('WebCrypto'),
}

export const DID_COMM_TRANSPORT_QUEUE = 'didcomm:transport/queue'
