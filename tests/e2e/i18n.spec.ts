import { expect, test } from "@playwright/test";

test("the same URLs render in Russian or English on the server", async ({
  request,
}) => {
  const cases = [
    { language: "ru-KZ, en;q=0.8", locale: "ru", text: "Отправить файл" },
    { language: "de-DE, ru;q=0.8", locale: "en", text: "Send a file" },
  ];

  for (const { language, locale, text } of cases) {
    const response = await request.get("/", {
      headers: { "Accept-Language": language },
    });

    expect(response.ok()).toBe(true);

    const html = await response.text();

    expect(html).toContain(`<html lang="${locale}"`);
    expect(html).toContain(text);
  }
});

test.use({ locale: "de-DE" });

test("a Russian invitation opens in English for the sender", async ({
  browser,
  page: sender,
}) => {
  const receiverContext = await browser.newContext({ locale: "ru-RU" });

  try {
    const receiver = await receiverContext.newPage();

    await receiver.goto("/receive");
    await expect(receiver.locator("html")).toHaveAttribute("lang", "ru");

    await expect(
      receiver.getByRole("img", { name: /QR для отправки/u }),
    ).toBeVisible();

    const invite = await receiver.evaluate(() => {
      const stored = sessionStorage.getItem("2drop.session.v1");

      if (!stored) throw new Error("Receiver session is missing");

      const session = JSON.parse(stored) as { id: string };

      return `/send?id=${session.id}`;
    });

    await sender.goto(invite);
    await expect(sender.locator("html")).toHaveAttribute("lang", "en");
    await expect(sender.getByText("Recipient is available")).toBeVisible();

    await sender.locator('input[type="file"]').setInputFiles({
      name: "hello.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    });

    await sender.getByRole("button", { name: "Send", exact: true }).click();
    await receiver.getByRole("button", { name: "Отклонить" }).click();

    await expect(
      sender.getByText("The recipient declined the transfer"),
    ).toBeVisible();
  } finally {
    await receiverContext.close();
  }
});
