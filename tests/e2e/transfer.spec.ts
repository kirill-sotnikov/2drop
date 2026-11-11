import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

test.use({ locale: "ru-RU" });

const getId = async (page: Page) => {
  return page.evaluate(() => {
    const stored = JSON.parse(
      sessionStorage.getItem("2drop.session.v1") ?? "null",
    ) as { id: string };

    return stored.id;
  });
};

const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");

// Read STORE entries independently of the browser's ZIP writer.
const storedEntries = (zip: Buffer) => {
  const end = zip.length - 22;

  expect(zip.readUInt32LE(end)).toBe(0x06_05_4b_50);

  const count = zip.readUInt16LE(end + 10);

  let offset = zip.readUInt32LE(end + 16);

  const entries: Array<{ name: string; bytes: Buffer }> = [];

  for (let index = 0; index < count; index++) {
    expect(zip.readUInt32LE(offset)).toBe(0x02_01_4b_50);
    expect(zip.readUInt16LE(offset + 10)).toBe(0);

    const nameLength = zip.readUInt16LE(offset + 28);

    const name = zip
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");

    const local = zip.readUInt32LE(offset + 42);

    expect(zip.readUInt32LE(local)).toBe(0x04_03_4b_50);

    const start =
      local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);

    entries.push({
      name,
      bytes: zip.subarray(start, start + zip.readUInt32LE(offset + 24)),
    });

    offset +=
      46 +
      nameLength +
      zip.readUInt16LE(offset + 30) +
      zip.readUInt16LE(offset + 32);
  }

  return entries;
};

test("seven selected files require one consent and download as one complete uncompressed ZIP", async ({
  browser,
}, testInfo) => {
  const receiverContext = await browser.newContext({ locale: "ru-RU" });
  const senderContext = await browser.newContext({ locale: "ru-RU" });

  try {
    const receiver = await receiverContext.newPage();
    const sender = await senderContext.newPage();

    await receiver.goto("/receive");

    const id = await getId(receiver);

    await sender.addInitScript(() => {
      const read = Blob.prototype.arrayBuffer;

      Blob.prototype.arrayBuffer = async function () {
        await new Promise((resolve) => {
          setTimeout(resolve, 80);
        });

        return read.call(this);
      };
    });

    await sender.goto(`/send?id=${id}`);

    const samples = [
      {
        name: "документ 📦.txt",
        mimeType: "text/plain",
        buffer: Buffer.alloc(60_003, 11),
      },
      {
        name: "same.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("first"),
      },
      {
        name: "same.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("second"),
      },
      {
        name: "same (1).txt",
        mimeType: "text/plain",
        buffer: Buffer.from("third"),
      },
      {
        name: "empty.bin",
        mimeType: "application/octet-stream",
        buffer: Buffer.alloc(0),
      },
      {
        name: "image.png",
        mimeType: "image/png",
        buffer: Buffer.from([0, 255, 1, 127]),
      },
      {
        name: "data.json",
        mimeType: "application/json",
        buffer: Buffer.alloc(60_007, 22),
      },
    ];

    const fileInput = sender.getByLabel(/Файлы до/u);

    const senderFiles = sender
      .getByRole("list", { name: "Список файлов" })
      .getByRole("listitem");

    const senderShowFiles = sender.getByRole("button", {
      name: "Ещё 2 файла",
      exact: true,
    });

    await fileInput.setInputFiles(samples.slice(0, 5));
    await expect(senderFiles).toHaveCount(5);
    await expect(senderShowFiles).toHaveCount(0);

    await fileInput.setInputFiles(samples);
    await expect(fileInput).toHaveAttribute("multiple", "");
    await expect(senderFiles).toHaveCount(5);
    await expect(senderFiles.last()).toContainText("empty.bin");
    await senderShowFiles.click();
    await expect(senderFiles).toHaveCount(7);
    await expect(senderFiles.last()).toContainText("data.json");
    await sender.getByRole("button", { name: "Свернуть", exact: true }).click();
    await expect(senderFiles).toHaveCount(5);

    await sender
      .getByRole("button", { name: "Отправить", exact: true })
      .click();

    await expect(
      receiver.getByRole("heading", { name: "Файлов: 7", exact: true }),
    ).toBeVisible();

    const receiverFiles = receiver
      .getByRole("list", { name: "Список файлов" })
      .getByRole("listitem");

    await expect(receiverFiles).toHaveCount(5);

    await receiver
      .getByRole("button", { name: "Ещё 2 файла", exact: true })
      .click();

    await expect(receiverFiles).toHaveCount(7);

    const saveArchive = receiver.getByRole("link", {
      name: "Сохранить",
      exact: true,
    });

    await expect(saveArchive).toHaveCount(0);

    await receiver
      .getByRole("button", { name: "Отклонить", exact: true })
      .click();

    await expect(
      sender.getByText("Получатель отклонил передачу", { exact: true }),
    ).toBeVisible();

    // Cancel after some bytes have arrived: no partial ZIP may be offered.
    await sender
      .getByRole("button", { name: "Отправить", exact: true })
      .click();

    await receiver
      .getByRole("button", { name: "Принять", exact: true })
      .click();

    await expect(sender.getByRole("progressbar")).toBeVisible();

    await expect(sender.getByRole("progressbar")).not.toHaveAttribute(
      "value",
      "0",
    );

    await sender
      .getByRole("button", { name: "Отменить передачу", exact: true })
      .click();

    await expect(
      receiver.getByText("Передача отменена", { exact: true }),
    ).toBeVisible();

    await expect(saveArchive).toHaveCount(0);

    await sender
      .getByRole("button", { name: "Отправить", exact: true })
      .click();

    await receiver
      .getByRole("button", { name: "Принять", exact: true })
      .click();

    await expect(
      receiver.getByText("Все файлы получены. Архив готов к скачиванию.", {
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      sender.getByText("Все файлы получены получателем", { exact: true }),
    ).toBeVisible();

    await expect(saveArchive).toHaveCount(1);

    await expect(
      receiver.getByRole("button", { name: /Поделиться/u }),
    ).toHaveCount(0);

    const downloadPromise = receiver.waitForEvent("download");

    await saveArchive.click();

    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("документ 📦.zip");
    await download.saveAs(testInfo.outputPath(download.suggestedFilename()));

    const path = await download.path();

    assert(path);

    const entries = storedEntries(await readFile(path));

    expect(entries.map((entry) => entry.name)).toEqual([
      "документ 📦.txt",
      "same.txt",
      "same (1).txt",
      "same (1) (1).txt",
      "empty.bin",
      "image.png",
      "data.json",
    ]);

    for (const [index, entry] of entries.entries())
      expect(hash(entry.bytes)).toBe(hash(samples[index].buffer));

    await receiver.setViewportSize({ width: 390, height: 844 });

    expect(
      await receiver.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    await receiver.screenshot({
      path: testInfo.outputPath("received-batch.png"),
      fullPage: true,
    });

    // The limit applies to the sum, even when each file is individually allowed.
    const paths = [testInfo.outputPath("a.bin"), testInfo.outputPath("b.bin")];

    for (const [index, filePath] of paths.entries()) {
      const handle = await open(filePath, "w");

      try {
        await handle.truncate(index === 0 ? 50_000_001 : 50_000_000);
      } finally {
        await handle.close();
      }
    }

    await sender.getByLabel(/Файлы до/u).setInputFiles(paths);

    await expect(
      sender.getByText("Общий размер файлов превышает лимит прототипа", {
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      sender.getByRole("button", { name: "Отправить", exact: true }),
    ).toBeDisabled();
  } finally {
    await receiverContext.close();
    await senderContext.close();
  }
});

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
    page.getByRole("img", { name: /QR для отправки/u }),
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

  await expect.poll(() => getId(page)).not.toBe(id);
});

test("two browsers transfer binary and empty files with consent, exact bytes and repeat use", async ({
  browser,
}) => {
  const receiverContext = await browser.newContext({ locale: "ru-RU" });
  const senderContext = await browser.newContext({ locale: "ru-RU" });

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
        Buffer.from(
          Array.from({ length: 1_500_003 }, (_, index) => index % 256),
        ),
      ],
      ["пустой.txt", Buffer.alloc(0)],
    ] as const) {
      await sender.getByLabel(/Файлы до/u).setInputFiles({
        name,
        mimeType: "application/octet-stream",
        buffer: payload,
      });

      await sender
        .getByRole("button", { name: "Отправить", exact: true })
        .click();

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
      await expect(sender.getByLabel(/Файлы до/u)).toBeDisabled();

      await receiver
        .getByRole("button", { name: "Принять", exact: true })
        .click();

      await expect(
        sender.getByText("Файл передан успешно", { exact: true }),
      ).toBeVisible();

      await expect(
        receiver.getByText("Файл получен. Теперь его можно сохранить.", {
          exact: true,
        }),
      ).toBeVisible();

      const downloadPromise = receiver.waitForEvent("download");

      await receiver
        .getByRole("link", { name: "Скачать", exact: true })
        .click();

      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe(name);

      const path = await download.path();

      assert(path);
      assert(path);
      expect(hash(await readFile(path))).toBe(hash(payload));

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
  const receiverContext = await browser.newContext({ locale: "ru-RU" });
  const senderContext = await browser.newContext({ locale: "ru-RU" });

  try {
    const receiver = await receiverContext.newPage();
    const sender = await senderContext.newPage();

    await receiver.goto("/receive");

    const id = await getId(receiver);

    await sender.addInitScript(() => {
      const read = Blob.prototype.arrayBuffer;

      Blob.prototype.arrayBuffer = async function () {
        await new Promise((resolve) => {
          setTimeout(resolve, 200);
        });

        return read.call(this);
      };
    });

    await sender.goto(`/send?id=${id}`);

    await sender.getByLabel(/Файлы до/u).setInputFiles({
      name: "cancel.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(200_000, 7),
    });

    await sender
      .getByRole("button", { name: "Отправить", exact: true })
      .click();

    await receiver
      .getByRole("button", { name: "Отклонить", exact: true })
      .click();

    await expect(
      sender.getByText("Получатель отклонил передачу", { exact: true }),
    ).toBeVisible();

    await sender
      .getByRole("button", { name: "Отправить", exact: true })
      .click();

    await receiver
      .getByRole("button", { name: "Принять", exact: true })
      .click();

    await expect(sender.getByRole("progressbar")).toBeVisible();
    await sender.getByRole("button", { name: "Отменить передачу" }).click();

    await expect(
      receiver.getByText("Передача отменена", { exact: true }),
    ).toBeVisible();

    await expect(
      receiver.getByRole("link", { name: "Скачать", exact: true }),
    ).toHaveCount(0);

    await sender
      .getByRole("button", { name: "Отправить", exact: true })
      .click();

    await receiver
      .getByRole("button", { name: "Принять", exact: true })
      .click();

    await expect(
      sender.getByText("Файл передан успешно", { exact: true }),
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

  const receiverContext = await browser.newContext({ locale: "ru-RU" });
  const senderContext = await browser.newContext({ locale: "ru-RU" });

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
      await sender.getByLabel(/Файлы до/u).setInputFiles(sample);

      await sender
        .getByRole("button", { name: "Отправить", exact: true })
        .click();

      await receiver
        .getByRole("button", { name: "Принять", exact: true })
        .click();

      await expect(
        sender.getByText("Файл передан успешно", { exact: true }),
      ).toBeVisible();

      const sampleDownloadPromise = receiver.waitForEvent("download");

      await receiver
        .getByRole("link", { name: "Скачать", exact: true })
        .click();

      const path = await (await sampleDownloadPromise).path();

      assert(path);
      expect(hash(await readFile(path))).toBe(hash(sample.buffer));
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

    await sender.getByLabel(/Файлы до/u).setInputFiles(oversizedPath);

    await expect(
      sender.getByText("Общий размер файлов превышает лимит прототипа", {
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      sender.getByRole("button", { name: "Отправить", exact: true }),
    ).toBeDisabled();

    await sender.getByLabel(/Файлы до/u).setInputFiles(boundaryPath);

    await sender
      .getByRole("button", { name: "Отправить", exact: true })
      .click();

    await receiver
      .getByRole("button", { name: "Принять", exact: true })
      .click();

    await expect(
      sender.getByText("Файл передан успешно", { exact: true }),
    ).toBeVisible({ timeout: 60_000 });

    const downloadPromise = receiver.waitForEvent("download");

    await receiver.getByRole("link", { name: "Скачать", exact: true }).click();

    const downloaded = await (await downloadPromise).path();

    const fileHash = async (path: string) => {
      const digest = createHash("sha256");

      for await (const chunk of createReadStream(path)) digest.update(chunk);

      return digest.digest("hex");
    };

    assert(downloaded);
    expect(await fileHash(downloaded)).toBe(await fileHash(boundaryPath));
  } finally {
    await receiverContext.close();
    await senderContext.close();
  }
});
