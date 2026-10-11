export type ReminderOffset = 0 | 1 | 2 | 3;

export interface ReminderPrefs {
  readonly enabled: boolean;
  readonly offsets: readonly ReminderOffset[];
  /** 'HH:MM' 24h local time, 30-minute steps. */
  readonly time: string;
}

export interface ReminderItem {
  readonly name: string;
  readonly expiryDate: string | null | undefined;
}

export interface ReminderNotification {
  readonly id: number;
  readonly title: 'Kitcha';
  readonly body: string;
  readonly fireAt: Date;
  readonly route: string;
}

export type PermissionDisplay = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';

export interface LocalNotificationsLike {
  checkPermissions(): Promise<{ display: PermissionDisplay }>;
  requestPermissions(): Promise<{ display: PermissionDisplay }>;
  getPending(): Promise<{ notifications: { id: number }[] }>;
  cancel(o: { notifications: { id: number }[] }): Promise<void>;
  schedule(o: { notifications: unknown[] }): Promise<unknown>;
}

export type SyncStatus = 'disabled' | 'not-granted' | 'scheduled' | 'error';

export interface SyncResult {
  readonly status: SyncStatus;
  readonly scheduled: number;
}
