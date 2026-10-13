// Leitor/escritor DICOM mínimo, escrito à mão para que todo o processamento
// seja auditável e aconteça só no navegador.
//
// Estrutura de um arquivo DICOM (PS3.10):
//   [128 bytes qualquer][ "DICM" ][ File Meta Information ][ conjunto de dados ]
//
// A File Meta Information usa sempre VR explícito little-endian e guarda em
// (0002,0010) a sintaxe de transferência do conjunto de dados.

import { tagInfo } from "./tags";

export interface DicomItem {
  readonly elements: DicomElement[];
}

export interface DicomElement {
  group: number;
  elem: number;
  vr: string;
  /** Bytes do valor. Vazio quando o elemento é uma sequência ou pixel encapsulado. */
  value: Uint8Array;
  /** Sequências (VR SQ). */
  items: DicomItem[] | null;
  /** Pixel data encapsulado (JPEG, JPEG-2000, RLE...): fragmentos brutos. */
  fragments: Uint8Array[] | null;
  undefinedLength: boolean;
}

export interface ParseOpts {
  implicit: boolean;
  bigEndian: boolean;
}

export interface DicomFile {
  meta: DicomElement[];
  elements: DicomElement[];
  transferSyntax: string;
  implicitVR: boolean;
  bigEndian: boolean;
}

/** VRs cujo cabeçalho explícito tem 12 bytes (comprimento de 32 bits). */
const LONG_VR = new Set([
  "OB",
  "OD",
  "OF",
  "OL",
  "OW",
  "OT",
  "OV",
  "SQ",
  "UC",
  "UN",
  "UR",
  "UT",
  "UV",
]);

/** VRs de texto: padding é espaço (0x20); os demais usam 0x00. */
const TEXT_VR = new Set([
  "AE",
  "AS",
  "CS",
  "DA",
  "DS",
  "DT",
  "IS",
  "LO",
  "LT",
  "PN",
  "SH",
  "ST",
  "TM",
  "UC",
  "UR",
  "UT",
]);

export const EMPTY = new Uint8Array(0);

export const IMPLICIT_LE = "1.2.840.10008.1.2";
export const EXPLICIT_LE = "1.2.840.10008.1.2.1";
export const EXPLICIT_BE = "1.2.840.10008.1.2.2";

export class ByteReader {
  readonly view: DataView;
  pos = 0;

  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get remaining(): number {
    return this.bytes.byteLength - this.pos;
  }

  u8(offset = 0): number {
    return this.view.getUint8(this.pos + offset);
  }

  u16(bigEndian = false, offset = 0): number {
    return this.view.getUint16(this.pos + offset, bigEndian);
  }

  u32(bigEndian = false, offset = 0): number {
    return this.view.getUint32(this.pos + offset, bigEndian);
  }

  skip(n: number): void {
    this.pos += n;
  }

  slice(n: number): Uint8Array {
    const out = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
}

function isTextVr(vr: string): boolean {
  return TEXT_VR.has(vr);
}

export function decodeText(bytes: Uint8Array): string {
  let s: string;
  try {
    s = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    s = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  }
  return s.replace(/[\u0000\u0020]+$/, "").trim();
}

export function encodeText(text: string, vr: string): Uint8Array {
  const raw = new TextEncoder().encode(text);
  if (raw.byteLength % 2 === 0) return raw;
  const pad = isTextVr(vr) ? 0x20 : 0x00;
  const out = new Uint8Array(raw.byteLength + 1);
  out.set(raw);
  out[raw.byteLength] = pad;
  return out;
}

function looksLikeVr(a: number, b: number): boolean {
  const ch = (c: number) => (c >= 0x41 && c <= 0x5a) || (c >= 0x30 && c <= 0x39);
  return ch(a) && ch(b);
}

/** Lê os fragmentos de pixel data encapsulado até o delimitador (FFFE,E0DD). */
function parseFragments(r: ByteReader, o: ParseOpts): Uint8Array[] {
  const out: Uint8Array[] = [];
  const be = o.bigEndian;
  while (r.remaining >= 8) {
    const group = r.u16(be);
    const elem = r.u16(be, 2);
    if (group !== 0xfffe) break;
    if (elem === 0xe0dd) {
      r.skip(8);
      break;
    }
    if (elem !== 0xe000) {
      r.skip(8);
      break;
    }
    const len = r.u32(be, 4);
    r.skip(8);
    if (len === 0xffffffff) break;
    if (len > r.remaining) throw new Error("Arquivo DICOM truncado.");
    out.push(r.slice(len));
  }
  return out;
}

/**
 * Lê elementos até encontrar um delimitador de item/fim ou acabar o buffer.
 * O delimitador (FFFE,E00D / FFFE,E0DD) é consumido.
 */
function parseElements(r: ByteReader, o: ParseOpts, depth: number, onlyGroup?: number): DicomElement[] {
  const out: DicomElement[] = [];
  const be = o.bigEndian;
  while (r.remaining >= 8) {
    const group = r.u16(be);
    const elem = r.u16(be, 2);
    if (group === 0xfffe) {
      r.skip(8);
      break;
    }
    if (onlyGroup !== undefined && group !== onlyGroup) break;
    if (depth > 12) throw new Error("Sequências DICOM aninhadas demais.");

    if (o.implicit) {
      const len = r.u32(be, 4);
      r.skip(8);
      const vr = tagInfo(group, elem)?.vr ?? "UN";
      if (len > r.remaining && len !== 0xffffffff) throw new Error("Arquivo DICOM truncado.");
      if (vr === "SQ") {
        const items = parseItems(r, o, len, depth + 1);
        out.push({
          group,
          elem,
          vr,
          value: EMPTY,
          items,
          fragments: null,
          undefinedLength: len === 0xffffffff,
        });
      } else if (len === 0xffffffff) {
        const fragments = parseFragments(r, o);
        out.push({ group, elem, vr, value: EMPTY, items: null, fragments, undefinedLength: true });
      } else {
        out.push({
          group,
          elem,
          vr,
          value: r.slice(len),
          items: null,
          fragments: null,
          undefinedLength: false,
        });
      }
      continue;
    }

    const vr = String.fromCharCode(r.u8(4), r.u8(5));
    if (!looksLikeVr(r.u8(4), r.u8(5))) throw new Error(`Cabeçalho DICOM inválido. ${group.toString(16)},${elem.toString(16)} ${r.pos}`);
    let len: number;
    if (LONG_VR.has(vr)) {
      len = r.u32(be, 8);
      r.skip(12);
    } else {
      len = r.u16(be, 6);
      r.skip(8);
    }

    if (vr === "SQ") {
      const items = parseItems(r, o, len, depth + 1);
      out.push({
        group,
        elem,
        vr,
        value: EMPTY,
        items,
        fragments: null,
        undefinedLength: len === 0xffffffff,
      });
      continue;
    }

    if (len === 0xffffffff) {
      const fragments = parseFragments(r, o);
      out.push({ group, elem, vr, value: EMPTY, items: null, fragments, undefinedLength: true });
      continue;
    }

    if (len > r.remaining) throw new Error("Arquivo DICOM truncado.");
    out.push({
      group,
      elem,
      vr,
      value: r.slice(len),
      items: null,
      fragments: null,
      undefinedLength: false,
    });
  }
  return out;
}

function parseItems(r: ByteReader, o: ParseOpts, len: number, depth: number): DicomItem[] {
  const items: DicomItem[] = [];
  const be = o.bigEndian;
  const end = len === 0xffffffff ? -1 : r.pos + len;

  while (r.remaining >= 8 && (end < 0 || r.pos + 8 <= end)) {
    const group = r.u16(be);
    const elem = r.u16(be, 2);
    if (group !== 0xfffe) break;
    if (elem === 0xe0dd) {
      r.skip(8);
      break;
    }
    if (elem !== 0xe000) {
      r.skip(8);
      break;
    }
    const ilen = r.u32(be, 4);
    r.skip(8);
    if (ilen === 0xffffffff) {
      items.push({ elements: parseElements(r, o, depth + 1) });
    } else {
      if (ilen > r.remaining) throw new Error("Arquivo DICOM truncado.");
      const sub = new ByteReader(r.bytes.subarray(r.pos, r.pos + ilen));
      r.skip(ilen);
      items.push({ elements: parseElements(sub, o, depth + 1) });
    }
  }
  return items;
}

/** Lê a File Meta Information (grupo 0002, sempre VR explícito little-endian). */
function parseMeta(r: ByteReader): DicomElement[] {
  const out: DicomElement[] = [];
  const o: ParseOpts = { implicit: false, bigEndian: false };
  while (r.remaining >= 8) {
    const start = r.pos;
    if (r.u16(false) !== 0x0002) {
      r.pos = start;
      break;
    }
    try {
      const el = parseElements(r, o, 0, 0x0002);
      if (el.length === 0) {
        r.pos = start;
        break;
      }
      out.push(...el);
    } catch (e) {
      console.log("META", String(e));
      r.pos = start;
      break;
    }
  }
  return out;
}

export function findElement(
  list: DicomElement[],
  group: number,
  elem: number,
): DicomElement | undefined {
  for (const e of list) if (e.group === group && e.elem === elem) return e;
  return undefined;
}

export function readText(list: DicomElement[], group: number, elem: number): string {
  const e = findElement(list, group, elem);
  return e ? decodeText(e.value) : "";
}

export function transferSyntaxOf(meta: DicomElement[]): string {
  return readText(meta, 0x0002, 0x0010);
}

function hasPreamble(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 132 &&
    bytes[128] === 0x44 &&
    bytes[129] === 0x49 &&
    bytes[130] === 0x43 &&
    bytes[131] === 0x4d
  );
}

/**
 * Interpreta um arquivo DICOM em memória. Aceita VR implícito/explícito,
 * little ou big-endian e pixel data comprimido (mantido byte a byte).
 */
export function parseDicomFile(bytes: Uint8Array): DicomFile {
  let meta: DicomElement[] = [];
  let bodyStart = 0;
  if (hasPreamble(bytes)) {
    const r = new ByteReader(bytes.subarray(132));
    meta = parseMeta(r);
    bodyStart = 132 + r.pos;
  } else {
    const r = new ByteReader(bytes);
    const maybe = parseMeta(r);
    if (maybe.length > 0) {
      meta = maybe;
      bodyStart = r.pos;
    }
  }

  const ts = transferSyntaxOf(meta);
  const implicit = ts === IMPLICIT_LE;
  const bigEndian = ts === EXPLICIT_BE;
  const o: ParseOpts = { implicit, bigEndian };

  try {
    const elements = parseElements(new ByteReader(bytes.subarray(bodyStart)), o, 0);
    if (elements.length === 0) throw new Error("vazio");
    return {
      meta,
      elements,
      transferSyntax: ts || EXPLICIT_LE,
      implicitVR: implicit,
      bigEndian,
    };
  } catch (err) {
    console.log("DBG", String(err), bodyStart, meta.length);
    if (implicit) throw new Error("Não foi possível ler este arquivo como DICOM.");
    const retry = new ByteReader(bytes.subarray(bodyStart));
    const elements = parseElements(retry, { implicit: true, bigEndian: false }, 0);
    if (elements.length === 0) throw new Error("Não foi possível ler este arquivo como DICOM.");
    return {
      meta,
      elements,
      transferSyntax: ts || IMPLICIT_LE,
      implicitVR: true,
      bigEndian: false,
    };
  }
}
