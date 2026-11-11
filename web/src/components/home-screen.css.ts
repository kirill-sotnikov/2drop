import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import { pageLoader } from "../app/page.css";

const ink = "#20221c";
const paper = "#fffef7";
const lime = "#dafa35";
const border = `2px solid ${ink}`;
const mobile = "screen and (max-width: 700px)";
const narrow = "screen and (max-width: 380px)";
const motion = "(prefers-reduced-motion: no-preference)";
const hoverMotion = `${motion} and (hover: hover) and (pointer: fine)`;
const easeOut = "cubic-bezier(0.22, 1, 0.36, 1)";
const reveal = keyframes({
  from: { opacity: 0, transform: "translateY(12px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});
const underline = keyframes({
  from: { transform: "rotate(-2deg) scaleX(0)" },
  to: { transform: "rotate(-2deg) scaleX(1)" },
});

export const main = style({
  minHeight: "100svh",
  padding: "0 36px",
  backgroundColor: "#f8f9ee",
  backgroundImage: "radial-gradient(#353b2817 0.8px, transparent 0.8px)",
  backgroundSize: "18px 18px",
  color: ink,
  colorScheme: "light",
  fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
  "@media": { [mobile]: { padding: "0 20px" } },
});

export const header = style({
  maxWidth: 1080,
  margin: "0 auto",
  minHeight: 102,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 20,
  borderBottom: "1px solid #20221c30",
  "@media": {
    [mobile]: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr)",
      minHeight: 0,
      gap: 14,
      padding: "16px 0 12px",
    },
  },
});
export const logo = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  color: ink,
  textDecoration: "none",
  fontSize: 30,
  fontWeight: 800,
  letterSpacing: "-0.07em",
  "@media": {
    [mobile]: { fontSize: 26, gap: 8 },
    [narrow]: { fontSize: 24, gap: 6 },
  },
});
export const logoMark = style({
  display: "grid",
  placeItems: "center",
  width: 40,
  height: 40,
  border,
  borderRadius: 12,
  background: lime,
  boxShadow: `2px 2px 0 ${ink}`,
  transform: "rotate(-7deg)",
  "@media": {
    [mobile]: { width: 34, height: 34, borderRadius: 10 },
    [motion]: { transition: `transform 300ms ${easeOut}` },
    [hoverMotion]: {
      selectors: { [`${logo}:hover &`]: { transform: "rotate(5deg)" } },
    },
  },
});
export const dot = style({ color: "#7b9230" });
export const nav = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  "@media": {
    [mobile]: {
      width: "100%",
      gap: 4,
      padding: 4,
      border,
      borderRadius: 15,
      background: "#edf0df",
    },
  },
});
export const navLink = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 44,
  padding: "8px 18px",
  borderRadius: 12,
  border: "2px solid transparent",
  color: ink,
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 600,
  selectors: {
    '&[aria-current="page"]': {
      border,
      background: paper,
      boxShadow: `2px 2px 0 ${ink}`,
    },
    "&:hover": { background: lime },
  },
  "@media": {
    [mobile]: {
      flex: 1,
      minHeight: 48,
      padding: "8px 10px",
      fontSize: 14,
      gap: 8,
      borderRadius: 10,
      selectors: { '&[aria-current="page"]': { background: lime } },
    },
    [motion]: {
      transition: `transform 180ms ${easeOut}, background 180ms ease`,
      ":active": { transform: "translateY(2px)" },
    },
    [hoverMotion]: { ":hover": { transform: "translateY(-2px)" } },
  },
});

export const content = style({
  maxWidth: 1080,
  margin: "0 auto",
  "@media": { [mobile]: { display: "flex", flexDirection: "column" } },
});
export const hero = style({
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr",
  alignItems: "center",
  gap: 16,
  padding: "45px 0 38px",
  "@media": {
    [mobile]: {
      order: 2,
      gridTemplateColumns: "1fr",
      gap: 0,
      padding: "28px 0 12px",
    },
  },
});
export const heroCopy = style({ position: "relative", zIndex: 1 });
export const title = style({
  margin: "0 0 24px",
  fontSize: "clamp(42px, 5.2vw, 66px)",
  lineHeight: 1.13,
  fontWeight: 800,
  letterSpacing: "-0.06em",
  "@media": {
    [mobile]: { fontSize: 32, marginBottom: 14 },
    [motion]: { animation: `${reveal} 650ms ${easeOut} backwards` },
  },
});
export const highlight = style({
  position: "relative",
  display: "inline-block",
  zIndex: 0,
  whiteSpace: "nowrap",
  "::before": {
    content: '""',
    position: "absolute",
    bottom: 1,
    left: -4,
    right: -7,
    height: "35%",
    background: lime,
    transform: "rotate(-2deg)",
    transformOrigin: "left center",
    zIndex: -1,
  },
  "@media": {
    [motion]: {
      "::before": {
        animation: `${underline} 550ms 250ms ${easeOut} backwards`,
      },
    },
  },
});
export const intro = style({
  maxWidth: 445,
  margin: "0 0 22px",
  fontSize: 16,
  lineHeight: 1.7,
  color: "#5c6053",
  "@media": {
    [motion]: { animation: `${reveal} 650ms 100ms ${easeOut} backwards` },
  },
});
export const artwork = style({
  position: "relative",
  width: "100%",
  maxWidth: 460,
  justifySelf: "end",
  "@media": {
    [mobile]: { maxWidth: 220, justifySelf: "center", margin: "4px 0 0" },
  },
});
globalStyle(`${artwork} > svg`, {
  display: "block",
  width: "100%",
  height: "auto",
});
export const artSticker = style({
  position: "absolute",
  right: "25%",
  bottom: "10%",
  padding: "8px 14px",
  border,
  borderRadius: 7,
  background: paper,
  boxShadow: `3px 3px 0 ${ink}`,
  fontSize: 13,
  fontWeight: 700,
  transform: "rotate(-8deg)",
});
export const actions = style({
  display: "grid",
  gridTemplateColumns: "1.15fr 1fr",
  gap: 24,
  "@media": {
    [mobile]: { order: 0, gridTemplateColumns: "1fr", gap: 20, marginTop: 20 },
  },
});
const card = style({
  padding: 28,
  border,
  borderRadius: 24,
  boxShadow: `5px 5px 0 ${ink}`,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  "@media": {
    [mobile]: { padding: 23, borderRadius: 20 },
    [motion]: {
      animation: `${reveal} 600ms 180ms ${easeOut} backwards`,
      transition: `transform 220ms ${easeOut}, box-shadow 220ms ${easeOut}`,
    },
    [hoverMotion]: {
      ":hover": {
        transform: "translate(-2px, -3px)",
        boxShadow: `7px 8px 0 ${ink}`,
      },
    },
  },
});
export const sendCard = style([card, { background: "#ede8fa" }]);
export const receiveCard = style([
  card,
  {
    background: paper,
    "@media": {
      [motion]: { animationDelay: "280ms" },
      [mobile]: { display: "none" },
    },
  },
]);
export const cardHeading = style({
  display: "flex",
  alignItems: "center",
  gap: 13,
});
const icon = style({
  display: "grid",
  placeItems: "center",
  width: 49,
  height: 49,
  flexShrink: 0,
  border,
  borderRadius: 14,
  "@media": {
    [motion]: { transition: `transform 300ms ${easeOut}` },
  },
});
export const sendIcon = style([
  icon,
  {
    background: "#d5c6f3",
    transform: "rotate(-5deg)",
    "@media": {
      [motion]: {
        selectors: {
          [`${sendCard}:focus-within &`]: {
            transform: "translateY(-3px) rotate(4deg)",
          },
        },
      },
      [hoverMotion]: {
        selectors: {
          [`${sendCard}:hover &`]: {
            transform: "translateY(-3px) rotate(4deg)",
          },
        },
      },
    },
  },
]);
export const receiveIcon = style([
  icon,
  {
    background: "#cbead9",
    transform: "rotate(5deg)",
    "@media": {
      [hoverMotion]: {
        selectors: {
          [`${receiveCard}:hover &`]: {
            transform: "translateY(3px) rotate(-4deg)",
          },
        },
      },
    },
  },
]);
export const cardTitle = style({
  fontSize: 24,
  fontWeight: 750,
  margin: 0,
  letterSpacing: "-0.04em",
  "@media": { [mobile]: { fontSize: 22 } },
});
export const description = style({
  color: "#5c5e54",
  fontSize: 14,
  lineHeight: 1.6,
  margin: "20px 0",
});
export const label = style({
  color: ink,
  margin: "auto 0 8px",
  fontSize: 12,
  fontWeight: 600,
});
export const inputRow = style({
  display: "flex",
  alignItems: "stretch",
  gap: 10,
  "@media": {
    "screen and (max-width: 1000px) and (min-width: 701px), screen and (max-width: 440px)":
      { flexDirection: "column" },
  },
});
export const recipient = style({
  minWidth: 0,
  flex: 1,
  margin: 0,
  padding: "14px 12px",
  minHeight: 54,
  border,
  borderRadius: 11,
  color: ink,
  background: paper,
  fontSize: 17,
  fontWeight: 600,
  letterSpacing: "0.06em",
  ":focus": { outline: `2px solid ${ink}`, outlineOffset: 3 },
  "::placeholder": { color: "#838577", opacity: 1 },
  selectors: { '&[aria-invalid="true"]': { borderColor: "#aa2945" } },
});
export const cardButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  flexShrink: 0,
  minHeight: 54,
  padding: "12px 18px",
  border,
  borderRadius: 11,
  background: lime,
  color: ink,
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 700,
  boxShadow: `2px 3px 0 ${ink}`,
  ":hover": { background: "#e4ff57", filter: "none" },
  "@media": {
    [motion]: {
      transition: `transform 180ms ${easeOut}, box-shadow 180ms ease, background 180ms ease`,
      ":active": {
        transform: "translate(2px, 2px)",
        boxShadow: `0 1px 0 ${ink}`,
      },
    },
    [hoverMotion]: {
      selectors: {
        "&:hover:not(:active)": {
          transform: "translateY(-2px)",
          boxShadow: `2px 5px 0 ${ink}`,
        },
      },
    },
  },
});
export const receiveButton = style([
  cardButton,
  {
    width: "100%",
    marginTop: "auto",
    background: paper,
    justifyContent: "flex-start",
    gap: 10,
    ":hover": { background: "#eef6d4" },
  },
]);
export const error = style({
  margin: "12px 0 0",
  color: "#9b233e",
  fontSize: 13,
});
export const infoRow = style({
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "23px 26px",
  marginTop: 28,
  border: "1px solid #20221c35",
  borderRadius: 18,
  background: "#f0f2e3",
  "@media": {
    [motion]: { animation: `${reveal} 600ms 380ms ${easeOut} backwards` },
    [mobile]: { order: 1, padding: "16px 18px", marginTop: 20 },
  },
});
export const shieldIcon = style({
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  width: 42,
  height: 42,
  background: lime,
  border: `1.5px solid ${ink}`,
  borderRadius: "50%",
});
export const infoTitle = style({
  margin: "0 0 4px",
  fontSize: 14,
  fontWeight: 700,
});
export const infoText = style({ margin: 0, color: "#626657", fontSize: 12 });
export const infoDoodle = style({
  marginLeft: "auto",
  fontSize: 40,
  lineHeight: 1,
  "@media": { [mobile]: { display: "none" } },
});
export const footer = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  maxWidth: 1080,
  margin: "26px auto 0",
  padding: "0 0 22px",
  color: "#626657",
  fontSize: 11,
  "@media": {
    [mobile]: {
      flexDirection: "column",
      gap: 0,
      textAlign: "center",
      marginTop: 20,
    },
  },
});
globalStyle(`${main}:has(> div > ${pageLoader}) > ${footer}`, {
  display: "none",
});
export const footerButton = style({
  minHeight: 44,
  padding: "8px 0",
  background: "transparent",
  color: ink,
  fontSize: 11,
  fontWeight: 500,
  textDecoration: "underline",
  textUnderlineOffset: 4,
});
export const notice = style({
  maxWidth: 1080,
  margin: "20px auto",
  padding: 18,
  border,
  borderRadius: 14,
  background: "#ffe5b6",
  color: ink,
});
globalStyle(`${main} :focus-visible`, {
  outline: `3px solid ${ink}`,
  outlineOffset: 4,
});
