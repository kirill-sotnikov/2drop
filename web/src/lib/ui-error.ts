import type en from "../content/en.json";

export type ErrorKey =
  `errors.${keyof typeof en.errors}` | "recipientUnavailable";

export type StatusKey = ErrorKey | "fileSent" | "transferProgress.cancelling";

export class UiError extends Error {
  constructor(readonly key: ErrorKey) {
    super(key);
  }
}
