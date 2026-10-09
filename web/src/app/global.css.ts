import { globalStyle } from "@vanilla-extract/css";

globalStyle("*", { boxSizing: "border-box" });
globalStyle("body", {
  margin: 0,
  background: "#f4f6f0",
  color: "#193c2e",
  fontFamily: "system-ui, sans-serif",
  lineHeight: 1.6,
});
globalStyle("a", { color: "#176449", textUnderlineOffset: 4 });
globalStyle("h1, h2", {
  lineHeight: 1.2,
  letterSpacing: "-0.025em",
  margin: "0 0 20px",
});
globalStyle("h1", { fontSize: "clamp(1.65rem, 4vw, 2.2rem)" });
globalStyle("h2", { fontSize: "1.3rem" });
globalStyle("button", {
  cursor: "pointer",
  border: 0,
  background: "#176449",
  color: "white",
  padding: "12px 20px",
  borderRadius: 10,
  font: "inherit",
  fontSize: 15,
  fontWeight: 600,
  minHeight: 46,
});
globalStyle("button:disabled", { opacity: 0.45, cursor: "not-allowed" });
globalStyle("button:hover:not(:disabled)", { filter: "brightness(0.94)" });
globalStyle("input", {
  display: "block",
  width: "100%",
  margin: "8px 0 20px",
  padding: "12px 14px",
  border: "1px solid #c9d5ca",
  borderRadius: 10,
  background: "white",
  color: "#193c2e",
  font: "inherit",
  minHeight: 46,
});
globalStyle("input[type=file]", { padding: 12, fontSize: 14 });
globalStyle("label", {
  display: "block",
  fontSize: 14,
  fontWeight: 600,
  marginTop: 20,
});
globalStyle("progress", { width: "100%", height: 12, accentColor: "#19734c" });
globalStyle(":focus-visible", {
  outline: "3px solid #7abb85",
  outlineOffset: 4,
});
globalStyle("p", { overflowWrap: "anywhere" });
