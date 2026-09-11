import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncEventLog } from './sync-event-log.entity';

@Injectable()
export class SyncEventLogService {
  constructor(
    @InjectRepository(SyncEventLog)
    private readonly repository: Repository<SyncEventLog>,
  ) {}

  async record(input: {
    tenantId: string;
    jobType: string;
    resourceId?: string | null;
    result: 'SUCCESS' | 'FAILURE';
    detail?: string | null;
  }): Promise<void> {
    await this.repository.save(
      this.repository.create({
        tenantId: input.tenantId,
        jobType: input.jobType,
        resourceId: input.resourceId ?? null,
        result: input.result,
        detail: input.detail ?? null,
      }),
    );
  }

  async listByTenant(tenantId: string, limit = 100): Promise<SyncEventLog[]> {
    return this.repository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
