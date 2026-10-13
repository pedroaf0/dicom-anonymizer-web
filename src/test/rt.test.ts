import { readFileSync } from "node:fs";
import { it } from "vitest";
import * as P from "@/lib/dicom/parse";
import * as W from "@/lib/dicom/write";
it("x",()=>{for(const n of ["CT_small","MR_small"]){const b=new Uint8Array(readFileSync(`/dev-server/src/test/fixtures/${n}.dcm`));const f=P.parseDicomFile(b);console.log(n,f.transferSyntax,f.implicitVR,f.meta.length,f.elements.length);const o=W.writeDicomFile(f);console.log(b.length,o.length);try{P.parseDicomFile(o);console.log("rt ok")}catch(e){console.log("rt fail",String(e))}}});
