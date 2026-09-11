import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../tenant/tenant-context';
import { Matricula } from './matricula.entity';

@Injectable()
export class MatriculaService {
  constructor(
    @InjectRepository(Matricula)
    private readonly repository: Repository<Matricula>,
  ) {}

  async enroll(
    alunoId: string,
    turmaEspelhadaId: string,
    externalIds?: {
      googleUserId?: string | null;
      microsoftUserId?: string | null;
    },
  ): Promise<Matricula> {
    const tenantId = TenantContext.getTenantId();
    const existing = await this.repository.findOne({
      where: { tenantId, alunoId, turmaEspelhadaId },
    });
    if (existing) {
      if (externalIds?.googleUserId || externalIds?.microsoftUserId) {
        existing.googleUserId =
          externalIds.googleUserId ?? existing.googleUserId;
        existing.microsoftUserId =
          externalIds.microsoftUserId ?? existing.microsoftUserId;
        return this.repository.save(existing);
      }
      return existing;
    }
    return this.repository.save(
      this.repository.create({
        tenantId,
        alunoId,
        turmaEspelhadaId,
        googleUserId: externalIds?.googleUserId ?? null,
        microsoftUserId: externalIds?.microsoftUserId ?? null,
      }),
    );
  }

  async isEnrolled(
    alunoId: string,
    turmaEspelhadaId: string,
  ): Promise<boolean> {
    const tenantId = TenantContext.getTenantId();
    const count = await this.repository.count({
      where: { tenantId, alunoId, turmaEspelhadaId },
    });
    return count > 0;
  }

  async findByAlunoAndTurma(
    alunoId: string,
    turmaEspelhadaId: string,
  ): Promise<Matricula | null> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.findOne({
      where: { tenantId, alunoId, turmaEspelhadaId },
    });
  }

  async listTurmaIdsByAluno(alunoId: string): Promise<string[]> {
    const tenantId = TenantContext.getTenantId();
    const rows = await this.repository.find({ where: { tenantId, alunoId } });
    return rows.map((row) => row.turmaEspelhadaId);
  }

  async listAlunoIdsByTurma(turmaEspelhadaId: string): Promise<string[]> {
    const tenantId = TenantContext.getTenantId();
    const rows = await this.repository.find({
      where: { tenantId, turmaEspelhadaId },
    });
    return rows.map((row) => row.alunoId);
  }

  async listByTurma(turmaEspelhadaId: string): Promise<Matricula[]> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.find({ where: { tenantId, turmaEspelhadaId } });
  }
}
