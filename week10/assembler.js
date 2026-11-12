#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEST = { "": "000", M: "001", D: "010", MD: "011", A: "100", AM: "101", AD: "110", AMD: "111" };
const JUMP = { "": "000", JGT: "001", JEQ: "010", JGE: "011", JLT: "100", JNE: "101", JLE: "110", JMP: "111" };
const COMP = {
  "0":"0101010", "1":"0111111", "-1":"0111010", D:"0001100", A:"0110000", M:"1110000",
  "!D":"0001101", "!A":"0110001", "!M":"1110001", "-D":"0001111", "-A":"0110011", "-M":"1110011",
  "D+1":"0011111", "A+1":"0110111", "M+1":"1110111", "D-1":"0001110", "A-1":"0110010", "M-1":"1110010",
  "D+A":"0000010", "D+M":"1000010", "D-A":"0010011", "D-M":"1010011", "A-D":"0000111", "M-D":"1000111",
  "D&A":"0000000", "D&M":"1000000", "D|A":"0010101", "D|M":"1010101"
};
const SYMBOL_RE = /^[A-Za-z_.$:][A-Za-z0-9_.$:]*$/;

class AssemblyError extends Error {}
const errorAt = (line, message) => new AssemblyError(`第 ${line} 行：${message}`);

function predefinedSymbols() {
  const symbols = { SP:0, LCL:1, ARG:2, THIS:3, THAT:4, SCREEN:16384, KBD:24576 };
  for (let i = 0; i < 16; i++) symbols[`R${i}`] = i;
  return symbols;
}

function assemble(source) {
  const lines = source.split(/\r?\n/).map((raw, i) => [i + 1, raw.split("//", 1)[0].trim()]).filter(([, text]) => text);
  const symbols = predefinedSymbols();
  const instructions = [];
  let rom = 0;

  for (const [line, text] of lines) {
    if (text.startsWith("(") || text.endsWith(")")) {
      if (!(text.startsWith("(") && text.endsWith(")"))) throw errorAt(line, `不完整的標籤：${text}`);
      const name = text.slice(1, -1).trim();
      if (!SYMBOL_RE.test(name)) throw errorAt(line, `無效的標籤名稱：${name || "(空白)"}`);
      if (Object.hasOwn(symbols, name)) throw errorAt(line, `標籤重複或使用保留符號：${name}`);
      symbols[name] = rom;
    } else {
      instructions.push([line, text]);
      rom++;
    }
  }

  const output = [];
  let nextVariable = 16;
  for (const [line, text] of instructions) {
    if (text.startsWith("@")) {
      const token = text.slice(1).trim();
      if (!token) throw errorAt(line, "A 指令缺少位址或符號");
      let value;
      if (/^\d+$/.test(token)) {
        value = Number(token);
        if (value > 32767) throw errorAt(line, `A 指令常數超出 15-bit 範圍：${value}`);
      } else {
        if (!SYMBOL_RE.test(token)) throw errorAt(line, `無效的符號：${token}`);
        if (!Object.hasOwn(symbols, token)) {
          if (nextVariable > 16383) throw errorAt(line, "變數記憶體空間已用盡");
          symbols[token] = nextVariable++;
        }
        value = symbols[token];
      }
      output.push(value.toString(2).padStart(16, "0"));
      continue;
    }

    if ((text.match(/=/g) || []).length > 1 || (text.match(/;/g) || []).length > 1) throw errorAt(line, `無效的 C 指令：${text}`);
    const equal = text.indexOf("=");
    const dest = equal < 0 ? "" : text.slice(0, equal).trim();
    const rest = equal < 0 ? text : text.slice(equal + 1);
    const semi = rest.indexOf(";");
    const comp = (semi < 0 ? rest : rest.slice(0, semi)).trim();
    const jump = (semi < 0 ? "" : rest.slice(semi + 1)).trim();
    if (!Object.hasOwn(DEST, dest)) throw errorAt(line, `未知的 dest：${dest}`);
    if (!Object.hasOwn(COMP, comp)) throw errorAt(line, `未知的 comp：${comp || "(空白)"}`);
    if (!Object.hasOwn(JUMP, jump)) throw errorAt(line, `未知的 jump：${jump}`);
    output.push(`111${COMP[comp]}${DEST[dest]}${JUMP[jump]}`);
  }
  return output.length ? output.join("\n") + "\n" : "";
}

function main(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    console.log("用法: node assembler.js <input.asm> [-o output.hack]");
    return argv.length ? 0 : 1;
  }
  const input = argv[0];
  const outputFlag = argv.indexOf("-o");
  if (outputFlag >= 0 && !argv[outputFlag + 1]) throw new Error("-o 缺少輸出檔名");
  const output = outputFlag >= 0 ? argv[outputFlag + 1] : input.replace(/\.[^.\\/]+$/, "") + ".hack";
  const code = assemble(fs.readFileSync(input, "utf8").replace(/^\uFEFF/, ""));
  fs.writeFileSync(output, code, "ascii");
  console.log(`已輸出 ${code.trim() ? code.trim().split("\n").length : 0} 條指令至 ${output}`);
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error instanceof AssemblyError ? `組譯失敗：${error.message}` : `檔案錯誤：${error.message}`); process.exitCode = 1; }
}

module.exports = { assemble, AssemblyError, main };
