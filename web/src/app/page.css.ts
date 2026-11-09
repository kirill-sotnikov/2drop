import { globalStyle, keyframes, style } from "@vanilla-extract/css";

export const main = style({
  maxWidth: 792,
  margin: "0 auto",
  padding: "28px 24px 140px",
  "@media": { "screen and (max-width: 600px)": { padding: "20px 16px 140px" } },
});

export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 32,
});

export const logo = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  fontSize: 25,
  fontWeight: 750,
  letterSpacing: "-0.06em",
  color: "#f5f7fa",
  textDecoration: "none",
});

export const logoMark = style({
  display: "grid",
  placeItems: "center",
  width: 36,
  height: 36,
  background: "#2fa8f5",
  borderRadius: 12,
  color: "white",
});

export const dot = style({ color: "#39adff" });

export const backLink = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 44,
  marginBottom: 12,
  textDecoration: "none",
  fontSize: 15,
  fontWeight: 500,
  ":hover": { color: "#7bceff" },
});

export const connection = style({
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontSize: 12,
  color: "#eac48b",
  textAlign: "right",
  "::before": {
    content: '""',
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "currentColor",
    flexShrink: 0,
  },
  selectors: { '&[data-online="true"]': { color: "#64d5ad" } },
});

export const nav = style({
  position: "fixed",
  bottom: "max(20px, env(safe-area-inset-bottom))",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 10,
  display: "flex",
  alignItems: "center",
  gap: 6,
  width: "calc(100% - 32px)",
  maxWidth: 570,
  padding: 7,
  border: "1px solid #31516b",
  borderRadius: 30,
  background: "rgba(18, 48, 72, 0.94)",
  backdropFilter: "blur(20px)",
  boxShadow: "0 8px 32px #07121a60",
});

export const navLink = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  flex: 1,
  minHeight: 54,
  borderRadius: 23,
  textDecoration: "none",
  color: "#b7ccdc",
  fontSize: 14,
  fontWeight: 500,
  selectors: {
    '&[aria-current="page"]': { background: "#284b66", color: "#47b6ff" },
  },
  ":hover": { background: "#25435a" },
});

export const grid = style({
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr",
  gap: 16,
  marginBottom: 20,
  "@media": { "screen and (max-width: 600px)": { gridTemplateColumns: "1fr" } },
});

export const card = style({
  background: "#22323f",
  borderRadius: 26,
  padding: "clamp(22px, 4vw, 30px)",
  marginBottom: 20,
  minWidth: 0,
});

export const actionCard = style([
  card,
  {
    marginBottom: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
  },
]);

export const cardHeading = style({
  display: "flex",
  alignItems: "center",
  gap: 12,
});

export const actionIcon = style({
  display: "grid",
  placeItems: "center",
  width: 42,
  height: 42,
  flexShrink: 0,
  borderRadius: 14,
  background: "#2a4559",
  color: "#3bb0ff",
});

export const cardTitle = style({ margin: 0, fontSize: 20 });

export const muted = style({ color: "#adc0cf", fontSize: 16 });

export const metadata = style({ color: "#adc0cf", fontSize: 14 });

export const transferHint = style({
  color: "#adc0cf",
  fontSize: 14,
  margin: "16px 0 0",
});

export const actions = style({
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  alignItems: "center",
  margin: "20px 0",
});

export const button = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "13px 20px",
  borderRadius: 14,
  background: "#32a7f5",
  color: "white",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 16,
  minHeight: 48,
  ":hover": { filter: "brightness(1.1)" },
});

export const secondary = style({ background: "#2a4559", color: "#56bbff" });

export const cardButton = style({ marginTop: "auto", width: "100%" });

export const textButton = style({
  background: "transparent",
  color: "#52b6f9",
  padding: "8px 0",
  minHeight: 40,
  fontSize: 14,
});

export const fileListToggle = style([
  textButton,
  { display: "block", minHeight: 44, padding: "8px 0" },
]);

export const notice = style({
  padding: "16px 20px",
  background: "#493e31",
  color: "#ffdcab",
  borderRadius: 18,
  marginBottom: 24,
});

export const receiveFile = style({
  maxWidth: 600,
  margin: "0 auto 24px",
  "@media": {
    "screen and (min-width: 768px)": { maxWidth: "100%" },
  },
});

globalStyle(`${receiveFile} > :last-child`, { marginBottom: 0 });

export const receive = style({
  textAlign: "center",
  maxWidth: 600,
  margin: "0 auto 24px",
  "@media": {
    "screen and (min-width: 768px)": {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto",
      gridTemplateAreas: '"description qr" "id qr"',
      columnGap: 24,
      alignContent: "center",
      maxWidth: "100%",
      textAlign: "left",
    },
  },
});

export const receiveDescription = style({
  "@media": {
    "screen and (min-width: 768px)": {
      gridArea: "description",
      alignSelf: "end",
      margin: "0 0 16px",
    },
  },
});

export const qr = style({
  display: "block",
  maxWidth: "100%",
  height: "auto",
  margin: "26px auto",
  borderRadius: 18,
  border: "10px solid white",
  boxSizing: "content-box",
  width: "min(256px, calc(100% - 20px))",
  "@media": {
    "screen and (min-width: 768px)": {
      gridArea: "qr",
      width: 256,
      margin: 0,
    },
  },
});

export const idRow = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "clamp(6px, 2vw, 12px)",
  margin: "20px 0",
  "@media": {
    "screen and (min-width: 768px)": {
      gridArea: "id",
      alignSelf: "start",
      justifyContent: "flex-start",
      gap: 8,
      margin: 0,
    },
  },
});

export const idLabel = style({
  color: "#92a9ba",
  fontSize: 14,
  whiteSpace: "nowrap",
});

export const bigId = style({
  fontWeight: 650,
  fontSize: "clamp(1.125rem, 5.5vw, 2.3rem)",
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.06em",
  whiteSpace: "nowrap",
  "@media": {
    "screen and (min-width: 768px)": { fontSize: 26 },
  },
});

export const copyId = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: 44,
  minHeight: 44,
  padding: 0,
  background: "transparent",
  color: "#adc0cf",
  ":hover": { color: "#f5f7fa" },
});

export const recipientHeading = style({
  marginBottom: 0,
  fontSize: 24,
  fontVariantNumeric: "tabular-nums",
});

export const recipientLabel = style({
  display: "block",
  marginBottom: 6,
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: 0,
  color: "#adc0cf",
});

export const recipientStatus = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
  margin: "8px 0 20px",
  fontSize: 14,
  color: "#adc0cf",
  selectors: { "&:last-child": { marginBottom: 0 } },
});

globalStyle(`${recipientStatus} > p`, { margin: 0 });

export const refreshRecipient = style([copyId, { color: "#52b6f9" }]);

export const dropZone = style({
  position: "relative",
  display: "grid",
  justifyItems: "center",
  alignContent: "center",
  gap: 10,
  minHeight: "clamp(174px, 34vw, 224px)",
  margin: 0,
  padding: "20px 12px",
  borderRadius: 20,
  background: "#192a38",
  color: "#629bd2",
  textAlign: "center",
  selectors: {
    '&[data-compact="true"]': {
      minHeight: 104,
      gridTemplateColumns: "auto minmax(0, 1fr)",
      justifyContent: "center",
      justifyItems: "start",
      alignItems: "center",
      gap: 16,
      padding: "20px 24px",
      textAlign: "left",
    },
    "&:hover:has(input:enabled), &[data-dragging=true]:has(input:enabled)": {
      background: "#243e56",
      color: "#9bd6ff",
    },
    "&:has(input:focus-visible)": {
      outline: "3px solid #70c8ff",
      outlineOffset: 4,
    },
    "&:has(input:disabled)": {
      opacity: 0.5,
      cursor: "not-allowed",
    },
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

export const dropPrompt = style({
  color: "#f5f7fa",
  fontSize: 18,
  fontWeight: 600,
});

export const dropBrowse = style({
  display: "block",
  color: "#93ccff",
  fontSize: 16,
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
});

export const fileList = style({ padding: 0, margin: 0, listStyle: "none" });

export const fileRow = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "baseline",
  gap: 16,
  padding: "12px 0",
  borderBottom: "1px solid #344653",
  fontSize: 16,
});

export const fileSize = style({
  color: "#adc0cf",
  fontSize: 14,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
});

export const success = style({ color: "#64d5ad", fontWeight: 600 });

export const banner = style({
  position: "relative",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minHeight: 128,
  padding: "20px 24px",
  borderRadius: 26,
  background: "linear-gradient(110deg, #22394b, #254757)",
  color: "white",
  marginBottom: 20,
});

export const bannerTitle = style({
  fontSize: 20,
  lineHeight: 1.25,
  marginBottom: 8,
  fontWeight: 600,
});

export const bannerDescription = style({
  fontSize: 16,
  margin: 0,
  maxWidth: 440,
  color: "#adc0cf",
});

export const illustration = style({
  position: "relative",
  flexShrink: 0,
  width: 100,
  height: 88,
  "@media": {
    "screen and (max-width: 400px)": { display: "none" },
  },
});

export const paperBack = style({
  position: "absolute",
  top: 10,
  right: 4,
  width: 54,
  height: 70,
  borderRadius: 14,
  background: "#b8e6ff",
  border: "2px solid #e1f4ff",
  transform: "rotate(21deg)",
  boxShadow: "0 10px 20px #1476c52b",
});

export const paperFront = style({
  position: "absolute",
  display: "grid",
  placeItems: "center",
  top: 6,
  right: 30,
  width: 54,
  height: 70,
  borderRadius: 14,
  background: "linear-gradient(145deg, #fff, #d2e6ff)",
  border: "2px solid white",
  color: "#53a9ee",
  transform: "rotate(-14deg)",
  boxShadow: "0 10px 24px #1476c540",
});

export const infoRow = style({
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "18px 22px",
  background: "#22323f",
  borderRadius: 22,
});

export const shieldIcon = style([
  actionIcon,
  { background: "#254b46", color: "#68dcb5", borderRadius: "50%" },
]);

export const infoTitle = style({
  fontSize: 16,
  fontWeight: 500,
  margin: "0 0 3px",
});

export const infoText = style({ color: "#adc0cf", fontSize: 14, margin: 0 });

export const footer = style({
  marginTop: 28,
  textAlign: "center",
  color: "#92a9ba",
  fontSize: 14,
});

const spin = keyframes({ to: { transform: "rotate(360deg)" } });

export const spinner = style({
  width: 16,
  height: 16,
  flexShrink: 0,
  borderRadius: "50%",
  border: "2px solid rgba(255, 255, 255, 0.35)",
  borderTopColor: "#52b6f9",
  animation: `${spin} 800ms linear infinite`,
  "@media": { "(prefers-reduced-motion: reduce)": { animation: "none" } },
});

export const pageLoader = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  minHeight: "max(260px, calc(100svh - 200px))",
  color: "#adc0cf",
  fontSize: 16,
  textAlign: "center",
});

export const pageSpinner = style([
  spinner,
  { width: 40, height: 40, borderWidth: 3 },
]);

export const transferProgress = style({ marginTop: 24 });

export const progressHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 12,
});

export const progressStatus = style({
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
  fontSize: 16,
  fontWeight: 500,
});

export const progressPercent = style({
  flexShrink: 0,
  color: "#70c8ff",
  fontSize: 20,
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
});

export const progressTrack = style({
  height: 10,
  overflow: "hidden",
  borderRadius: 999,
  background: "#152631",
  marginBottom: 16,
});

const progressSweep = keyframes({
  from: { transform: "translateX(-100%)" },
  to: { transform: "translateX(300%)" },
});

export const progressFill = style({
  height: "100%",
  borderRadius: "inherit",
  background: "linear-gradient(90deg, #269ff2, #70c8ff)",
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
  color: "#adc0cf",
  fontSize: 14,
  fontVariantNumeric: "tabular-nums",
});
