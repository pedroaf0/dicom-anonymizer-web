// Escrita de arquivos DICOM: reconstrói cabeçalhos e comprimentos a partir da
// árvore em memória, preservando byte a byte o pixel data original.

import {
  EMPTY,
  type DicomElement,
  type DicomFile,
  type ParseOpts,
  findElement,
  readText,
} from "./parse";
import { tagInfo } from "./tags";

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

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.byteLength;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
}

function u16(v: number, be = false): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, v, !be);
  return b;
}

function u32(v: number, be = false): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, v, !be);
  return b;
}

function vrBytes(vr: string): Uint8Array {
  return new Uint8Array([vr.charCodeAt(0) ?? 0x55, vr.charCodeAt(1) ?? 0x4e]);
}

function padEven(value: Uint8Array, vr: string): Uint8Array {
  if (value.byteLength % 2 === 0) return value;
  const out = new Uint8Array(value.byteLength + 1);
  out.set(value);
  out[value.byteLength] = vr === "UI" ? 0x00 : 0x20;
  return out;
}

function elementHeader(e: DicomElement, o: ParseOpts, len: number, undef: boolean): Uint8Array {
  const be = o.bigEndian;
  if (o.implicit) return concat([u16(e.group, be), u16(e.elem, be), u32(len, be)]);
  if (LONG_VR.has(e.vr) || undef || len > 0xfffe) {
    return concat([
      u16(e.group, be),
      u16(e.elem, be),
      vrBytes(undef && len > 0xfffe ? e.vr : e.vr),
      u16(0),
      u32(len, be),
    ]);
  }
  return concat([u16(e.group, be), u16(e.elem, be), vrBytes(e.vr), u16(len, be)]);
}

function writeElement(e: DicomElement, o: ParseOpts): Uint8Array {
  const be = o.bigEndian;

  // Sequência (VR SQ): corpo com comprimento calculado.
  if (e.items !== null) {
    const body = concat(
      e.items.map((item) => {
        const inner = concat(item.elements.map((child) => writeElement(child, o)));
        return concat([u16(0xfffe, be), u16(0xe000, be), u32(inner.byteLength, be), inner]);
      }),
    );
    const vr = e.vr === "SQ" ? "SQ" : e.vr;
    const withVr: DicomElement = { ...e, vr };
    return concat([elementHeader(withVr, o, body.byteLength, false), body]);
  }

  // Pixel data encapsulado: fragmentos como itens de comprimento indefinido.
  if (e.fragments !== null) {
    const frags = concat(
      e.fragments.map((f) =>
        concat([u16(0xfffe, be), u16(0xe000, be), u32(f.byteLength, be), f]),
      ),
    );
    return concat([
      elementHeader(e, o, 0xffffffff, true),
      frags,
      u16(0xfffe, be),
      u16(0xe0dd, be),
      u32(0, be),
    ]);
  }

  const value = padEven(e.value, e.vr);
  return concat([elementHeader(e, o, value.byteLength, false), value]);
}

/** Monta a File Meta Information, recalculando (0002,0000). */
function buildMeta(f: DicomFile): Uint8Array {
  const o: ParseOpts = { implicit: false, bigEndian: false };
  const body = concat(
    f.meta
      .filter((e) => e.group === 0x0002 && e.elem !== 0x0000)
      .map((e) => writeElement(e, o)),
  );
  const groupLength = new Uint8Array(4);
  new DataView(groupLength.buffer).setUint32(0, body.byteLength, true);
  return concat([u16(0x0002), u16(0x0000), vrBytes("UL"), u16(0), u32(4), groupLength, body]);
}

function metaString(elem: number, vr: string, text: string): DicomElement {
  const padded = text.length % 2 ? text + "\u0000" : text;
  return {
    group: 0x0002,
    elem,
    vr,
    value: new TextEncoder().encode(padded),
    items: null,
    fragments: null,
    undefinedLength: false,
  };
}

export function buildMetaElements(
  transferSyntax: string,
  sopClass: string,
  sopInstance: string,
): DicomElement[] {
  return [
    {
      group: 0x0002,
      elem: 0x0001,
      vr: "OB",
      value: new Uint8Array([0x00, 0x01]),
      items: null,
      fragments: null,
      undefinedLength: false,
    },
    metaString(0x0002, "UI", sopClass),
    metaString(0x0003, "UI", sopInstance),
    metaString(0x0010, "UI", transferSyntax),
    metaString(0x0012, "UI", "2.25.328951449451966303065558247111899980165"),
    metaString(0x0013, "SH", "ANONIMIZADOR_DICOM_1"),
  ];
}

/** Serializa o arquivo completo: preâmbulo + meta + conjunto de dados. */
export function writeDicomFile(f: DicomFile): Uint8Array {
  const preamble = new Uint8Array(132);
  preamble.set([0x44, 0x49, 0x43, 0x4d], 128);

  const meta = f.meta.length > 0 ? buildMeta(f) : new Uint8Array(0);
  const o: ParseOpts = { implicit: f.implicitVR, bigEndian: f.bigEndian };
  const dataset = concat(f.elements.map((e) => writeElement(e, o)));
  return concat([preamble, meta, dataset]);
}

export { EMPTY, findElement, readText, tagInfo };
export type { DicomElement, DicomFile, ParseOpts };
