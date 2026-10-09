// Escrita de arquivos DICOM: reconstrói cabeçalhos e comprimentos a partir da
// árvore em memória, preservando byte a byte o pixel data original.

import {
  ByteReader,
  EMPTY,
  type DicomElement,
  type DicomFile,
  type DicomItem,
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
  new DataView(b.buffer).setUint16(0, v, be);
  return b;
}

function u32(v: number, be = false): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, v, be);
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

function writeElement(e: DicomElement, o: ParseOpts): Uint8Array {
  const be = o.bigEndian;

  if (e.items !== null) {
    const body = concat(
      e.items.map((item) => {
        const inner = concat(item.elements.map((c) => writeElement(c, o)));
        return concat([u16(0xfffe, be), u16(0xe000, be), u32(inner.byteLength, be), inner]);
      }),
    );
    if (o.implicit) return concat([u16(e.group, be), u16(e.elem, be), u32(body.byteLength, be), body]);
    return concat([
      u16(e.group, be),
      u16(e.elem, be),
      vrBytes("SQ"),
      u16(0),
      u32(body.byteLength, be),
      body,
    ]);
  }

  const value = padEven(e.value, e.vr);

  // Pixel data encapsulado (JPEG, JPEG-2000, RLE...): fragmentos como itens
  // de comprimento indefinido, exatamente como no arquivo de origem.
  if (e.undefinedLength) {
    const frags = concat(
      e.items === null
        ? []
        : e.items.map((item) => {
            const inner = concat(item.elements.map((c) => writeElement(c, o)));
            return concat([u16(0xfffe, be), u16(0xe000, be), u32(inner.byteLength, be), inner]);
          }),
    );
    const head = o.implicit
      ? concat([u16(e.group, be), u16(e.elem, be), u32(0xffffffff, be)])
      : concat([u16(e.group, be), u16(e.elem, be), vrBytes(e.vr), u16(0), u32(0xffffffff, be)]);
    return concat([head, frags, u16(0xfffe, be), u16(0xe0dd, be), u32(0, be)]);
  }

  if (o.implicit) {
    return concat([u16(e.group, be), u16(e.elem, be), u32(value.byteLength, be), value]);
  }

  if (LONG_VR.has(e.vr)) {
    return concat([
      u16(e.group, be),
      u16(e.elem, be),
      vrBytes(e.vr),
      u16(0),
      u32(value.byteLength, be),
      value,
    ]);
  }

  if (value.byteLength > 0xfffe) {
    // Sem forma curta possível: usa VR desconhecido com comprimento de 32 bits.
    return concat([
      u16(e.group, be),
      u16(e.elem, be),
      vrBytes("UN"),
      u16(0),
      u32(value.byteLength, be),
      value,
    ]);
  }

  return concat([
    u16(e.group, be),
    u16(e.elem, be),
    vrBytes(e.vr),
    u16(value.byteLength, be),
    value,
  ]);
}

function writeItems(e: DicomElement, o: ParseOpts): Uint8Array {
  return writeElement(e, o);
}

/** Monta a File Meta Information, recalculando (0002,0000). */
function buildMeta(f: DicomFile): Uint8Array {
  const o: ParseOpts = { implicit: false, bigEndian: false };
  const body = concat(
    f.meta.filter((e) => e.group === 0x0002 && e.elem !== 0x0000).map((e) => writeItems(e, o)),
  );
  const groupLength = new Uint8Array(4);
  new DataView(groupLength.buffer).setUint32(0, body.byteLength, true);
  return concat([
    u16(0x0002),
    u16(0x0000),
    vrBytes("UL"),
    u16(0),
    u32(4),
    groupLength,
    body,
  ]);
}

export function buildMetaElement(transferSyntax: string, sopClass: string, sopInstance: string) {
  const mk = (elem: number, vr: string, text: string): DicomElement => ({
    group: 0x0002,
    elem,
    vr,
    value: new TextEncoder().encode(text.length % 2 ? text + "\u0000" : text),
    items: null,
    undefinedLength: false,
  });
  return [
    mk(0x0001, "UI", sopClass),
    mk(0x0002, "UI", sopInstance),
    mk(0x0003, "UI", sopInstance),
    mk(0x0010, "UI", transferSyntax),
    mk(0x0012, "UI", "2.25.328951449451966303065558247111899980165"),
    mk(0x0013, "SH", "ANONIMIZADOR_DICOM_1"),
  ];
}

/** Serializa o arquivo completo: preâmbulo + meta + conjunto de dados. */
export function writeDicomFile(f: DicomFile): Uint8Array {
  const preamble = new Uint8Array(132);
  preamble.set([0x44, 0x49, 0x43, 0x4d], 128);

  const meta = f.meta.length > 0 ? buildMeta(f) : new Uint8Array(0);
  const o: ParseOpts = { implicit: f.implicitVR, bigEndian: f.bigEndian };
  const dataset = concat(f.elements.map((e) => writeItems(e, o)));
  return concat([preamble, meta, dataset]);
}

export { findElement, readText, tagInfo, ByteReader, EMPTY };
export type { DicomElement, DicomFile, DicomItem, ParseOpts };
