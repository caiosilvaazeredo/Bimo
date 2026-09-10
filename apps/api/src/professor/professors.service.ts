import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../tenant/tenant-context';
import { Professor } from './professor.entity';
import { ProfessorRole } from './professor-role.enum';

@Injectable()
export class ProfessorsService {
  constructor(
    @InjectRepository(Professor)
    private readonly professorRepository: Repository<Professor>,
  ) {}

  /**
   * Um perfil Bimo é único por (tenant, e-mail institucional). Login OAuth
   * de qualquer provedor reconcilia pelo mesmo e-mail (RF-AUTH-03).
   */
  async findOrCreateByInstitutionalEmail(params: {
    institutionalEmail: string;
    displayName: string;
  }): Promise<Professor> {
    const tenantId = TenantContext.getTenantId();

    const existing = await this.professorRepository.findOne({
      where: { tenantId, institutionalEmail: params.institutionalEmail },
    });
    if (existing) {
      return existing;
    }

    return this.professorRepository.save(
      this.professorRepository.create({
        tenantId,
        institutionalEmail: params.institutionalEmail,
        displayName: params.displayName,
        role: ProfessorRole.PROFESSOR,
      }),
    );
  }

  async findById(id: string): Promise<Professor> {
    const tenantId = TenantContext.getTenantId();
    const professor = await this.professorRepository.findOne({
      where: { id, tenantId },
    });
    if (!professor) {
      throw new NotFoundException('Professor não encontrado');
    }
    return professor;
  }
}
