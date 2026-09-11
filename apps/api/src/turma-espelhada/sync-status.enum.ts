/** Estados exibidos ao professor no painel (RF-DASH-02). */
export enum SyncStatus {
  SYNCING = 'SYNCING',
  SYNCED = 'SYNCED',
  CONFLICT = 'CONFLICT',
  ERROR = 'ERROR',
  /** RF-SYNC-06: exclusão confirmada, propagação para as duas plataformas em andamento (só usado por Tarefa). */
  DELETING = 'DELETING',
  /** RF-SYNC-06: exclusão propagada com sucesso (exclusão lógica — a Tarefa some das listagens, mas o registro fica para auditoria). */
  DELETED = 'DELETED',
}
