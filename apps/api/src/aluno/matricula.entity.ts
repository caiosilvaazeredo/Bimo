import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Vínculo Aluno <-> TurmaEspelhada (roster simplificado desta fase). */
@Entity('matricula')
@Index(['tenantId', 'alunoId', 'turmaEspelhadaId'], { unique: true })
export class Matricula {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'aluno_id' })
  alunoId: string;

  @Column({ name: 'turma_espelhada_id' })
  turmaEspelhadaId: string;

  /** Id do aluno no Google/Microsoft, necessário para lançar nota nas plataformas (RF-SYNC-04). */
  @Column({ name: 'google_user_id', nullable: true })
  googleUserId: string | null;

  @Column({ name: 'microsoft_user_id', nullable: true })
  microsoftUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
