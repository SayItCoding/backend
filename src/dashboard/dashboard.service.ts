import { Injectable } from '@nestjs/common';

export interface SummaryQuery {
  from?: string;
  to?: string;
}

@Injectable()
export class DashboardService {
  getSummary(q: SummaryQuery) {
    return { range: q, summary: { missions: 0, assignments: 0, users: 0 } };
  }

  getMetrics() {
    return { metrics: { dailyActive: 0, conversion: 0 } };
  }
}
