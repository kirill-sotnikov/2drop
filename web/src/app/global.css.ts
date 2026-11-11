import { globalStyle } from "@vanilla-extract/css";

globalStyle("*", { boxSizing: "border-box" });
globalStyle("html", { colorScheme: "light", background: "#f8f9ee" });

globalStyle("body", {
  margin: 0,
  background: "#f8f9ee",
  color: "#20221c",
  fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
  fontSize: 16,
  lineHeight: 1.5,
  WebkitFontSmoothing: "antialiased",
});

globalStyle("a", { color: "#20221c", textUnderlineOffset: 4 });

globalStyle("h1, h2", {
  lineHeight: 1.2,
  letterSpacing: "-0.025em",
  margin: "0 0 16px",
});

globalStyle("h1", { fontSize: 24 });

globalStyle("h2", { fontSize: "1.25rem", fontWeight: 600 });

globalStyle("button", {
  cursor: "pointer",
  border: 0,
  background: "#dafa35",
  color: "#20221c",
  padding: "13px 20px",
  borderRadius: 14,
  font: "inherit",
  fontSize: 16,
  fontWeight: 600,
  minHeight: 48,
  transition: "background 150ms ease, filter 150ms ease",
});

globalStyle("button:disabled", { opacity: 0.45, cursor: "not-allowed" });

globalStyle("button:hover:not(:disabled)", { filter: "brightness(1.02)" });

globalStyle("input", {
  display: "block",
  width: "100%",
  margin: "8px 0 18px",
  padding: "14px 16px",
  border: "1px solid #20221c",
  borderRadius: 14,
  background: "#fffef7",
  color: "#20221c",
  font: "inherit",
  minHeight: 50,
});

globalStyle("input::placeholder", { color: "#777b6d", opacity: 1 });

globalStyle("input[type=file]", { padding: 12, fontSize: 14 });

globalStyle("input::file-selector-button", {
  background: "#ede8fa",
  color: "#20221c",
  border: 0,
  borderRadius: 8,
  padding: "8px 12px",
  marginRight: 12,
  cursor: "pointer",
});

globalStyle("label", {
  display: "block",
  fontSize: 14,
  fontWeight: 500,
  color: "#5c6053",
  marginTop: 20,
});

globalStyle(":focus-visible", {
  outline: "3px solid #20221c",
  outlineOffset: 4,
});

globalStyle("p", { overflowWrap: "anywhere" });

globalStyle("a, button, input", { WebkitTapHighlightColor: "transparent" });
