export type Locale = "en" | "ru";

const languagePreference =
  /^([a-z]{1,8}(?:-[a-z\d]{1,8})*|\*)\s*(?:;\s*q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?$/iu;

export const resolveLocale = (acceptLanguage: string | null): Locale => {
  let language = "";
  let weight = 0;

  for (const entry of (acceptLanguage ?? "").split(",")) {
    const match = languagePreference.exec(entry.trim());

    if (!match) continue;

    const priority = Number(match[2] ?? "1");

    if (priority > weight) {
      language = match[1].toLowerCase();
      weight = priority;
    }
  }

  return language.split("-")[0] === "ru" ? "ru" : "en";
};
