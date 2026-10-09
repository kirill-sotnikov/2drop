import { globalStyle } from "@vanilla-extract/css";

globalStyle("*", {
  boxSizing: "border-box",
});

globalStyle("body", {
  margin: 0,
  background: "#f7f8fa",
  color: "#17202a",
  fontFamily: "system-ui, sans-serif",
  lineHeight: 1.5,
});
