import { Injectable } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';
import { ProfessorsService } from '../professor/professors.service';
import { ExternalAccountsService } from '../professor/external-accounts.service';
import { AlunosService } from '../aluno/alunos.service';
import { SyncEventLogService } from '../sync-event-log/sync-event-log.service';

/**
 * RNF-PRIV-03: qualquer aluno, responsável ou professor pode solicitar
 * a exclusão dos seus próprios dados pessoais (direito do titular,
 * LGPD), mesmo que a instituição não tenha cancelado o Bimo. Como a
 * v1 não distingue "excluir" de "anonimizar" no schema, e apagar a
 * linha quebraria referências (turmas, matrículas, notas), o Bimo
 * anonimiza e-mail/nome imediatamente e revoga o acesso — sem manter
 * dado pessoal além do necessário (RNF-PRIV-02).
 */
@Injectable()
export class DataSubjectRequestsService {
  constructor(
    private readonly professorsService: ProfessorsService,
    private readonly externalAccountsService: ExternalAccountsService,
    private readonly alunosService: AlunosService,
    private readonly syncEventLogService: SyncEventLogService,
  ) {}

  async deleteOwnData(
    tenantId: string,
    kind: 'PROFESSOR' | 'ALUNO',
    subjectId: string,
  ): Promise<void> {
    await TenantContext.run({ tenantId }, async () => {
      if (kind === 'PROFESSOR') {
        await this.externalAccountsService.removeAllForProfessor(subjectId);
        await this.professorsService.anonymize(subjectId);
      } else {
        await this.alunosService.anonymize(subjectId);
      }
    });

    await this.syncEventLogService.record({
      tenantId,
      jobType: 'LGPD_DATA_SUBJECT_DELETE',
      resourceId: subjectId,
      result: 'SUCCESS',
      detail: `kind=${kind}`,
    });
  }
}
