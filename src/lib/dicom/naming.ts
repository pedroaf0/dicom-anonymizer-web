/** Como o ZIP baixado é nomeado. Tudo calculado localmente. */
export type NameMode = "timestamp" | "timestamp-hash" | "custom";

/** AAAAMMDD-HHMMSS no horário local. */
export function timestamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** 8 primeiros caracteres hex do SHA-256 do nome original (não revela o nome). */
export async function shortHash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 4).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Remove caracteres inválidos em nomes de arquivo. */
export function sanitize(name: string): string {
  return name.replace(/\.zip$/i, "").replace(/[\\/:*?"<>|\x00-\x1f]+/g, "_").replace(/^[_\s.]+|[_\s.]+$/g, "").slice(0, 120);
}

export async function zipName(opts: {
  mode: NameMode;
  custom: string;
  original: string;
  date: Date;
  suffix?: string;
}): Promise<string> {
  const ts = timestamp(opts.date);
  let base: string;
  if (opts.mode === "custom") base = sanitize(opts.custom) || ts;
  else if (opts.mode === "timestamp-hash") base = `${ts}_${await shortHash(opts.original)}`;
  else base = ts;
  return `${base}${opts.suffix ? `_${opts.suffix}` : ""}.zip`;
}
