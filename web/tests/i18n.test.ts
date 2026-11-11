import assert from "node:assert/strict";
import { test } from "node:test";
import { createTranslator } from "next-intl";
import en from "../src/content/en.json";
import ru from "../src/content/ru.json";
import { resolveLocale } from "../src/i18n/locale";

test("locale follows the highest-priority browser language", () => {
  const cases = [
    [null, "en"],
    ["", "en"],
    ["ru", "ru"],
    ["RU-KZ, en;q=0.8", "ru"],
    ["ru;q=0, de", "en"],
    ["ru;q=0.4, en-GB;q=0.9", "en"],
    ["fr-CA, ru;q=0.9", "en"],
    ["*;q=1, ru;q=0.9", "en"],
    ["en, ru", "en"],
    ["en;q=invalid, ru", "ru"],
  ] as const;

  for (const [header, expected] of cases) {
    assert.equal(resolveLocale(header), expected, String(header));
  }
});

test("both dictionaries have the same keys and localize file plurals", () => {
  const paths = (messages: object): string[] =>
    Object.entries(messages).flatMap(([key, value]) =>
      typeof value === "string"
        ? [key]
        : paths(value).map((path) => `${key}.${path}`),
    );

  assert.deepEqual(new Set(paths(en)), new Set(paths(ru)));

  const translateEn = createTranslator({ locale: "en", messages: en });
  const translateRu = createTranslator({ locale: "ru", messages: ru });

  assert.equal(translateEn("fileList.more", { count: 1 }), "1 more file");
  assert.equal(translateEn("fileList.more", { count: 2 }), "2 more files");
  assert.equal(translateRu("fileList.more", { count: 1 }), "Ещё 1 файл");
  assert.equal(translateRu("fileList.more", { count: 2 }), "Ещё 2 файла");
  assert.equal(translateRu("fileList.more", { count: 5 }), "Ещё 5 файлов");
});
