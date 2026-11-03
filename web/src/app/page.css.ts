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

export const hero = style({ textAlign: "center", padding: "14px 0 34px" });

export const eyebrow = style({
  display: "block",
  color: "#92b0c5",
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 14,
});

export const title = style({
  fontSize: "clamp(2rem, 7.8vw, 3.65rem)",
  fontWeight: 650,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.025em",
  lineHeight: 1.15,
  margin: "0 0 12px",
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

export const cardTitle = style({ margin: 0, fontSize: 19 });

export const muted = style({ color: "#adc0cf", fontSize: 14 });

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
  fontSize: 15,
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
  fontSize: 13,
});

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

export const recipientHeading = style({ marginBottom: 0 });

export const recipientStatus = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
  margin: "0 0 16px",
  selectors: { "&:last-child": { marginBottom: 0 } },
});

globalStyle(`${recipientStatus} > p`, { margin: 0 });

export const refreshRecipient = style([copyId, { color: "#52b6f9" }]);

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

export const success = style({ color: "#64d5ad", fontWeight: 600 });

export const banner = style({
  position: "relative",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minHeight: 160,
  padding: "26px 30px",
  borderRadius: 26,
  background: "linear-gradient(110deg, #268df6 0%, #36b5f5 65%, #60d3ed 100%)",
  color: "white",
  marginBottom: 20,
});

export const bannerTitle = style({
  fontSize: "clamp(20px, 4vw, 25px)",
  lineHeight: 1.25,
  marginBottom: 10,
  fontWeight: 600,
});

export const bannerDescription = style({
  fontSize: 14,
  margin: 0,
  maxWidth: 300,
  color: "#f0faff",
});

export const illustration = style({
  position: "relative",
  flexShrink: 0,
  width: 140,
  height: 116,
  "@media": {
    "screen and (max-width: 400px)": {
      width: 80,
      transform: "scale(0.8)",
      transformOrigin: "right center",
    },
  },
});

export const paperBack = style({
  position: "absolute",
  top: 10,
  right: 4,
  width: 73,
  height: 95,
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
  right: 40,
  width: 73,
  height: 95,
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
  fontSize: 15,
  fontWeight: 500,
  margin: "0 0 3px",
});

export const infoText = style({ color: "#adc0cf", fontSize: 13, margin: 0 });

export const footer = style({
  marginTop: 28,
  textAlign: "center",
  color: "#92a9ba",
  fontSize: 12,
});

const spin = keyframes({ to: { transform: "rotate(360deg)" } });

export const spinner = style({
  width: 18,
  height: 18,
  borderRadius: "50%",
  border: "2px solid rgba(255, 255, 255, 0.35)",
  borderTopColor: "white",
  animation: `${spin} 800ms linear infinite`,
  "@media": { "(prefers-reduced-motion: reduce)": { animation: "none" } },
});

export const loadingButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  selectors: { "&:disabled": { opacity: 1, cursor: "wait" } },
});
