import type { MetricsService } from './MetricsService'

export class DummyMetricsService implements MetricsService {
  public reportGossipCompleted(witnessId: string, transactionId: string): Promise<void> {
    return Promise.resolve()
  }

  public reportGossipStart(witnessId: string, transactionId: string): Promise<void> {
    return Promise.resolve()
  }

  public reportTockTransactionsCount(witnessId: string, count: number): Promise<void> {
    return Promise.resolve()
  }

  public reportGossipMessageSize(witnessId: string, sizeInBytes: number): Promise<void> {
    return Promise.resolve()
  }

  public reportTransactionUpdateTime(witnessId: string, timeInMs: number): Promise<void> {
    return Promise.resolve()
  }

  public reportWitnessStateSize(witnessId: string, sizeInBytes: number): Promise<void> {
    return Promise.resolve()
  }
}
