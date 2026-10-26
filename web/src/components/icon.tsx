import { type CSSProperties } from "react";

type IconName =
  | "send"
  | "receive"
  | "qr"
  | "shield"
  | "arrow"
  | "file"
  | "copy"
  | "check"
  | "refresh";

export const Icon = ({
  name,
  size = 24,
  style,
}: {
  readonly name: IconName;
  readonly size?: number;
  readonly style?: CSSProperties;
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {name === "send" && (
        <>
          <path d="m21 3-7 18-4-7-7-4 18-7Z" />
          <path d="m10 14 5-5" />
        </>
      )}
      {name === "receive" && (
        <>
          <path d="M12 3v12m-5-5 5 5 5-5" />
          <path d="M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
        </>
      )}
      {name === "qr" && (
        <>
          <rect x="3" y="3" width="6" height="6" rx="1" />
          <rect x="15" y="3" width="6" height="6" rx="1" />
          <rect x="3" y="15" width="6" height="6" rx="1" />
          <path d="M15 15h2v2h4v4h-6v-2m6-6v2" />
        </>
      )}
      {name === "shield" && (
        <>
          <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
          <path d="m8.5 12 2.5 2.5 4.5-5" />
        </>
      )}
      {name === "arrow" && <path d="m9 5 7 7-7 7" />}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "refresh" && (
        <>
          <path d="M20 7v5h-5" />
          <path d="M19.5 12a7.5 7.5 0 1 0-2 5.5" />
        </>
      )}
      {name === "copy" && (
        <>
          <rect x="8" y="8" width="12" height="13" rx="2" />
          <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" />
        </>
      )}
      {name === "file" && (
        <>
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" />
          <path d="M14 3v6h6M8 14h8m-8 3h5" />
        </>
      )}
    </svg>
  );
};
