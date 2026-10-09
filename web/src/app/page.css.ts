import { style } from "@vanilla-extract/css";

export const main = style({
  maxWidth: 1040,
  margin: "0 auto",
  padding: "32px 24px 48px",
  "@media": { "screen and (max-width: 600px)": { padding: "20px 16px 32px" } },
});
export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 20,
  marginBottom: 32,
});
export const logo = style({
  fontSize: 34,
  fontWeight: 850,
  letterSpacing: "-0.07em",
  color: "#143d32",
  textDecoration: "none",
});
export const dot = style({ color: "#13815a" });
export const connection = style({
  fontSize: 13,
  color: "#755b30",
  textAlign: "right",
  selectors: { '&[data-online="true"]': { color: "#19734c" } },
});
export const nav = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 24,
  paddingBottom: 20,
  borderBottom: "1px solid #d9e1da",
  marginBottom: 32,
});
export const myId = style({
  marginLeft: "auto",
  fontSize: 13,
  "@media": {
    "screen and (max-width: 500px)": { width: "100%", marginLeft: 0 },
  },
});
export const hero = style({ padding: "32px 0 40px" });
export const eyebrow = style({
  display: "block",
  color: "#19734c",
  textTransform: "uppercase",
  fontSize: 11,
  fontWeight: 750,
  letterSpacing: "0.14em",
  marginBottom: 16,
});
export const title = style({
  fontSize: "clamp(2.6rem, 7.4vw, 5rem)",
  fontWeight: 650,
  letterSpacing: "-0.055em",
  lineHeight: 1.05,
  margin: "0 0 24px",
});
export const description = style({
  fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
  maxWidth: 500,
  margin: 0,
  color: "#52645c",
});
export const grid = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
  "@media": { "screen and (max-width: 650px)": { gridTemplateColumns: "1fr" } },
});
export const card = style({
  background: "#fffefa",
  border: "1px solid #d9e1da",
  borderRadius: 20,
  padding: "clamp(20px, 4vw, 36px)",
  marginBottom: 24,
  minWidth: 0,
});
export const muted = style({ color: "#64736b", fontSize: 14 });
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
  padding: "12px 20px",
  borderRadius: 10,
  background: "#176449",
  color: "white",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 15,
  minHeight: 46,
});
export const secondary = style({ background: "#eef3ee", color: "#204d3c" });
export const textButton = style({
  background: "transparent",
  color: "#176449",
  padding: "8px 0",
  minHeight: 40,
  textDecoration: "underline",
  textUnderlineOffset: 4,
});
export const notice = style({
  padding: "16px 20px",
  background: "#fff1d8",
  borderRadius: 12,
  marginBottom: 24,
});
export const receive = style({
  textAlign: "center",
  maxWidth: 600,
  margin: "0 auto 24px",
});
export const qr = style({
  display: "block",
  maxWidth: "100%",
  height: "auto",
  margin: "24px auto",
  borderRadius: 12,
});
export const bigId = style({
  fontFamily: "monospace",
  fontWeight: 700,
  fontSize: "clamp(1.8rem, 6vw, 2.5rem)",
  letterSpacing: "0.08em",
  margin: "16px 0",
});
export const fileName = style({ overflowWrap: "anywhere" });
export const success = style({ color: "#19734c", fontWeight: 600 });
export const footer = style({ marginTop: 48, color: "#64736b", fontSize: 12 });
