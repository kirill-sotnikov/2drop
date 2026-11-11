import { globalStyle, keyframes, style } from "@vanilla-extract/css";

const ink = "#20221c";
const paper = "#fffef7";
const lime = "#dafa35";
const mutedInk = "#5c6053";
const border = `2px solid ${ink}`;
const mobile = "screen and (max-width: 700px)";
const motion = "(prefers-reduced-motion: no-preference)";
const hoverMotion = `${motion} and (hover: hover) and (pointer: fine)`;
const easeOut = "cubic-bezier(0.22, 1, 0.36, 1)";
const reveal = keyframes({
  from: { opacity: 0, transform: "translateY(12px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});
const appear = { animation: `${reveal} 460ms ${easeOut} backwards` };
const confirm = keyframes({
  from: { transform: "scale(0.7)" },
  "60%": { transform: "scale(1.12)" },
  to: { transform: "scale(1)" },
});

export const screen = style({
  maxWidth: 820,
  margin: "0 auto",
  padding: "26px 0 12px",
  "@media": { [mobile]: { paddingTop: 20 } },
});
export const backLink = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 44,
  marginBottom: 14,
  color: mutedInk,
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 500,
  ":hover": { color: ink },
  "@media": {
    [motion]: { transition: `transform 180ms ${easeOut}` },
    [hoverMotion]: { ":hover": { transform: "translateX(-3px)" } },
  },
});
export const pageHeading = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 20,
  marginBottom: 20,
  "@media": { [motion]: appear, [mobile]: { marginBottom: 16 } },
});
export const pageTitle = style({
  fontSize: "clamp(30px, 5vw, 44px)",
  fontWeight: 800,
  letterSpacing: "-0.055em",
  margin: "0 0 8px",
  "@media": { [mobile]: { fontSize: 28 } },
});
export const pageDescription = style({
  margin: 0,
  maxWidth: 530,
  color: mutedInk,
  fontSize: 15,
  lineHeight: 1.7,
});
export const headingIcon = style({
  display: "grid",
  placeItems: "center",
  width: 64,
  height: 64,
  flexShrink: 0,
  border,
  borderRadius: 18,
  background: lime,
  boxShadow: `3px 3px 0 ${ink}`,
  transform: "rotate(7deg)",
  "@media": {
    [mobile]: { width: 48, height: 48, borderRadius: 14 },
    "screen and (max-width: 380px)": { display: "none" },
  },
});
export const card = style({
  background: paper,
  border,
  borderRadius: 24,
  boxShadow: `5px 5px 0 ${ink}`,
  padding: "clamp(20px, 4vw, 32px)",
  marginBottom: 26,
  minWidth: 0,
  "@media": { [motion]: appear, [mobile]: { borderRadius: 20 } },
});
export const sendCard = style([card, { background: "#ede8fa" }]);
export const cardHeading = style({
  display: "flex",
  alignItems: "center",
  gap: 14,
  marginBottom: 18,
  minWidth: 0,
});
export const actionIcon = style({
  display: "grid",
  placeItems: "center",
  width: 46,
  height: 46,
  flexShrink: 0,
  border,
  borderRadius: 13,
  background: "#d5c6f3",
  transform: "rotate(-5deg)",
});
export const cardTitle = style({ fontSize: 23, fontWeight: 750, margin: 0 });
export const muted = style({ color: mutedInk, fontSize: 14, lineHeight: 1.65 });
export const metadata = style({ color: mutedInk, fontSize: 13 });
export const transferHint = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  color: mutedInk,
  fontSize: 12,
  margin: "20px 0 0",
});
export const actions = style({
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  alignItems: "center",
  margin: "24px 0 0",
});
export const button = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "13px 22px",
  border,
  borderRadius: 12,
  background: lime,
  color: ink,
  boxShadow: `2px 3px 0 ${ink}`,
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 14,
  minHeight: 50,
  ":hover": { background: "#e4ff57", filter: "none" },
  "@media": {
    [motion]: {
      transition: `transform 180ms ${easeOut}, box-shadow 180ms ease, background 180ms ease`,
      selectors: {
        "&:enabled:active, &:is(a):active": {
          transform: "translate(2px, 2px)",
          boxShadow: `0 1px 0 ${ink}`,
        },
      },
    },
    [hoverMotion]: {
      selectors: {
        "&:enabled:hover:not(:active), &:is(a):hover:not(:active)": {
          transform: "translateY(-2px)",
          boxShadow: `2px 5px 0 ${ink}`,
        },
      },
    },
  },
});
export const secondary = style([
  button,
  { background: paper, ":hover": { background: "#f0f2e3" } },
]);
export const sendButton = style([button, { width: "100%", marginTop: 22 }]);
export const textButton = style({
  background: "transparent",
  color: ink,
  padding: "8px 0",
  minHeight: 44,
  fontSize: 13,
  textDecoration: "underline",
  textUnderlineOffset: 4,
});
export const fileListToggle = style([textButton, { display: "block" }]);
export const receiveFile = style({
  scrollMarginTop: 16,
  selectors: { '&[data-phase="incoming"]': { background: "#fff3ce" } },
});
globalStyle(`${receiveFile} > :last-child`, { marginBottom: 0 });
export const receive = style([
  card,
  {
    background: "#e4f0e6",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
    alignItems: "center",
    gap: 36,
    "@media": { [mobile]: { gridTemplateColumns: "minmax(0, 1fr)", gap: 26 } },
  },
]);
export const qrPanel = style({
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 16,
});
export const qrFrame = style({
  width: "100%",
  maxWidth: 284,
  padding: 12,
  border,
  borderRadius: 20,
  background: "#fff",
  boxShadow: `4px 4px 0 ${ink}`,
});
export const qr = style({
  display: "block",
  width: "100%",
  height: "auto",
  aspectRatio: "1",
  borderRadius: 6,
});
export const connection = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  fontWeight: 600,
  color: mutedInk,
  "::before": {
    content: '""',
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#dacb9d",
    border: `1px solid ${ink}`,
    flexShrink: 0,
  },
  selectors: { '&[data-online="true"]::before': { background: lime } },
});
export const receiveDetails = style({ minWidth: 0 });
export const receiveDescription = style({
  margin: "12px 0 0",
  color: mutedInk,
  fontSize: 14,
  lineHeight: 1.7,
});
export const idLabel = style({
  display: "block",
  color: mutedInk,
  fontSize: 12,
  marginBottom: 8,
});
export const idRow = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "12px 14px",
  border,
  borderRadius: 12,
  background: paper,
});
export const bigId = style({
  fontWeight: 750,
  fontSize: "clamp(18px, 3vw, 26px)",
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.025em",
  whiteSpace: "nowrap",
});
export const copyId = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: 44,
  minHeight: 44,
  padding: 0,
  border: `1.5px solid ${ink}`,
  borderRadius: 10,
  background: lime,
  color: ink,
  ":hover": { background: "#e4ff57" },
  selectors: { '&[data-copied="true"]': { background: "#cbead9" } },
  "@media": { [motion]: { transition: "background 180ms ease" } },
});
globalStyle(`${copyId}[data-copied="true"] > svg`, {
  "@media": { [motion]: { animation: `${confirm} 300ms ${easeOut}` } },
});
export const recipientHeading = style({
  margin: 0,
  fontSize: "clamp(22px, 4vw, 28px)",
  fontWeight: 750,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.02em",
});
export const recipientLabel = style({
  display: "block",
  marginBottom: 4,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: 0,
  color: mutedInk,
});
export const recipientStatus = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  margin: "0 0 22px",
  fontSize: 13,
  color: mutedInk,
});
globalStyle(`${recipientStatus} > p`, { margin: 0 });
export const refreshRecipient = style([
  copyId,
  { background: paper, marginLeft: "auto" },
]);
export const emptyState = style({
  padding: "28px 18px",
  border: "1px solid #20221c30",
  borderRadius: 16,
  background: paper,
  textAlign: "center",
  color: mutedInk,
  fontSize: 14,
  lineHeight: 1.7,
});
export const dropZone = style({
  position: "relative",
  display: "grid",
  justifyItems: "center",
  alignContent: "center",
  gap: 18,
  minHeight: 236,
  margin: 0,
  padding: "28px 16px",
  borderRadius: 20,
  background: paper,
  color: ink,
  textAlign: "center",
  "@media": {
    [motion]: { transition: "background 200ms ease, opacity 200ms ease" },
    [mobile]: { minHeight: 142, gap: 12, padding: "20px 14px" },
  },
  selectors: {
    '&[data-compact="true"]': {
      minHeight: 110,
      gridTemplateColumns: "auto minmax(0, 1fr)",
      justifyItems: "start",
      alignItems: "center",
      gap: 16,
      padding: "20px 24px",
      textAlign: "left",
    },
    "&:hover:has(input:enabled), &[data-dragging=true]:has(input:enabled)": {
      background: "#f2f8d6",
    },
    "&:has(input:focus-visible)": {
      outline: `3px solid ${ink}`,
      outlineOffset: 4,
    },
    "&:has(input:disabled)": { opacity: 0.5, cursor: "not-allowed" },
  },
});
export const dropOutline = style({
  position: "absolute",
  inset: 1,
  width: "calc(100% - 2px)",
  height: "calc(100% - 2px)",
  overflow: "visible",
  pointerEvents: "none",
});
globalStyle(`${dropZone} > svg:not(${dropOutline})`, {
  "@media": { [motion]: { transition: `transform 260ms ${easeOut}` } },
});
globalStyle(
  `${dropZone}[data-dragging=true]:has(input:enabled) > svg:not(${dropOutline}), ${dropZone}:has(input:focus-visible) > svg:not(${dropOutline})`,
  { "@media": { [motion]: { transform: "translateY(-4px) rotate(-4deg)" } } },
);
globalStyle(`${dropZone}:hover:has(input:enabled) > svg:not(${dropOutline})`, {
  "@media": { [hoverMotion]: { transform: "translateY(-4px) rotate(-4deg)" } },
});
export const dropPrompt = style({ color: ink, fontSize: 18, fontWeight: 700 });
export const dropBrowse = style({
  display: "block",
  marginTop: 6,
  color: mutedInk,
  fontSize: 13,
  fontWeight: 500,
});
export const dropInput = style({
  position: "absolute",
  inset: 0,
  height: "100%",
  margin: 0,
  opacity: 0,
  cursor: "pointer",
  ":disabled": { pointerEvents: "none" },
});
export const visuallyHidden = style({
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
});
export const fileName = style({
  overflowWrap: "anywhere",
  listStyle: "none",
  fontWeight: 650,
});
export const fileList = style({
  padding: "0 16px",
  margin: 0,
  listStyle: "none",
  background: paper,
  border: "1px solid #20221c30",
  borderRadius: 14,
});
export const fileRow = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "baseline",
  gap: 16,
  padding: "14px 0",
  borderBottom: "1px solid #20221c20",
  fontSize: 14,
  selectors: { "&:last-child": { borderBottom: 0 } },
  "@media": { [motion]: { ...appear, animationDuration: "300ms" } },
});
export const fileSize = style({
  color: mutedInk,
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
});
export const success = style({
  color: "#28563c",
  background: "#e4f0e6",
  padding: "14px 16px",
  border: "1px solid #759c7e",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 600,
  "@media": { [motion]: appear },
});
export const error = style({
  color: "#92273c",
  background: "#ffe6e9",
  padding: "12px 16px",
  borderRadius: 12,
  fontSize: 13,
});
export const infoRow = style({
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "18px 22px",
  background: "#f0f2e3",
  border: "1px solid #20221c30",
  borderRadius: 16,
  marginTop: 24,
});
export const shieldIcon = style({
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  width: 40,
  height: 40,
  background: lime,
  border: `1.5px solid ${ink}`,
  borderRadius: "50%",
});
export const infoTitle = style({
  fontSize: 13,
  fontWeight: 700,
  margin: "0 0 3px",
});
export const infoText = style({ color: mutedInk, fontSize: 12, margin: 0 });
const spin = keyframes({ to: { transform: "rotate(360deg)" } });
export const spinner = style({
  width: 16,
  height: 16,
  flexShrink: 0,
  borderRadius: "50%",
  border: "2px solid #20221c25",
  borderTopColor: ink,
  animation: `${spin} 800ms linear infinite`,
  "@media": { "(prefers-reduced-motion: reduce)": { animation: "none" } },
});
export const pageLoader = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  minHeight: 320,
  color: mutedInk,
  fontSize: 14,
  textAlign: "center",
});
export const pageSpinner = style([
  spinner,
  { width: 40, height: 40, borderWidth: 3 },
]);
export const transferProgress = style({
  marginTop: 24,
  "@media": { [motion]: appear },
});
export const progressHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 14,
});
export const progressStatus = style({
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
  fontSize: 14,
  fontWeight: 600,
});
export const progressPercent = style({
  flexShrink: 0,
  fontSize: 22,
  fontWeight: 750,
  fontVariantNumeric: "tabular-nums",
});
export const progressTrack = style({
  height: 16,
  overflow: "hidden",
  border,
  borderRadius: 999,
  background: "#f0f2e3",
  marginBottom: 16,
});
const progressSweep = keyframes({
  from: { transform: "translateX(-100%)" },
  to: { transform: "translateX(300%)" },
});
export const progressFill = style({
  height: "100%",
  borderRadius: "inherit",
  background: lime,
  transition: "width 180ms ease-out",
  selectors: {
    '&[data-indeterminate="true"]': {
      width: "35%",
      animation: `${progressSweep} 1400ms ease-in-out infinite`,
    },
  },
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      transition: "none",
      selectors: { '&[data-indeterminate="true"]': { animation: "none" } },
    },
  },
});
export const progressBytes = style({
  margin: "0 0 20px",
  color: mutedInk,
  fontSize: 13,
  fontVariantNumeric: "tabular-nums",
});

export const desktopDropHint = style({
  "@media": { [mobile]: { display: "none" } },
});
globalStyle(`${dropZone} > svg:not(${dropOutline})`, {
  "@media": { [mobile]: { width: 40, height: 40 } },
});
export const removeFile = style({
  display: "grid",
  placeItems: "center",
  width: 44,
  minHeight: 44,
  padding: 0,
  borderRadius: 10,
  background: "transparent",
  color: ink,
  ":hover": { background: "#ffe6e9" },
});
export const fileSummary = style({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
  overflowWrap: "anywhere",
  fontSize: 16,
  fontWeight: 650,
  margin: "18px 0 8px",
});
export const transferFiles = style({ marginTop: 22 });
export const decisionActions = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginTop: 20,
  "@media": { "screen and (max-width: 360px)": { gridTemplateColumns: "1fr" } },
});
export const instructionsToggle = style({
  scrollMarginTop: 16,
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  minHeight: 52,
  padding: "12px 16px",
  marginBottom: 20,
  border,
  borderRadius: 12,
  background: paper,
  color: ink,
  textAlign: "left",
  fontSize: 14,
  fontWeight: 600,
});
globalStyle(`${instructionsToggle} > svg:last-child`, {
  marginLeft: "auto",
  flexShrink: 0,
});
export const toggleHint = style({
  color: mutedInk,
  fontSize: 12,
  fontWeight: 400,
  "@media": { [mobile]: { display: "none" } },
});
export const shareButton = style([button, { width: "100%", marginTop: 12 }]);
export const qrCaption = style({
  margin: 0,
  color: mutedInk,
  fontSize: 12,
  textAlign: "center",
});
