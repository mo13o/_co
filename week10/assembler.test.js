"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { assemble, AssemblyError } = require("./assembler");

test("assembles A and C instructions", () => {
  assert.deepEqual(assemble("@2\nD=A\n@3\nD=D+A\n@0\nM=D\n").trim().split("\n"), [
    "0000000000000010", "1110110000010000", "0000000000000011",
    "1110000010010000", "0000000000000000", "1110001100001000"
  ]);
});

test("resolves labels, variables, comments, and predefined symbols", () => {
  const code = assemble("@i // variable\nM=1\n(LOOP)\n@i\nM=M+1\n@LOOP\n0;JMP\n@SCREEN\n").trim().split("\n");
  assert.equal(code[0], "0000000000010000");
  assert.equal(code[2], "0000000000010000");
  assert.equal(code[4], "0000000000000010");
  assert.equal(code[6], "0100000000000000");
});

test("reports source line for invalid instruction", () => {
  assert.throws(() => assemble("@0\nD=Q\n"), error => error instanceof AssemblyError && /第 2 行/.test(error.message));
});

test("rejects out-of-range A constants and duplicate labels", () => {
  assert.throws(() => assemble("@32768\n"), /15-bit/);
  assert.throws(() => assemble("(X)\n(X)\n"), /標籤重複/);
});
