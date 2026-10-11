// Motor de anonimização: aplica as regras de rules.ts a um arquivo DICOM.

import { decodeText, encodeText, parseDicomFile, type DicomElement, type DicomFile } from "./parse";
import {
  DATE_TAGS,
  DESCRIPTION_TAGS,
  DEVICE_TAGS,
  REMOVE_ALWAYS,
  REPLACE,
  SEX_AGE_TAGS,
  UID_TAGS,
  t,
  type AnonOptions,
} from "./rules";
import { writeDicomFile } from "./write";

const REMOVE = new Set(REMOVE_ALWAYS);
const DATES = new Set(DATE_TAGS);
const DEVICE = new Set(DEVICE_TAGS);
const DESC = new Set(DESCRIPTION_TAGS);
const SEXAGE = new Set(SEX_AGE_TAGS);
const UIDS = new Set(UID_TAGS);

export interface AnonContext {
  uidMap: Map<string, string>;
  /** Deslocamento de datas em dias (negativo), igual para todo o lote. */
  shiftDays: number;
}

export function newContext(): AnonContext {
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  return { uidMap: new Map(), shiftDays: -(365 + ((r[0] ?? 0) % 3650)) };
}

/** UID novo no formato 2.25.<inteiro aleatório de 128 bits>. */
function randomUid(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  let n = 0n;
  for (const x of b) n = (n << 8n) | BigInt(x);
  return `2.25.${n.toString()}`;
}

export function mapUid(ctx: AnonContext, old: string): string {
  if (!old) return old;
  let v = ctx.uidMap.get(old);
  if (!v) {
    v = randomUid();
    ctx.uidMap.set(old, v);
  }
  return v;
}

function shiftDate(da: string, days: number): string {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(da);
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  d.setUTCDate(d.getUTCDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
}

/** Valor resultante de um campo de texto (null = removido). Usado também na prévia. */
export function afterValue(
  tag: number,
  vr: string,
  before: string,
  o: AnonOptions,
  ctx: AnonContext,
): string | null {
  const rep = REPLACE[tag];
  if (rep) return rep === "name" ? o.patientName : o.patientId;
  if (REMOVE.has(tag)) return null;
  if (DATES.has(tag)) {
    if (o.dateMode === "keep") return before;
    if (o.dateMode === "remove") return null;
    if (vr === "DA") return before ? before.split("\\").map((d) => shiftDate(d, ctx.shiftDays)).join("\\") : before;
    if (vr === "DT") return before ? shiftDate(before, ctx.shiftDays) + before.slice(8) : before;
    return before; // horas são mantidas ao deslocar
  }
  if (DEVICE.has(tag)) return o.removeDevice ? null : before;
  if (DESC.has(tag)) return o.removeDescriptions ? null : before;
  if (SEXAGE.has(tag)) return o.keepSexAge ? before : null;
  if (UIDS.has(tag)) return before ? before.split("\\").map((u) => mapUid(ctx, u)).join("\\") : before;
  return before;
}

function str(group: number, elem: number, vr: string, text: string): DicomElement {
  return { group, elem, vr, value: encodeText(text, vr), items: null, fragments: null, undefinedLength: false };
}

function walk(list: DicomElement[], o: AnonOptions, ctx: AnonContext): DicomElement[] {
  const out: DicomElement[] = [];
  for (const e of list) {
    const tag = t(e.group, e.elem);
    if (o.removePrivateTags && e.group % 2 === 1 && e.group !== 0x7fe1) continue;
    if (e.items) {
      if (REMOVE.has(tag) || (o.removeDevice && DEVICE.has(tag))) continue;
      out.push({ ...e, items: e.items.map((it) => ({ elements: walk(it.elements, o, ctx) })) });
      continue;
    }
    if (e.fragments) {
      out.push(e);
      continue;
    }
    const touched =
      tag in REPLACE || REMOVE.has(tag) || DATES.has(tag) || DEVICE.has(tag) || DESC.has(tag) || SEXAGE.has(tag) || UIDS.has(tag);
    if (!touched) {
      out.push(e);
      continue;
    }
    const v = afterValue(tag, e.vr, decodeText(e.value), o, ctx);
    if (v === null) continue;
    out.push({ ...e, value: encodeText(v, e.vr) });
  }
  return out;
}

export function anonymizeFile(f: DicomFile, o: AnonOptions, ctx: AnonContext): DicomFile {
  const elements = walk(f.elements, o, ctx).filter(
    (e) => !(e.group === 0x0012 && (e.elem === 0x0062 || e.elem === 0x0063)),
  );
  elements.push(
    str(0x0012, 0x0062, "CS", "YES"),
    str(0x0012, 0x0063, "LO", "DICOM PS3.15 E.1 Basic Profile"),
  );
  elements.sort((a, b) => a.group - b.group || a.elem - b.elem);

  const meta = f.meta.map((e) => {
    if (e.group === 0x0002 && e.elem === 0x0003) {
      const v = mapUid(ctx, decodeText(e.value));
      const padded = v.length % 2 ? v + "\u0000" : v;
      return { ...e, value: new TextEncoder().encode(padded) };
    }
    return e;
  });
  return { ...f, meta, elements };
}

export function anonymizeBytes(bytes: Uint8Array, o: AnonOptions, ctx: AnonContext): Uint8Array {
  return writeDicomFile(anonymizeFile(parseDicomFile(bytes), o, ctx));
}
