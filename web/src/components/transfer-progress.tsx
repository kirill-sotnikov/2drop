import * as styles from "../app/page.css";
import { type TransferView } from "../lib/client";
import { bytesLabel } from "../lib/format";

export const TransferProgress = ({
  transfer,
  totalBytes,
  onCancel,
}: {
  readonly transfer: TransferView;
  readonly totalBytes: number;
  readonly onCancel: () => void;
}) => {
  const { phase, direction } = transfer;
  const transferring = phase === "transferring";
  const bytes = Math.min(totalBytes, Math.max(0, transfer.bytes));
  const percent = totalBytes > 0 ? Math.floor((bytes / totalBytes) * 100) : 100;
  const waitingForCompletion = transferring && bytes === totalBytes;

  const status =
    phase === "offering"
      ? "Ожидаем подтверждения получателя…"
      : phase === "connecting"
        ? "Соединяем устройства…"
        : phase === "cancelling"
          ? "Отменяем передачу…"
          : waitingForCompletion
            ? direction === "send"
              ? "Ожидаем подтверждения получения…"
              : "Завершаем получение…"
            : direction === "send"
              ? "Отправляем файлы"
              : "Получаем файлы";

  return (
    <div className={styles.transferProgress}>
      <div className={styles.progressHeader}>
        <span className={styles.progressStatus} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          {status}
        </span>
        {transferring && (
          <span className={styles.progressPercent}>{percent}%</span>
        )}
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label="Прогресс передачи"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={transferring ? percent : undefined}
        aria-valuetext={
          transferring
            ? `${percent}% · ${bytesLabel(bytes)} из ${bytesLabel(totalBytes)}`
            : status
        }
      >
        <div
          className={styles.progressFill}
          data-indeterminate={!transferring}
          style={transferring ? { width: `${percent}%` } : undefined}
        />
      </div>
      {transferring && (
        <p className={styles.progressBytes}>
          {bytesLabel(bytes)} / {bytesLabel(totalBytes)}
        </p>
      )}
      <button
        type="button"
        className={styles.secondary}
        onClick={onCancel}
        disabled={phase === "cancelling"}
      >
        Отменить передачу
      </button>
      <p className={styles.transferHint}>
        Держите страницу открытой во время передачи
      </p>
    </div>
  );
};
