import { readFileSync } from "node:fs";
import { it } from "vitest";
import * as P from "@/lib/dicom/parse";
it("x", () => { const b = new Uint8Array(readFileSync(`/dev-server/src/test/fixtures/CT_small.dcm`)); try { P.parseDicomFile(b) } catch(e) { console.log(String(e)) } });
