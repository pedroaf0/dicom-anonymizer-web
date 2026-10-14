import { describe, expect, it } from "vitest";
import { zipName } from "@/lib/dicom/naming";

const date = new Date(2026, 9, 14, 9, 5, 3);

describe("nome do ZIP", () => {
  it("só timestamp", async () => {
    expect(await zipName({ mode: "timestamp", custom: "", original: "joao.zip", date })).toBe("20261014-090503.zip");
  });
  it("timestamp + hash não contém o nome original", async () => {
    const n = await zipName({ mode: "timestamp-hash", custom: "", original: "joao_silva.zip", date });
    expect(n).toMatch(/^20261014-090503_[0-9a-f]{8}\.zip$/);
    expect(n).not.toContain("joao");
  });
  it("personalizado, com sufixo de série", async () => {
    expect(await zipName({ mode: "custom", custom: "caso 7", original: "x", date, suffix: "SERIE_002" })).toBe("caso 7_SERIE_002.zip");
  });
  it("personalizado vazio cai no timestamp", async () => {
    expect(await zipName({ mode: "custom", custom: " / ", original: "x", date })).toBe("20261014-090503.zip");
  });
});
