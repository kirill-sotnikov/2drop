import { keyframes, style } from "@vanilla-extract/css";
import * as page from "../app/page.css";

const motion = "(prefers-reduced-motion: no-preference)";
const hoverMotion = `${motion} and (hover: hover) and (pointer: fine)`;
const easeOut = "cubic-bezier(0.22, 1, 0.36, 1)";

const reveal = keyframes({
  from: { opacity: 0, transform: "translateY(16px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const entrance = style({
  "@media": {
    [motion]: { animation: `${reveal} 560ms ${easeOut} backwards` },
  },
});

const actionCard = style([
  page.actionCard,
  entrance,
  {
    "@media": {
      [motion]: {
        transition: "background 220ms ease, box-shadow 220ms ease",
      },
      "(hover: hover) and (pointer: fine)": {
        ":hover": {
          background: "#263947",
          boxShadow: "0 10px 28px #07121a24",
        },
      },
    },
  },
]);

export const sendCard = style([actionCard]);

export const receiveCard = style([
  actionCard,
  { "@media": { [motion]: { animationDelay: "80ms" } } },
]);

export const banner = style([
  page.banner,
  entrance,
  { "@media": { [motion]: { animationDelay: "160ms" } } },
]);

export const infoRow = style([
  page.infoRow,
  entrance,
  { "@media": { [motion]: { animationDelay: "240ms" } } },
]);

const interactiveIcon = style({
  "@media": {
    [motion]: { transition: `transform 320ms ${easeOut}` },
  },
});

export const sendIcon = style([
  page.actionIcon,
  interactiveIcon,
  {
    "@media": {
      [motion]: {
        selectors: {
          [`${sendCard}:focus-within &`]: {
            transform: "translate(3px, -3px) rotate(-6deg)",
          },
        },
      },
      [hoverMotion]: {
        selectors: {
          [`${sendCard}:hover &`]: {
            transform: "translate(3px, -3px) rotate(-6deg)",
          },
        },
      },
    },
  },
]);

export const receiveIcon = style([
  page.actionIcon,
  interactiveIcon,
  {
    "@media": {
      [motion]: {
        selectors: {
          [`${receiveCard}:focus-within &`]: { transform: "translateY(3px)" },
        },
      },
      [hoverMotion]: {
        selectors: {
          [`${receiveCard}:hover &`]: { transform: "translateY(3px)" },
        },
      },
    },
  },
]);

export const recipient = style({
  ":focus": {
    borderColor: "#70c8ff",
    boxShadow: "0 0 0 3px #39adff1f",
  },
  "@media": {
    [motion]: {
      transition: "border-color 180ms ease, box-shadow 180ms ease",
    },
  },
});

export const cardButton = style([
  page.cardButton,
  {
    "@media": {
      [motion]: {
        transition: `transform 180ms ${easeOut}, background 180ms ease, filter 180ms ease`,
        ":active": { transform: "translateY(1px) scale(0.98)" },
      },
      [hoverMotion]: {
        selectors: {
          "&:hover:not(:active)": { transform: "translateY(-2px)" },
        },
      },
      "(prefers-reduced-motion: reduce)": { transition: "none" },
    },
  },
]);

const float = keyframes({
  "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
  "50%": { transform: "translateY(-6px) rotate(3deg)" },
});

export const illustration = style([
  page.illustration,
  {
    "@media": {
      [motion]: { animation: `${float} 2200ms ease-in-out 400ms 2` },
    },
  },
]);

export const error = style({
  "@media": {
    [motion]: { animation: `${reveal} 200ms ${easeOut}` },
  },
});
