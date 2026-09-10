import { ProfessorRole } from '../professor/professor-role.enum';

/** Payload da sessão Bimo (token emitido pelo próprio Bimo após o OAuth externo). */
export interface BimoJwtPayload {
  sub: string;
  tenantId: string;
  role: ProfessorRole;
}
