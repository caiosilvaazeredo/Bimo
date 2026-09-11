import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantContext } from '../tenant/tenant-context';
import { TenantsService } from '../tenant/tenants.service';
import { ProfessorsService } from '../professor/professors.service';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReportsService } from './reports.service';

/**
 * RF-DASH-06: resumo periódico por professor (turmas, tarefas publicadas e
 * entregas pendentes na semana), entregue como notificação em painel +
 * e-mail (log estruturado, mesmo padrão do NotificationsService).
 *
 * Roda semanalmente via @nestjs/schedule quando PERIODIC_SUMMARY_ENABLED=true
 * (mesmo padrão de opt-in do WorkersModule/WORKERS_ENABLED, para não bater
 * no banco durante testes/CI). generateForAllTenants/generateForTenant ficam
 * públicos para poder ser acionados sob demanda (ex: endpoint de admin ou
 * teste manual) sem esperar o cron.
 */
@Injectable()
export class PeriodicSummaryService {
  private readonly logger = new Logger(PeriodicSummaryService.name);

  constructor(
    private readonly tenantsService: TenantsService,
    private readonly professorsService: ProfessorsService,
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly reportsService: ReportsService,
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_WEEK)
  async handleWeeklyCron(): Promise<void> {
    if (this.config.get<string>('PERIODIC_SUMMARY_ENABLED') !== 'true') {
      return;
    }
    await this.generateForAllTenants();
  }

  async generateForAllTenants(): Promise<void> {
    const tenants = await this.tenantsService.listAll();
    for (const tenant of tenants) {
      try {
        await TenantContext.run({ tenantId: tenant.id }, () =>
          this.generateForTenant(),
        );
      } catch (error) {
        this.logger.error(
          `Falha ao gerar resumo periódico do tenant ${tenant.id}: ${(error as Error).message}`,
        );
      }
    }
  }

  /** Requer TenantContext já ativo (chamado de dentro de generateForAllTenants ou em teste com TenantContext.run). */
  async generateForTenant(): Promise<void> {
    const [professors, turmas] = await Promise.all([
      this.professorsService.listByTenant(),
      this.turmaEspelhadaService.listByTenant(),
    ]);

    for (const professor of professors) {
      const turmasDoProfessor = turmas.filter(
        (turma) => turma.professorId === professor.id,
      );
      if (turmasDoProfessor.length === 0) {
        continue;
      }

      const resumos = await Promise.all(
        turmasDoProfessor.map((turma) =>
          this.reportsService.turmaSummary(turma.id),
        ),
      );

      const totalTarefas = resumos.reduce((sum, r) => sum + r.totalTarefas, 0);
      const totalPendentes = resumos.reduce(
        (sum, r) => sum + r.entregasPendentes,
        0,
      );

      const message =
        `Resumo da semana: ${turmasDoProfessor.length} turma(s) espelhada(s), ` +
        `${totalTarefas} tarefa(s) publicada(s), ${totalPendentes} entrega(s) pendente(s).`;

      await this.notificationsService.notifyPeriodicSummary(
        professor.id,
        message,
      );
    }
  }
}
