import { ProfessorRole } from '../professor/professor-role.enum';

/** Payload da sessão Bimo de um Professor (token emitido após o OAuth externo). */
export interface BimoJwtPayload {
  sub: string;
  tenantId: string;
  role: ProfessorRole;
  kind: 'PROFESSOR';
}

/** Payload da sessão Bimo de um Aluno (RF-STU-01), mesmo fluxo OAuth. */
export interface AlunoJwtPayload {
  sub: string;
  tenantId: string;
  kind: 'ALUNO';
}

export type SessionJwtPayload = BimoJwtPayload | AlunoJwtPayload;
