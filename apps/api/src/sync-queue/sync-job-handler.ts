export interface SyncJobHandler {
  readonly jobType: string;
  handle(payload: any): Promise<void>;
}

export const SYNC_JOB_HANDLERS = 'SYNC_JOB_HANDLERS';
