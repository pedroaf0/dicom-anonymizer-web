import { readFileSync } from "node:fs";
import { it } from "vitest";
import * as P from "@/lib/dicom/parse";
it("x", () => { const b = new Uint8Array(readFileSync(`/dev-server/src/test/fixtures/CT_small.dcm`)); try { const f=P.parseDicomFile(b); console.log("OK", f.elements.length) } catch(e) { console.log("E", String(e), (e as Error).stack?.split("\n")[1]) } });
