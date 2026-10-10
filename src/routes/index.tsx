import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  EyeOff,
  FileArchive,
  FolderOpen,
  Github,
  Lock,
  ShieldCheck,
  Upload,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { buildZip, expandInputs, loadBatch, newContext, previewAfter, type LoadedBatch } from "@/lib/dicom/batch";
import { DEFAULT_OPTIONS, allRules, type AnonOptions, type DateMode } from "@/lib/dicom/rules";

/** Endereço do repositório: altere aqui quando publicar no GitHub. */
export const GITHUB_URL = "https://github.com/";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Anonimizador de Tomografias DICOM — 100% offline" },
      {
        name: "description",
        content: "Remova dados pessoais de tomografias DICOM no seu navegador. Nada é enviado: funciona sem internet e o código é aberto.",
      },
      { property: "og:title", content: "Anonimizador de Tomografias DICOM" },
      { property: "og:description", content: "Anonimize exames DICOM localmente, sem enviar nada. Código aberto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

async function entriesFromDrop(dt: DataTransfer): Promise<{ path: string; file: File }[]> {
  const out: { path: string; file: File }[] = [];
  const read = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      out.push({ path: prefix + entry.name, file });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      let batch: FileSystemEntry[];
      do {
        batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        for (const e of batch) await read(e, prefix + entry.name + "/");
      } while (batch.length > 0);
    }
  };
  const entries = [...dt.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[];
  if (entries.length === 0) return [...dt.files].map((f) => ({ path: f.name, file: f }));
  for (const e of entries) await read(e, "");
  return out;
}

function Masked({ value, show }: { value: string; show: boolean }) {
  return <span className="font-mono text-sm break-all">{show ? value : "•".repeat(Math.min(12, Math.max(6, value.length)))}</span>;
}

function Index() {
  const online = useOnline();
  const [batch, setBatch] = useState<LoadedBatch | null>(null);
  const [opts, setOpts] = useState<AnonOptions>(DEFAULT_OPTIONS);
  const [ctx, setCtx] = useState(newContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ count: number; errors: string[] } | null>(null);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    dirRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  async function handle(files: { path: string; file: File }[]) {
    if (files.length === 0) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const inputs = await expandInputs(files);
      const b = await loadBatch(inputs);
      if (b.dicoms.length === 0) setError("Nenhum arquivo DICOM foi encontrado.");
      setBatch(b);
      setCtx(newContext());
      setReveal({});
    } catch (e) {
      setError(`Não foi possível ler os arquivos: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function run() {
    if (!batch) return;
    setProgress(0);
    setResult(null);
    const { zip, errors } = await buildZip(batch.dicoms, opts, ctx, (d) => setProgress(d));
    const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "tomografia_anonimizada.zip";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setResult({ count: batch.dicoms.length - errors.length, errors });
    setProgress(null);
  }

  const rules = useMemo(() => allRules(), []);
  const set = <K extends keyof AnonOptions>(k: K, v: AnonOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" /> Anonimizador DICOM
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground">
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5 text-primary" />}
              {online ? "Online · nada é enviado" : "Offline · funcionando normalmente"}
            </span>
            <Button variant="outline" size="sm" asChild>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                <Github className="h-4 w-4" /> Código-fonte
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-5 py-10">
        <section className="space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <Lock className="h-3.5 w-3.5" /> Funciona offline · Nenhum arquivo sai do seu computador
          </span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Anonimize tomografias sem enviá-las a ninguém</h1>
          <p className="max-w-2xl text-muted-foreground">
            Escolha o ZIP, a pasta ou os arquivos DICOM do exame. Os dados pessoais são removidos aqui mesmo, no seu
            navegador, e você baixa um novo ZIP apenas com os DICOMs limpos. Você pode desligar a internet e conferir.
          </p>
        </section>

        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setDragging(false);
            handle(await entriesFromDrop(e.dataTransfer));
          }}
          className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${dragging ? "border-primary bg-accent" : "bg-card"}`}
        >
          <Upload className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 font-medium">{loading ? "Lendo arquivos…" : "Arraste aqui o ZIP, a pasta ou os arquivos .dcm"}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={loading}>
              <FileArchive className="h-4 w-4" /> Escolher ZIP ou arquivos
            </Button>
            <Button variant="outline" onClick={() => dirRef.current?.click()} disabled={loading}>
              <FolderOpen className="h-4 w-4" /> Escolher pasta
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => handle([...(e.target.files ?? [])].map((f) => ({ path: f.name, file: f })))}
          />
          <input
            ref={dirRef}
            type="file"
            multiple
            hidden
            onChange={(e) => handle([...(e.target.files ?? [])].map((f) => ({ path: f.webkitRelativePath || f.name, file: f })))}
          />
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        </section>

        {batch && batch.dicoms.length > 0 && (
          <>
            <section className="grid grid-cols-3 gap-3">
              {[
                ["Arquivos lidos", batch.total],
                ["DICOM", batch.dicoms.length],
                ["Ignorados", batch.skipped.length],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg border bg-card p-4">
                  <div className="text-2xl font-semibold">{v}</div>
                  <div className="text-xs text-muted-foreground">{l}</div>
                </div>
              ))}
            </section>
            {batch.skipped.length > 0 && (
              <p className="-mt-6 text-xs text-muted-foreground">
                Arquivos que não são DICOM (e o índice DICOMDIR) não entram no ZIP final.
              </p>
            )}

            <section className="space-y-4 rounded-xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Novo nome e opções</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Novo nome do paciente</Label>
                  <Input id="name" value={opts.patientName} onChange={(e) => set("patientName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pid">Novo código (ID) do paciente</Label>
                  <Input id="pid" value={opts.patientId} onChange={(e) => set("patientId", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Datas do exame e nascimento</Label>
                <RadioGroup value={opts.dateMode} onValueChange={(v) => set("dateMode", v as DateMode)} className="grid gap-2 sm:grid-cols-3">
                  {[
                    ["shift", "Deslocar", "Mesma diferença entre datas, mas em outra época"],
                    ["remove", "Remover", "Apaga todas as datas"],
                    ["keep", "Manter", "Datas originais (menos anônimo)"],
                  ].map(([v, l, d]) => (
                    <label key={v} className="flex cursor-pointer gap-2 rounded-lg border p-3 text-sm">
                      <RadioGroupItem value={v} className="mt-0.5" />
                      <span>
                        <span className="font-medium">{l}</span>
                        <span className="block text-xs text-muted-foreground">{d}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              {(
                [
                  ["keepSexAge", "Manter sexo e idade", "Úteis para interpretar o exame e pouco identificáveis."],
                  ["removePrivateTags", "Remover campos privados de fabricantes", "Podem guardar dados pessoais escondidos."],
                  ["removeDevice", "Remover equipamento e local", "Nome da máquina, número de série, estação."],
                  ["removeDescriptions", "Remover descrições em texto livre", "Às vezes contêm nomes digitados à mão."],
                ] as const
              ).map(([k, l, d]) => (
                <div key={k} className="flex items-start justify-between gap-4 border-t pt-3">
                  <div>
                    <div className="text-sm font-medium">{l}</div>
                    <div className="text-xs text-muted-foreground">{d}</div>
                  </div>
                  <Switch checked={opts[k]} onCheckedChange={(v) => set(k, v)} />
                </div>
              ))}
            </section>

            {batch.studies.map((s, si) => (
              <section key={s.key} className="overflow-hidden rounded-xl border bg-card">
                <div className="flex items-center justify-between border-b px-5 py-3">
                  <h2 className="font-semibold">
                    Estudo {si + 1} <span className="text-sm font-normal text-muted-foreground">· {s.files} arquivos</span>
                  </h2>
                </div>
                <div className="divide-y">
                  {s.fields.map((f) => {
                    const id = `${si}-${f.tag}`;
                    const after = previewAfter(f, opts, ctx);
                    return (
                      <div key={id} className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-[1fr_1.4fr_1.4fr] sm:gap-4">
                        <div className="text-xs text-muted-foreground">{f.label}</div>
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => setReveal((r) => ({ ...r, [id]: !r[id] }))}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={reveal[id] ? "Ocultar valor" : "Mostrar valor"}
                          >
                            {reveal[id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <Masked value={f.before} show={!!reveal[id]} />
                        </div>
                        <div className="text-sm">
                          {after === null ? (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <X className="h-3.5 w-3.5" /> removido
                            </span>
                          ) : after === f.before ? (
                            <span className="text-muted-foreground">mantido</span>
                          ) : (
                            <span className="font-mono break-all text-primary">{after}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            <section className="space-y-3">
              <Button size="lg" onClick={run} disabled={progress !== null} className="w-full sm:w-auto">
                <Download className="h-4 w-4" /> Anonimizar e baixar ZIP
              </Button>
              {progress !== null && (
                <div className="space-y-1">
                  <Progress value={(progress / batch.dicoms.length) * 100} />
                  <p className="text-xs text-muted-foreground">
                    {progress} de {batch.dicoms.length} arquivos
                  </p>
                </div>
              )}
              {result && (
                <p className="text-sm">
                  Pronto: {result.count} arquivos anonimizados no ZIP baixado.
                  {result.errors.length > 0 && <span className="text-destructive"> {result.errors.length} não puderam ser processados.</span>}
                </p>
              )}
            </section>
          </>
        )}

        <section className="space-y-4 border-t pt-10">
          <h2 className="text-xl font-semibold">Como funciona</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Tudo é feito no seu navegador. O app não tem servidor, não usa estatísticas de acesso e não carrega nada de fora.</li>
            <li>As regras seguem o perfil básico de confidencialidade da norma DICOM (PS3.15, Anexo E).</li>
            <li>Os identificadores técnicos (UIDs) são trocados por novos, mantendo as séries do mesmo exame agrupadas.</li>
            <li>Os arquivos recebem nomes neutros (SERIE_001/IMG_00001.dcm) e são marcados como "identidade removida".</li>
            <li className="text-foreground">
              Limitação: textos gravados dentro da própria imagem (como nomes impressos nos pixels) não são removidos. Confira as imagens antes de compartilhar.
            </li>
          </ul>
          <details className="rounded-xl border bg-card p-5">
            <summary className="cursor-pointer font-medium">Lista completa dos campos tratados</summary>
            <div className="mt-4 space-y-5">
              {rules.map((g) => (
                <div key={g.group}>
                  <h3 className="mb-2 text-sm font-semibold">{g.group}</h3>
                  <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {g.items.map((r) => (
                      <div key={r.tag} className="flex gap-2 text-xs">
                        <span className="font-mono text-muted-foreground">{r.tag}</span>
                        <span>{r.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Campos privados de fabricantes (grupos ímpares) são removidos quando a opção está ligada.</p>
            </div>
          </details>
        </section>
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Código aberto ·{" "}
        <a href={GITHUB_URL} className="underline" target="_blank" rel="noreferrer">
          ver no GitHub
        </a>
      </footer>
    </div>
  );
}
