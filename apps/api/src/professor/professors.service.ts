import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
   * Bloqueia o login se o professor foi revogado (RF-ADMIN-05).
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
      if (!existing.active) {
        throw new ForbiddenException(
          'Acesso revogado pelo administrador institucional.',
        );
      }
      return existing;
    }

    return this.professorRepository.save(
      this.professorRepository.create({
        tenantId,
        institutionalEmail: params.institutionalEmail,
        displayName: params.displayName,
        role: ProfessorRole.PROFESSOR,
        active: true,
      }),
    );
  }

  /**
   * Pré-cadastra um admin institucional/de rede pelo e-mail (RF-ADMIN-01):
   * quando essa pessoa logar pela primeira vez, o findOrCreate acima já
   * encontra este registro em vez de criar um Professor comum.
   */
  async createWithRole(params: {
    institutionalEmail: string;
    displayName: string;
    role: ProfessorRole;
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
        role: params.role,
        active: true,
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

  async listByTenant(): Promise<Professor[]> {
    const tenantId = TenantContext.getTenantId();
    return this.professorRepository.find({ where: { tenantId } });
  }

  /** RF-ADMIN-05: revoga o acesso de um professor sem afetar as demais turmas/professores. */
  async revoke(id: string): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    await this.professorRepository.update({ id, tenantId }, { active: false });
  }

  /**
   * RNF-PRIV-03: direito de exclusão individual (LGPD) — apaga o
   * e-mail/nome do titular sem quebrar referências (turmas, contas
   * externas já removidas à parte) já existentes no banco.
   */
  async anonymize(id: string): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    await this.professorRepository.update(
      { id, tenantId },
      {
        institutionalEmail: `titular-removido-${id}@anonimizado.bimo`,
        displayName: 'Titular removido a pedido (LGPD)',
        active: false,
      },
    );
  }
}
