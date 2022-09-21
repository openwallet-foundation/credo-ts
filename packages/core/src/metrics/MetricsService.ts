export interface MetricsService {
  reportGossipStart(witnessId: string, transactionUpdateId: string): Promise<void>
  reportGossipCompleted(witnessId: string, transactionUpdateId: string): Promise<void>
  reportTockTransactionsCount(witnessId: string, count: number): Promise<void>
  reportGossipMessageSize(witnessId: string, sizeInBytes: number): Promise<void>
  reportTransactionUpdateTime(witnessId: string, timeInMs: number): Promise<void>
  reportWitnessStateSize(witnessId: string, sizeInBytes: number): Promise<void>
}
