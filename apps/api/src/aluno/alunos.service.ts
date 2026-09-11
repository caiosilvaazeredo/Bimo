import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../tenant/tenant-context';
import { Aluno } from './aluno.entity';

@Injectable()
export class AlunosService {
  constructor(
    @InjectRepository(Aluno)
    private readonly repository: Repository<Aluno>,
  ) {}

  /** Um Aluno é único por (tenant, e-mail institucional) — RF-STU-01. */
  async findOrCreateByInstitutionalEmail(params: {
    institutionalEmail: string;
    displayName: string;
  }): Promise<Aluno> {
    const tenantId = TenantContext.getTenantId();

    const existing = await this.repository.findOne({
      where: { tenantId, institutionalEmail: params.institutionalEmail },
    });
    if (existing) {
      return existing;
    }

    return this.repository.save(
      this.repository.create({
        tenantId,
        institutionalEmail: params.institutionalEmail,
        displayName: params.displayName,
      }),
    );
  }

  async findById(id: string): Promise<Aluno> {
    const tenantId = TenantContext.getTenantId();
    const aluno = await this.repository.findOne({ where: { id, tenantId } });
    if (!aluno) {
      throw new NotFoundException('Aluno não encontrado');
    }
    return aluno;
  }

  /** RNF-PRIV-03: direito de exclusão individual (LGPD). */
  async anonymize(id: string): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    await this.repository.update(
      { id, tenantId },
      {
        institutionalEmail: `titular-removido-${id}@anonimizado.bimo`,
        displayName: 'Titular removido a pedido (LGPD)',
      },
    );
  }
}
