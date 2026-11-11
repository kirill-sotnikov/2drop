"use client";

import { useTranslations } from "next-intl";
import { formatId, totalFileBytes } from "protocol";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import * as styles from "../app/page.css";
import { useBytesLabel } from "../lib/format";
import { useSession } from "../lib/session-context";
import { FileList } from "./file-list";
import { Icon } from "./icon";
import { PageLoader } from "./page-loader";
import { TransferProgress } from "./transfer-progress";

// eslint-disable-next-line complexity
export const ReceiveScreen = () => {
  const translate = useTranslations();
  const bytesLabel = useBytesLabel();
  const { state, decide, cancel, rotate } = useSession();

  const transfer =
    state.transfer?.direction === "receive" ? state.transfer : null;

  const loading =
    transfer &&
    ["connecting", "transferring", "cancelling"].includes(transfer.phase);

  const received =
    !transfer || transfer.phase === "complete" ? state.received : null;

  const files = transfer?.transfer.files ?? received?.files;
  const totalBytes = totalFileBytes(files ?? []);
  const canvas = useRef<HTMLCanvasElement>(null);
  const transferPanel = useRef<HTMLElement>(null);
  const instructionsToggle = useRef<HTMLButtonElement>(null);
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const transferKey = transfer?.transfer.id ?? received?.url ?? null;
  const hasTransfer = Boolean(files && (transfer || received));
  const showInstructions = !hasTransfer || expandedFor === transferKey;

  const active = Boolean(
    state.transfer && !["complete", "ended"].includes(state.transfer.phase),
  );

  useEffect(() => {
    if (!transferKey) return;
    transferPanel.current?.focus({ preventScroll: true });

    instructionsToggle.current?.scrollIntoView({
      block: "start",
      behavior: "auto",
    });
  }, [transferKey]);

  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const [qrResult, setQrResult] = useState<{
    id: string;
    failed: boolean;
  } | null>(null);

  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeout.current !== null) clearTimeout(copyTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (!state.id || !canvas.current) return undefined;

    let live = true;

    const url = new URL("/send", location.origin);

    url.searchParams.set("id", state.id);

    const target = canvas.current;
    const id = state.id;

    const renderCode = async () => {
      try {
        await QRCode.toCanvas(target, url.href, {
          width: 256,
          margin: 2,
          errorCorrectionLevel: "M",
        });

        // Keep the canvas resolution while letting CSS fit it to the card.
        target.style.removeProperty("width");
        target.style.removeProperty("height");

        if (live) setQrResult({ id, failed: false });
      } catch {
        if (live) setQrResult({ id, failed: true });
      }
    };

    void renderCode();

    return () => {
      live = false;
    };
  }, [state.id]);

  const copy = async () => {
    if (!state.id) return;

    try {
      await navigator.clipboard.writeText(state.id);
      setMessage(translate("receivePage.idCopied"));
      setCopied(true);
      if (copyTimeout.current !== null) clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => setCopied(false), 1_000);
    } catch {
      setCopied(false);
      setMessage(translate("receivePage.copyManually"));
    }
  };

  const share = async () => {
    if (!state.id) return;

    const url = new URL("/send", location.origin);

    url.searchParams.set("id", state.id);

    if (navigator.share) {
      try {
        await navigator.share({
          title: translate("receivePage.shareTitle"),
          url: url.href,
        });

        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }

    try {
      await navigator.clipboard.writeText(url.href);
      setMessage(translate("receivePage.linkCopied"));
    } catch {
      setMessage(translate("receivePage.shareFailed"));
    }
  };

  if (!state.id) {
    return state.connection === "error" || state.error ? (
      <section className={styles.card}>
        <p role="status">{translate("receivePage.idFailed")}</p>
      </section>
    ) : (
      <PageLoader message={translate("receivePage.preparing")} />
    );
  }

  const qrReady = qrResult?.id === state.id;
  const qrFailed = qrReady && qrResult.failed;

  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <h1 className={styles.pageTitle}>{translate("receiveFile")}</h1>
          {!hasTransfer && (
            <p className={styles.pageDescription}>
              {translate("receivePage.description")}
            </p>
          )}
        </div>
      </div>

      {hasTransfer && (
        <button
          type="button"
          ref={instructionsToggle}
          className={styles.instructionsToggle}
          aria-expanded={showInstructions}
          aria-controls="receive-instructions"
          onClick={() => setExpandedFor(showInstructions ? null : transferKey)}
        >
          <Icon name="qr" size={20} />
          {showInstructions
            ? translate("receivePage.hideInstructions")
            : translate("receivePage.showInstructions")}
          <span className={styles.toggleHint}>
            {translate("receivePage.instructionHint")}
          </span>
          <Icon
            name="arrow"
            size={18}
            style={{
              transform: showInstructions ? "rotate(-90deg)" : "rotate(90deg)",
            }}
          />
        </button>
      )}

      <div id="receive-instructions" hidden={!showInstructions}>
        <section
          className={styles.receive}
          aria-label={translate("receivePage.codeLabel")}
        >
          <div className={styles.receiveDetails}>
            <span className={styles.idLabel}>
              {translate("receivePage.yourId")}
            </span>
            <div className={styles.idRow}>
              <span className={styles.bigId}>{formatId(state.id)}</span>
              <button
                type="button"
                className={styles.copyId}
                data-copied={copied}
                onClick={copy}
                aria-label={translate("receivePage.copyId")}
                title={translate("receivePage.copyId")}
              >
                <Icon name={copied ? "check" : "copy"} size={20} />
              </button>
            </div>
            <button
              type="button"
              className={styles.shareButton}
              onClick={share}
            >
              <Icon name="share" size={20} />{" "}
              {translate("receivePage.shareLink")}
            </button>
            <button
              type="button"
              className={styles.textButton}
              onClick={rotate}
              disabled={active || state.connection !== "online"}
            >
              {translate("receivePage.refreshId")}
            </button>
            {message && (
              <p className={styles.metadata} role="status">
                {message}
              </p>
            )}
            <p className={styles.receiveDescription}>
              {translate("receivePage.idHint")}
            </p>
          </div>
          <div className={styles.qrPanel}>
            <div className={styles.qrFrame}>
              <canvas
                key={state.id}
                ref={canvas}
                className={styles.qr}
                style={!qrReady || qrFailed ? { display: "none" } : undefined}
                role="img"
                aria-label={translate("receivePage.qrLabel", {
                  id: formatId(state.id),
                })}
              />
              {!qrReady && (
                <p className={styles.metadata} role="status">
                  {translate("receivePage.preparingQr")}
                </p>
              )}
              {qrFailed && (
                <p role="status">{translate("receivePage.qrFailed")}</p>
              )}
            </div>
            <p className={styles.qrCaption}>
              {translate("receivePage.scanQr")}
            </p>
          </div>
        </section>
        {!hasTransfer && (
          <p className={styles.transferHint}>{translate("keepPageOpen")}</p>
        )}
      </div>

      {files && hasTransfer && (
        <section
          ref={transferPanel}
          tabIndex={-1}
          className={styles.card + " " + styles.receiveFile}
          data-phase={transfer?.phase}
          aria-label={translate("receivePage.transferLabel")}
        >
          <h2 className={styles.cardTitle} aria-live="polite">
            {transfer?.phase === "incoming"
              ? translate("receivePage.incoming")
              : received
                ? translate("receivePage.received")
                : transfer?.phase === "ended"
                  ? translate("transferEnded")
                  : translate("receivingFiles")}
          </h2>
          <p
            className={styles.fileSummary}
            title={files.length === 1 ? files[0].name : undefined}
          >
            {files.length === 1
              ? files[0].name
              : translate("fileCount", { count: files.length })}
          </p>
          <p className={styles.metadata}>
            {bytesLabel(totalBytes)}
            {transfer &&
              translate("receivePage.senderSummary", {
                id: formatId(transfer.transfer.senderId),
              })}
          </p>

          {transfer?.phase === "incoming" && (
            <div className={styles.decisionActions}>
              <button
                type="button"
                className={styles.button}
                onClick={() => decide(true)}
                disabled={state.connection !== "online"}
              >
                <Icon name="receive" size={20} />{" "}
                {translate("receivePage.accept")}
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => decide(false)}
                disabled={state.connection !== "online"}
              >
                {translate("receivePage.reject")}
              </button>
            </div>
          )}
          {loading && (
            <TransferProgress
              transfer={transfer}
              totalBytes={totalBytes}
              onCancel={cancel}
            />
          )}
          {received && (
            <>
              <p className={styles.success}>
                {files.length > 1
                  ? translate("receivePage.archiveReady")
                  : translate("receivePage.fileReady")}
              </p>
              <a
                className={styles.sendButton}
                href={received.url}
                download={received.file.name}
              >
                <Icon name="receive" size={20} />{" "}
                {translate("receivePage.save")}
              </a>
            </>
          )}
          {transfer?.phase === "ended" && (
            <p role="status">
              {transfer.message && translate(transfer.message)}
            </p>
          )}
          {files.length > 1 && (
            <div className={styles.transferFiles}>
              <FileList files={files} />
              {!received && transfer?.phase !== "ended" && (
                <p className={styles.metadata}>
                  {translate("receivePage.saveZip")}
                </p>
              )}
            </div>
          )}
          {transfer?.phase === "incoming" && (
            <p className={styles.transferHint}>
              {translate("receivePage.consent")}
            </p>
          )}
        </section>
      )}
    </>
  );
};
