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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
