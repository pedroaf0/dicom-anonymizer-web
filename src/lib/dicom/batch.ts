// Leitura do lote (ZIP, arquivos ou pasta) e geração do ZIP final.

import { unzipSync, zipSync } from "fflate";
import { decodeText, parseDicomFile, readText, type DicomFile } from "./parse";
import { PREVIEW_TAGS, type AnonOptions } from "./rules";
import { tagInfo } from "./tags";
import { afterValue, anonymizeBytes, newContext, type AnonContext } from "./anonymize";

export interface InputFile {
  path: string;
  bytes: Uint8Array;
}

export interface PreviewField {
  tag: number;
  label: string;
  vr: string;
  before: string;
}

export interface StudyGroup {
  key: string;
  files: number;
  fields: PreviewField[];
}

export interface LoadedBatch {
  total: number;
  dicoms: InputFile[];
  skipped: string[];
  studies: StudyGroup[];
}

const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b;

export async function expandInputs(files: { path: string; file: File }[]): Promise<InputFile[]> {
  const out: InputFile[] = [];
  for (const { path, file } of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isZip(bytes)) {
      const entries = unzipSync(bytes);
      for (const [name, data] of Object.entries(entries)) {
        if (name.endsWith("/") || data.byteLength === 0) continue;
        if (name.startsWith("__MACOSX/")) continue;
        out.push({ path: `${path}/${name}`, bytes: data });
      }
    } else out.push({ path, bytes });
  }
  return out;
}

function previewOf(f: DicomFile): PreviewField[] {
  const fields: PreviewField[] = [];
  for (const tag of PREVIEW_TAGS) {
    const g = tag >>> 16;
    const e = tag & 0xffff;
    const el = f.elements.find((x) => x.group === g && x.elem === e);
    if (!el || el.items || el.fragments) continue;
    const before = decodeText(el.value);
    if (!before) continue;
    fields.push({ tag, vr: el.vr, before, label: tagInfo(g, e)?.name ?? "" });
  }
  return fields;
}

export async function loadBatch(inputs: InputFile[]): Promise<LoadedBatch> {
  const dicoms: InputFile[] = [];
  const skipped: string[] = [];
  const studies = new Map<string, StudyGroup>();
  for (let i = 0; i < inputs.length; i++) {
    const it = inputs[i]!;
    const base = it.path.split("/").pop()?.toUpperCase() ?? "";
    if (base === "DICOMDIR") {
      skipped.push(it.path);
      continue;
    }
    try {
      const f = parseDicomFile(it.bytes);
      if (!f.elements.some((e) => e.group >= 0x0008)) throw new Error();
      dicoms.push(it);
      const key = readText(f.elements, 0x0020, 0x000d) || "sem-estudo";
      const s = studies.get(key);
      if (s) s.files++;
      else studies.set(key, { key, files: 1, fields: previewOf(f) });
    } catch {
      skipped.push(it.path);
    }
    if (i % 50 === 49) await new Promise((r) => setTimeout(r));
  }
  return { total: inputs.length, dicoms, skipped, studies: [...studies.values()] };
}

/** Contexto de prévia: UIDs e deslocamento consistentes entre prévia e ZIP. */
export function previewAfter(f: PreviewField, o: AnonOptions, ctx: AnonContext): string | null {
  return afterValue(f.tag, f.vr, f.before, o, ctx);
}

export async function buildZip(
  dicoms: InputFile[],
  o: AnonOptions,
  ctx: AnonContext,
  onProgress: (done: number) => void,
): Promise<{ zip: Uint8Array; errors: string[] }> {
  const files: Record<string, Uint8Array> = {};
  const errors: string[] = [];
  const series = new Map<string, number>();
  for (let i = 0; i < dicoms.length; i++) {
    try {
      const out = anonymizeBytes(dicoms[i]!.bytes, o, ctx);
      const parsed = parseDicomFile(out);
      const s = readText(parsed.elements, 0x0020, 0x000e) || "x";
      if (!series.has(s)) series.set(s, series.size + 1);
      const folder = `SERIE_${String(series.get(s)).padStart(3, "0")}`;
      files[`ANONIMIZADO/${folder}/IMG_${String(i + 1).padStart(5, "0")}.dcm`] = [out, { level: 0 }] as never;
    } catch (err) {
      errors.push(`${dicoms[i]!.path}: ${(err as Error).message}`);
    }
    if (i % 20 === 19 || i === dicoms.length - 1) {
      onProgress(i + 1);
      await new Promise((r) => setTimeout(r));
    }
  }
  return { zip: zipSync(files), errors };
}

export { newContext };
