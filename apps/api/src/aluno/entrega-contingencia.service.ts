import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../tenant/tenant-context';
import { TenantsService } from '../tenant/tenants.service';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MatriculaService } from './matricula.service';
import { EntregaContingencia } from './entrega-contingencia.entity';

/** RF-STU-04: a partir de quantos usos seguidos de contingência o professor é avisado proativamente. */
const CONTINGENCY_SIGNAL_THRESHOLD = 2;

@Injectable()
export class EntregaContingenciaService {
  constructor(
    @InjectRepository(EntregaContingencia)
    private readonly repository: Repository<EntregaContingencia>,
    private readonly matriculaService: MatriculaService,
    private readonly tenantsService: TenantsService,
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly notificationsService: NotificationsService,
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

    const entrega = await this.repository.save(
      this.repository.create({
        tenantId,
        alunoId: input.alunoId,
        turmaEspelhadaId: input.turmaEspelhadaId,
        link: input.link,
        propagatedAt: null,
      }),
    );

    await this.checkContingencySignal(input.alunoId, input.turmaEspelhadaId);

    return entrega;
  }

  /**
   * RF-STU-04: detecção automática de sinal de problema de acesso —
   * quando o mesmo aluno já usou a contingência CONTINGENCY_SIGNAL_THRESHOLD
   * vezes ou mais na mesma turma, isso deixa de ser um imprevisto pontual
   * e passa a ser um padrão. Nunca resolve nada sozinho, só avisa o
   * professor (RF-STU-05 já dá a ele o painel para investigar e agir).
   * Falha ao notificar não derruba o envio da entrega em si.
   */
  private async checkContingencySignal(
    alunoId: string,
    turmaEspelhadaId: string,
  ): Promise<void> {
    try {
      const anteriores = await this.listByAlunoAndTurma(
        alunoId,
        turmaEspelhadaId,
      );
      // Notifica só na primeira vez que cruza o limite — evita reenviar a
      // cada nova entrega depois que o professor já foi avisado uma vez.
      if (anteriores.length !== CONTINGENCY_SIGNAL_THRESHOLD) {
        return;
      }
      const turma = await this.turmaEspelhadaService.findById(turmaEspelhadaId);
      await this.notificationsService.notifyContingencySignal(
        turma.professorId,
        turmaEspelhadaId,
        alunoId,
        anteriores.length,
      );
    } catch {
      // Sinal é best-effort: nunca deve impedir a entrega de ser registrada.
    }
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
