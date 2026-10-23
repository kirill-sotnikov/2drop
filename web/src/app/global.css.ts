import { globalStyle } from "@vanilla-extract/css";

globalStyle("*", { boxSizing: "border-box" });
globalStyle("html", { colorScheme: "dark", background: "#17212a" });

globalStyle("body", {
  margin: 0,
  background: "#17212a",
  color: "#f5f7fa",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  lineHeight: 1.5,
  WebkitFontSmoothing: "antialiased",
});

globalStyle("a", { color: "#39adff", textUnderlineOffset: 4 });

globalStyle("h1, h2", {
  lineHeight: 1.2,
  letterSpacing: "-0.025em",
  margin: "0 0 16px",
});

globalStyle("h1", { fontSize: "clamp(1.5rem, 4vw, 2rem)" });

globalStyle("h2", { fontSize: "1.25rem", fontWeight: 600 });

globalStyle("button", {
  cursor: "pointer",
  border: 0,
  background: "#32a7f5",
  color: "#ffffff",
  padding: "13px 20px",
  borderRadius: 14,
  font: "inherit",
  fontSize: 15,
  fontWeight: 600,
  minHeight: 48,
  transition: "background 150ms ease, filter 150ms ease",
});

globalStyle("button:disabled", { opacity: 0.45, cursor: "not-allowed" });

globalStyle("button:hover:not(:disabled)", { filter: "brightness(1.1)" });

globalStyle("input", {
  display: "block",
  width: "100%",
  margin: "8px 0 18px",
  padding: "14px 16px",
  border: "1px solid #405362",
  borderRadius: 14,
  background: "#192630",
  color: "#f5f7fa",
  font: "inherit",
  minHeight: 50,
});

globalStyle("input::placeholder", { color: "#879cab", opacity: 1 });

globalStyle("input[type=file]", { padding: 12, fontSize: 14 });

globalStyle("input::file-selector-button", {
  background: "#28465c",
  color: "#7bceff",
  border: 0,
  borderRadius: 8,
  padding: "8px 12px",
  marginRight: 12,
  cursor: "pointer",
});

globalStyle("label", {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  color: "#b3c4d2",
  marginTop: 20,
});

globalStyle("progress", { width: "100%", height: 10, accentColor: "#32a7f5" });

globalStyle(":focus-visible", {
  outline: "3px solid #70c8ff",
  outlineOffset: 4,
});

globalStyle("p", { overflowWrap: "anywhere" });

globalStyle("a, button, input", { WebkitTapHighlightColor: "transparent" });
