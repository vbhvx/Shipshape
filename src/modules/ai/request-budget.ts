export type RequestCategory = 'preflight' | 'generation' | 'modification' | 'repair';

export interface RequestBudgetConfig {
  maxTotalRequests: number;
  maxPreflightRequests?: number;
  maxGenerationRequests: number;
  maxModificationRequests: number;
  maxRepairRequests: number;
}

export interface RequestRecord {
  id: string;
  type: RequestCategory;
  timestamp: string;
  durationMs: number;
  success: boolean;
  model: string;
  attempt?: number;
  tokens: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
  errorCode?: string;
  errorMessage?: string;
}

export class BudgetExceededError extends Error {
  constructor(public readonly requestType: string, public readonly limit: number) {
    super(`[BUDGET EXCEEDED] Request limit of ${limit} reached for operation: ${requestType}. Halting to prevent unintended API usage.`);
    this.name = 'BudgetExceededError';
  }
}

/**
 * ExperimentRequestAccountant
 *
 * Tracks, categorizes, and bounds API requests issued to live model providers.
 * Enforces explicit request ceilings per operation type at the HTTP boundary
 * with atomic in-flight reservation tracking to prevent race conditions or budget bypass.
 */
export class ExperimentRequestAccountant {
  private records: RequestRecord[] = [];
  private inFlight = new Map<RequestCategory, number>();

  constructor(public readonly config: RequestBudgetConfig) {}

  private getTotalInFlight(): number {
    let sum = 0;
    for (const count of this.inFlight.values()) {
      sum += count;
    }
    return sum;
  }

  getLimitForCategory(type: RequestCategory): number {
    switch (type) {
      case 'preflight':
        return this.config.maxPreflightRequests ?? 2;
      case 'generation':
        return this.config.maxGenerationRequests;
      case 'modification':
        return this.config.maxModificationRequests;
      case 'repair':
        return this.config.maxRepairRequests;
    }
  }

  canIssueRequest(type: RequestCategory): boolean {
    const currentTotal = this.records.length + this.getTotalInFlight();
    if (currentTotal >= this.config.maxTotalRequests) {
      return false;
    }
    const countForType = this.records.filter((r) => r.type === type).length + (this.inFlight.get(type) || 0);
    return countForType < this.getLimitForCategory(type);
  }

  assertBudgetAvailable(type: RequestCategory): void {
    const currentTotal = this.records.length + this.getTotalInFlight();
    if (currentTotal >= this.config.maxTotalRequests) {
      throw new BudgetExceededError('total', this.config.maxTotalRequests);
    }
    const countForType = this.records.filter((r) => r.type === type).length + (this.inFlight.get(type) || 0);
    const limit = this.getLimitForCategory(type);

    if (countForType >= limit) {
      throw new BudgetExceededError(type, limit);
    }
  }

  /**
   * Atomically acquires a budget reservation for an asynchronous HTTP request.
   * Prevents concurrent requests from exceeding the budget during network flight.
   * Returns a release function to be called if the request fails before recordRequest.
   */
  acquireReservation(type: RequestCategory): () => void {
    this.assertBudgetAvailable(type);
    this.inFlight.set(type, (this.inFlight.get(type) || 0) + 1);

    let released = false;
    return () => {
      if (!released) {
        released = true;
        const current = this.inFlight.get(type) || 0;
        if (current > 0) {
          this.inFlight.set(type, current - 1);
        }
      }
    };
  }

  recordRequest(record: Omit<RequestRecord, 'id' | 'timestamp'>): RequestRecord {
    // Release in-flight reservation slot if one was held
    const currentInFlight = this.inFlight.get(record.type) || 0;
    if (currentInFlight > 0) {
      this.inFlight.set(record.type, currentInFlight - 1);
    }

    const fullRecord: RequestRecord = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...record,
    };
    this.records.push(fullRecord);
    return fullRecord;
  }

  getRecords(): RequestRecord[] {
    return [...this.records];
  }

  getSummary() {
    const totalRequests = this.records.length;
    const preflightRequests = this.records.filter((r) => r.type === 'preflight').length;
    const generationRequests = this.records.filter((r) => r.type === 'generation').length;
    const modificationRequests = this.records.filter((r) => r.type === 'modification').length;
    const repairRequests = this.records.filter((r) => r.type === 'repair').length;

    const successfulRequests = this.records.filter((r) => r.success).length;
    const failedRequests = totalRequests - successfulRequests;

    let totalPromptTokens = 0;
    let totalCandidatesTokens = 0;
    let totalTokens = 0;

    for (const r of this.records) {
      totalPromptTokens += r.tokens.promptTokens;
      totalCandidatesTokens += r.tokens.candidatesTokens;
      totalTokens += r.tokens.totalTokens;
    }

    return {
      limits: this.config,
      totalRequests,
      preflightRequests,
      generationRequests,
      modificationRequests,
      repairRequests,
      successfulRequests,
      failedRequests,
      inFlightRequests: this.getTotalInFlight(),
      tokenTotals: {
        promptTokens: totalPromptTokens,
        candidatesTokens: totalCandidatesTokens,
        totalTokens,
      },
    };
  }
}
