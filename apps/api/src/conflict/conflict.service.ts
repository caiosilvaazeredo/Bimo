import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../tenant/tenant-context';
import { SyncConflict } from './sync-conflict.entity';

export interface RaiseConflictInput {
  resourceType: string;
  resourceId: string;
  fieldName: string;
  googleValue: string | null;
  googleUpdatedAt: Date | null;
  microsoftValue: string | null;
  microsoftUpdatedAt: Date | null;
}

@Injectable()
export class ConflictService {
  constructor(
    @InjectRepository(SyncConflict)
    private readonly repository: Repository<SyncConflict>,
  ) {}

  /** Registra um conflito aberto para o recurso/campo; nunca resolve sozinho (RF-SYNC-03). */
  async raise(input: RaiseConflictInput): Promise<SyncConflict> {
    const tenantId = TenantContext.getTenantId();

    const existingOpen = await this.repository.findOne({
      where: {
        tenantId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        fieldName: input.fieldName,
        resolved: false,
      },
    });
    if (existingOpen) {
      return existingOpen;
    }

    return this.repository.save(
      this.repository.create({
        tenantId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        fieldName: input.fieldName,
        googleValue: input.googleValue,
        googleUpdatedAt: input.googleUpdatedAt,
        microsoftValue: input.microsoftValue,
        microsoftUpdatedAt: input.microsoftUpdatedAt,
        resolved: false,
      }),
    );
  }

  async listOpenByResource(
    resourceType: string,
    resourceId: string,
  ): Promise<SyncConflict[]> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.find({
      where: { tenantId, resourceType, resourceId, resolved: false },
    });
  }

  async listOpenByTenant(): Promise<SyncConflict[]> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.find({ where: { tenantId, resolved: false } });
  }

  /** O professor escolhe qual versão vale — nunca é automático (RF-SYNC-03). */
  async resolve(
    conflictId: string,
    chosenSide: 'GOOGLE' | 'MICROSOFT',
  ): Promise<SyncConflict> {
    const tenantId = TenantContext.getTenantId();
    const conflict = await this.repository.findOne({
      where: { id: conflictId, tenantId },
    });
    if (!conflict) {
      throw new NotFoundException('Conflito não encontrado');
    }

    conflict.resolved = true;
    conflict.resolvedValue =
      chosenSide === 'GOOGLE' ? conflict.googleValue : conflict.microsoftValue;
    return this.repository.save(conflict);
  }
}
