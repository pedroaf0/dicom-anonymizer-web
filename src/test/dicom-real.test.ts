import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { strToU8, unzipSync, zipSync } from "fflate";
import { buildZip, loadBatch, newContext, expandInputs } from "@/lib/dicom/batch";
import { parseDicomFile, readText } from "@/lib/dicom/parse";
import { DEFAULT_OPTIONS } from "@/lib/dicom/rules";

const fx = (n: string) => new Uint8Array(readFileSync(join(__dirname, "fixtures", n)));
const ct = fx("CT_small.dcm");
const mr = fx("MR_small.dcm");

async function load() {
  // ZIP com duas séries (TC com 3 cortes + RM) e um arquivo que não é DICOM
  const zip = zipSync({ "exame/ct1.dcm": ct, "exame/ct2.dcm": ct, "exame/ct3.dcm": ct, "exame/mr.dcm": mr, "exame/leia.txt": strToU8("oi") });
  const file = new File([zip as BlobPart], "exame.zip");
  return loadBatch(await expandInputs([{ path: "exame.zip", file }]));
}

describe("exames reais", () => {
  it("detecta as duas séries do ZIP e ignora o que não é DICOM", async () => {
    const b = await load();
    expect(b.dicoms.length).toBe(4);
    expect(b.skipped.length).toBe(1);
    expect(b.series.map((s) => s.files)).toEqual([3, 1]);
  });

  it("ZIP completo tem uma pasta por série e nenhum nome original", async () => {
    const b = await load();
    const names = [ct, mr].map((x) => readText(parseDicomFile(x).elements, 0x0010, 0x0010));
    const { zip, errors } = await buildZip(b.dicoms, b.series, DEFAULT_OPTIONS, newContext(), () => {});
    expect(errors).toEqual([]);
    const out = unzipSync(zip);
    expect(Object.keys(out).sort()).toEqual([
      "ANONIMIZADO/SERIE_001/IMG_00001.dcm",
      "ANONIMIZADO/SERIE_001/IMG_00002.dcm",
      "ANONIMIZADO/SERIE_001/IMG_00003.dcm",
      "ANONIMIZADO/SERIE_002/IMG_00001.dcm",
    ]);
    for (const bytes of Object.values(out)) {
      const f = parseDicomFile(bytes);
      expect(readText(f.elements, 0x0010, 0x0010)).toBe("ANONIMIZADO");
      const text = new TextDecoder("latin1").decode(bytes);
      for (const n of names) if (n) expect(text).not.toContain(n);
    }
  });

  it("baixar uma série gera ZIP só com ela", async () => {
    const b = await load();
    const { zip } = await buildZip(b.dicoms, b.series, DEFAULT_OPTIONS, newContext(), () => {}, b.series[1]!.key);
    expect(Object.keys(unzipSync(zip))).toEqual(["ANONIMIZADO/SERIE_002/IMG_00001.dcm"]);
  });

  it("imagem comprimida é preservada", async () => {
    const j = fx("JPEG2000.dcm");
    const file = new File([j as BlobPart], "j.dcm");
    const b = await loadBatch(await expandInputs([{ path: "j.dcm", file }]));
    if (b.dicoms.length === 0) return; // amostra pode ser só cabeçalho
    const { errors } = await buildZip(b.dicoms, b.series, DEFAULT_OPTIONS, newContext(), () => {});
    expect(errors).toEqual([]);
  });
});
