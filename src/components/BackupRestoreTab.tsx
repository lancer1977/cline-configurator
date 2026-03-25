import { useState } from "react";
import { tauriService } from "../services/tauri";
import type { BackupFile } from "../types";

type BackupRestoreTabProps = {
  onStatusChange: (status: string) => void;
};

export function BackupRestoreTab({ onStatusChange }: BackupRestoreTabProps): JSX.Element {
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backups, setBackups] = useState<BackupFile[]>([]);

  async function handleBackup(): Promise<void> {
    try {
      const result = await tauriService.backupConfig();
      if (result.success) {
        onStatusChange(`Backup created: ${result.backupPath ?? "(unknown path)"}`);
      } else {
        onStatusChange(`Backup failed: ${result.error ?? "Unknown error"}`);
      }
    } catch (error) {
      onStatusChange(`Backup failed: ${String(error)}`);
    }
  }

  async function handleOpenRestoreModal(): Promise<void> {
    setBackupModalOpen(true);
    setBackupsLoading(true);
    try {
      const files = await tauriService.listBackups();
      setBackups(files);
      onStatusChange(`Loaded ${files.length} backups`);
    } catch (error) {
      onStatusChange(`Failed to load backups: ${String(error)}`);
    } finally {
      setBackupsLoading(false);
    }
  }

  async function handleRestore(backupFilename: string): Promise<void> {
    try {
      const result = await tauriService.restoreConfig(backupFilename);
      if (result.success) {
        onStatusChange(
          `Restored config from ${result.restoredFrom ?? backupFilename}` +
            (result.autoBackupPath ? ` (auto-backup: ${result.autoBackupPath})` : "")
        );
        setBackupModalOpen(false);
      } else {
        onStatusChange(`Restore failed: ${result.error ?? "Unknown error"}`);
      }
    } catch (error) {
      onStatusChange(`Restore failed: ${String(error)}`);
    }
  }

  return (
    <section className="panel">
      <p className="muted">
        Creates timestamped backups of your Cline config.json and lets you restore from them.
      </p>

      <div className="row">
        <button onClick={handleBackup}>Backup</button>
        <button onClick={handleOpenRestoreModal}>Restore…</button>
      </div>

      {backupModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>Restore from backup</h2>
              <button onClick={() => setBackupModalOpen(false)}>Close</button>
            </div>

            {backupsLoading && <div className="muted">Loading backups…</div>}

            {!backupsLoading && backups.length === 0 && (
              <div className="muted">No backups found yet. Click "Backup" to create one.</div>
            )}

            {!backupsLoading && backups.length > 0 && (
              <ul className="file-list">
                {backups.map((b) => (
                  <li key={b.filename}>
                    <button onClick={() => handleRestore(b.filename)}>
                      {b.createdAt} — {b.filename}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}