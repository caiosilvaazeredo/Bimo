import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../tenant/tenant-context';
import { TenantsService } from '../tenant/tenants.service';
import { MatriculaService } from './matricula.service';
import { EntregaContingencia } from './entrega-contingencia.entity';

@Injectable()
export class EntregaContingenciaService {
  constructor(
    @InjectRepository(EntregaContingencia)
    private readonly repository: Repository<EntregaContingencia>,
    private readonly matriculaService: MatriculaService,
    private readonly tenantsService: TenantsService,
  ) {}

  /**
   * RF-STU-03: aluno envia entrega direto pelo portal quando não
   * consegue pela plataforma nativa. RF-STU-06: a instituição pode ter
   * desligado esse acesso.
   */
  async submit(input: {
    alunoId: string;
    turmaEspelhadaId: string;
    link: string;
  }): Promise<EntregaContingencia> {
    const tenantId = TenantContext.getTenantId();

    const tenant = await this.tenantsService.findById(tenantId);
    if (!tenant.contingencyEnabled) {
      throw new ForbiddenException(
        'O acesso de contingência está desabilitado para esta instituição.',
      );
    }

    const enrolled = await this.matriculaService.isEnrolled(
      input.alunoId,
      input.turmaEspelhadaId,
    );
    if (!enrolled) {
      throw new BadRequestException('Aluno não está matriculado nesta turma.');
    }

    return this.repository.save(
      this.repository.create({
        tenantId,
        alunoId: input.alunoId,
        turmaEspelhadaId: input.turmaEspelhadaId,
        link: input.link,
        propagatedAt: null,
      }),
    );
  }

  async listByTurma(turmaEspelhadaId: string): Promise<EntregaContingencia[]> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.find({
      where: { tenantId, turmaEspelhadaId },
      order: { submittedAt: 'DESC' },
    });
  }

  async listByAlunoAndTurma(
    alunoId: string,
    turmaEspelhadaId: string,
  ): Promise<EntregaContingencia[]> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.find({
      where: { tenantId, alunoId, turmaEspelhadaId },
    });
  }
}
