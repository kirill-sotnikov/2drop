import { style } from "@vanilla-extract/css";

export const main = style({
  minHeight: "100svh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  maxWidth: 720,
  margin: "0 auto",
  padding: "48px 24px",
});

export const title = style({
  margin: "0 0 16px",
  fontSize: "clamp(3rem, 8vw, 5rem)",
  letterSpacing: "-0.05em",
  lineHeight: 1.1,
});

export const description = style({
  margin: 0,
  color: "#52606d",
  fontSize: "clamp(1.125rem, 3vw, 1.5rem)",
});
