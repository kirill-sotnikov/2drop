import { useFormatter, useTranslations } from "next-intl";
import * as styles from "../app/page.css";
import { type TransferView } from "../lib/client";
import { useBytesLabel } from "../lib/format";

export const TransferProgress = ({
  transfer,
  totalBytes,
  onCancel,
}: {
  readonly transfer: TransferView;
  readonly totalBytes: number;
  readonly onCancel: () => void;
}) => {
  const translate = useTranslations();
  const format = useFormatter();
  const bytesLabel = useBytesLabel();
  const { phase, direction } = transfer;
  const transferring = phase === "transferring";
  const bytes = Math.min(totalBytes, Math.max(0, transfer.bytes));
  const percent = totalBytes > 0 ? Math.floor((bytes / totalBytes) * 100) : 100;
  const percentLabel = format.number(percent / 100, { style: "percent" });
  const waitingForCompletion = transferring && bytes === totalBytes;

  const status =
    phase === "offering"
      ? translate("transferProgress.waitingForAcceptance")
      : phase === "connecting"
        ? translate("transferProgress.connecting")
        : phase === "cancelling"
          ? translate("transferProgress.cancelling")
          : waitingForCompletion
            ? direction === "send"
              ? translate("transferProgress.waitingForDelivery")
              : translate("transferProgress.finishing")
            : direction === "send"
              ? translate("transferProgress.sending")
              : translate("receivingFiles");

  return (
    <div className={styles.transferProgress}>
      <div className={styles.progressHeader}>
        <span className={styles.progressStatus} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          {status}
        </span>
        {transferring && (
          <span className={styles.progressPercent}>{percentLabel}</span>
        )}
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label={translate("transferProgress.label")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={transferring ? percent : undefined}
        aria-valuetext={
          transferring
            ? translate("transferProgress.value", {
                percent: percentLabel,
                bytes: bytesLabel(bytes),
                total: bytesLabel(totalBytes),
              })
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
        {translate("transferProgress.cancel")}
      </button>
      <p className={styles.transferHint}>{translate("keepPageOpen")}</p>
    </div>
  );
};
