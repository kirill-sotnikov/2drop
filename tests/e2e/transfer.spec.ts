import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";

async function getId(page: Page) {
  await expect(
    page.getByText("Готов к передаче", { exact: true }),
  ).toBeVisible();
  return (await page.locator("nav strong").innerText()).replaceAll("-", "");
}
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");

test("ID and socket survive client navigation and page reload; QR renders", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeSocket = WebSocket;
    globalThis.WebSocket = class extends NativeSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        if (String(url).endsWith("/ws"))
          (
            globalThis as typeof globalThis & { sessionSocket: WebSocket }
          ).sessionSocket = this;
      }
    };
  });
  await page.goto("/");
  const id = await getId(page);
  await page.getByRole("link", { name: "Получить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Покажите этот код" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /QR для отправки/ }),
  ).toHaveAttribute("width", "256");
  expect(await getId(page)).toBe(id);
  await page.getByRole("link", { name: "Отправить", exact: true }).click();
  expect(await getId(page)).toBe(id);
  await page.reload();
  expect(await getId(page)).toBe(id);
  await page.evaluate(() =>
    (
      globalThis as typeof globalThis & { sessionSocket: WebSocket }
    ).sessionSocket.close(),
  );
  await expect(
    page.getByText("Восстанавливаем соединение…", { exact: true }),
  ).toBeVisible();
  expect(await getId(page)).toBe(id);
  await page.getByRole("button", { name: "Обновить мой ID" }).click();
  await expect(page.locator("nav strong")).not.toHaveText(
    `${id.slice(0, 4)}-${id.slice(4)}`,
  );
});

test("two browsers transfer binary and empty files with consent, exact bytes and repeat use", async ({
  browser,
}) => {
  const receiverContext = await browser.newContext();
  const senderContext = await browser.newContext();
  try {
    const receiver = await receiverContext.newPage();
    const sender = await senderContext.newPage();
    const pageErrors: string[] = [];
    for (const page of [receiver, sender])
      page.on("pageerror", (error) => pageErrors.push(error.message));
    await receiver.goto("/receive");
    const id = await getId(receiver);
    await sender.addInitScript(() => {
      const slice = File.prototype.slice;
      const counters = globalThis as typeof globalThis & { fileReads: number };
      counters.fileReads = 0;
      File.prototype.slice = function (...args) {
        counters.fileReads++;
        return slice.apply(this, args);
      };
    });
    await sender.goto(`/send?id=${id}`);
    await expect(
      sender.getByText("Получатель доступен", { exact: true }),
    ).toBeVisible();
    for (const [name, payload] of [
      [
        "проверка 📦.bin",
        Buffer.from(Array.from({ length: 1_500_003 }, (_, i) => i % 256)),
      ],
      ["пустой.txt", Buffer.alloc(0)],
    ] as const) {
      await sender.getByLabel(/Один файл/).setInputFiles({
        name,
        mimeType: "application/octet-stream",
        buffer: payload,
      });
      await sender.getByRole("button", { name: "Предложить передачу" }).click();
      await expect(
        receiver.getByRole("button", { name: "Принять", exact: true }),
      ).toBeVisible();
      if (payload.length)
        expect(
          await sender.evaluate(
            () =>
              (globalThis as typeof globalThis & { fileReads: number })
                .fileReads,
          ),
        ).toBe(0);
      await expect(sender.getByLabel(/Один файл/)).toBeDisabled();
      await receiver
        .getByRole("button", { name: "Принять", exact: true })
        .click();
      await expect(
        sender.getByText("Файл получен получателем.", { exact: true }),
      ).toBeVisible();
      await expect(
        receiver.getByText(
          "Файл получен приложением. Теперь его можно сохранить.",
          { exact: true },
        ),
      ).toBeVisible();
      const downloadPromise = receiver.waitForEvent("download");
      await receiver
        .getByRole("link", { name: "Скачать", exact: true })
        .click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(name);
      const path = await download.path();
      expect(path).toBeTruthy();
      expect(hash(await readFile(path!))).toBe(hash(payload));
      await receiver
        .getByRole("button", { name: "Удалить из приложения" })
        .click();
      await expect(
        sender.getByText("Получатель доступен", { exact: true }),
      ).toBeVisible();
    }
    expect(pageErrors).toEqual([]);
  } finally {
    await receiverContext.close();
    await senderContext.close();
  }
});

test("receiver can reject, sender can cancel mid-file, then retry from the start", async ({
  browser,
}) => {
  const receiverContext = await browser.newContext();
  const senderContext = await browser.newContext();
  try {
    const receiver = await receiverContext.newPage();
    const sender = await senderContext.newPage();
    await receiver.goto("/receive");
    const id = await getId(receiver);
    await sender.addInitScript(() => {
      const read = Blob.prototype.arrayBuffer;
      Blob.prototype.arrayBuffer = async function () {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return read.call(this);
      };
    });
    await sender.goto(`/send?id=${id}`);
    await sender.getByLabel(/Один файл/).setInputFiles({
      name: "cancel.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(200_000, 7),
    });
    await sender.getByRole("button", { name: "Предложить передачу" }).click();
    await receiver
      .getByRole("button", { name: "Отклонить", exact: true })
      .click();
    await expect(
      sender.getByText("Получатель отклонил передачу.", { exact: true }),
    ).toBeVisible();
    await sender.getByRole("button", { name: "Предложить передачу" }).click();
    await receiver
      .getByRole("button", { name: "Принять", exact: true })
      .click();
    await expect(sender.getByRole("progressbar")).toBeVisible();
    await sender.getByRole("button", { name: "Отменить передачу" }).click();
    await expect(
      receiver.getByText("Передача отменена.", { exact: true }),
    ).toBeVisible();
    await expect(
      receiver.getByRole("link", { name: "Скачать", exact: true }),
    ).toHaveCount(0);
    await sender.getByRole("button", { name: "Предложить передачу" }).click();
    await receiver
      .getByRole("button", { name: "Принять", exact: true })
      .click();
    await expect(
      sender.getByText("Файл получен получателем.", { exact: true }),
    ).toBeVisible();
    await expect(
      receiver.getByRole("link", { name: "Скачать", exact: true }),
    ).toBeVisible();
  } finally {
    await receiverContext.close();
    await senderContext.close();
  }
});

test("mobile layout and invalid ID", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/send?id=invalid");
  await expect(
    page.getByRole("heading", { name: "Некорректный ID" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("text, image, archive, the 100 MB boundary and an oversized file", async ({
  browser,
}, testInfo) => {
  test.setTimeout(90_000);
  const receiverContext = await browser.newContext();
  const senderContext = await browser.newContext();
  try {
    const receiver = await receiverContext.newPage();
    const sender = await senderContext.newPage();
    await receiver.goto("/receive");
    const id = await getId(receiver);
    await sender.goto(`/send?id=${id}`);
    const samples = [
      {
        name: `документ-${"x".repeat(180)}.txt`,
        mimeType: "text/plain",
        buffer: Buffer.from("2drop — исходный текст\n"),
      },
      {
        name: "pixel.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          "base64",
        ),
      },
      {
        name: "empty.zip",
        mimeType: "application/zip",
        buffer: Buffer.from(
          "504b0506000000000000000000000000000000000000",
          "hex",
        ),
      },
    ];
    for (const sample of samples) {
      await sender.getByLabel(/Один файл/).setInputFiles(sample);
      await sender.getByRole("button", { name: "Предложить передачу" }).click();
      await receiver
        .getByRole("button", { name: "Принять", exact: true })
        .click();
      await expect(
        sender.getByText("Файл получен получателем.", { exact: true }),
      ).toBeVisible();
      const downloadPromise = receiver.waitForEvent("download");
      await receiver
        .getByRole("link", { name: "Скачать", exact: true })
        .click();
      const path = await (await downloadPromise).path();
      expect(hash(await readFile(path!))).toBe(hash(sample.buffer));
    }
    const boundaryPath = testInfo.outputPath("boundary.bin");
    const oversizedPath = testInfo.outputPath("oversized.bin");
    for (const [path, size] of [
      [boundaryPath, 100_000_000],
      [oversizedPath, 100_000_001],
    ] as const) {
      const handle = await open(path, "w");
      try {
        await handle.truncate(size);
        await handle.write(Buffer.from("2drop boundary test"), 0, 19, 0);
      } finally {
        await handle.close();
      }
    }
    await sender.getByLabel(/Один файл/).setInputFiles(oversizedPath);
    await expect(
      sender.getByText("Этот файл превышает лимит прототипа.", { exact: true }),
    ).toBeVisible();
    await expect(
      sender.getByRole("button", { name: "Предложить передачу" }),
    ).toBeDisabled();
    await sender.getByLabel(/Один файл/).setInputFiles(boundaryPath);
    await sender.getByRole("button", { name: "Предложить передачу" }).click();
    await receiver
      .getByRole("button", { name: "Принять", exact: true })
      .click();
    await expect(
      sender.getByText("Файл получен получателем.", { exact: true }),
    ).toBeVisible({ timeout: 60_000 });
    const downloadPromise = receiver.waitForEvent("download");
    await receiver.getByRole("link", { name: "Скачать", exact: true }).click();
    const downloaded = await (await downloadPromise).path();
    async function fileHash(path: string) {
      const digest = createHash("sha256");
      for await (const chunk of createReadStream(path)) digest.update(chunk);
      return digest.digest("hex");
    }
    expect(await fileHash(downloaded!)).toBe(await fileHash(boundaryPath));
  } finally {
    await receiverContext.close();
    await senderContext.close();
  }
});
