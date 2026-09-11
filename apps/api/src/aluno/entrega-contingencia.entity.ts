import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Entrega recebida pelo portal Bimo quando o aluno não conseguiu
 * submeter pela plataforma nativa (RF-STU-03). Fica marcada com origem
 * "Bimo (contingência)"; a propagação automática para a plataforma
 * nativa depende do módulo de coursework/submissions (ainda não
 * implementado), então por ora fica pendente para lançamento manual
 * de nota pelo professor a partir do link enviado.
 */
@Entity('entrega_contingencia')
export class EntregaContingencia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'turma_espelhada_id' })
  turmaEspelhadaId: string;

  @Column({ name: 'aluno_id' })
  alunoId: string;

  /** Link para o arquivo/trabalho (Drive, OneDrive, ou outro), por simplicidade da v1. */
  @Column()
  link: string;

  @Column({ name: 'propagated_at', type: 'timestamp', nullable: true })
  propagatedAt: Date | null;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;
}
