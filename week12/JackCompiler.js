#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const KEYWORDS = new Set([
  'class', 'constructor', 'function', 'method', 'field', 'static', 'var',
  'int', 'char', 'boolean', 'void', 'true', 'false', 'null', 'this',
  'let', 'do', 'if', 'else', 'while', 'return'
]);
const SYMBOLS = new Set('{}()[].,;+-*/&|<>=~');

class JackTokenizer {
  constructor(source) {
    this.tokens = this.tokenize(source);
    this.index = 0;
  }

  tokenize(source) {
    const out = [];
    let i = 0;
    while (i < source.length) {
      if (/\s/.test(source[i])) { i += 1; continue; }
      if (source[i] === '/' && source[i + 1] === '/') {
        i += 2;
        while (i < source.length && source[i] !== '\n') i += 1;
        continue;
      }
      if (source[i] === '/' && source[i + 1] === '*') {
        const end = source.indexOf('*/', i + 2);
        if (end < 0) throw new Error('Unterminated block comment');
        i = end + 2;
        continue;
      }
      if (source[i] === '"') {
        const start = ++i;
        while (i < source.length && source[i] !== '"') {
          if (source[i] === '\n') throw new Error('Newline in string constant');
          i += 1;
        }
        if (i >= source.length) throw new Error('Unterminated string constant');
        out.push({ type: 'stringConstant', value: source.slice(start, i) });
        i += 1;
        continue;
      }
      if (SYMBOLS.has(source[i])) {
        out.push({ type: 'symbol', value: source[i++] });
        continue;
      }
      if (/\d/.test(source[i])) {
        const start = i;
        while (i < source.length && /\d/.test(source[i])) i += 1;
        const value = Number(source.slice(start, i));
        if (value > 32767) throw new Error(`Integer constant out of range: ${value}`);
        out.push({ type: 'integerConstant', value });
        continue;
      }
      if (/[A-Za-z_]/.test(source[i])) {
        const start = i;
        while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) i += 1;
        const value = source.slice(start, i);
        out.push({ type: KEYWORDS.has(value) ? 'keyword' : 'identifier', value });
        continue;
      }
      throw new Error(`Unexpected character ${JSON.stringify(source[i])}`);
    }
    return out;
  }

  peek(offset = 0) { return this.tokens[this.index + offset]; }
  hasMore() { return this.index < this.tokens.length; }
  advance() {
    if (!this.hasMore()) throw new Error('Unexpected end of input');
    return this.tokens[this.index++];
  }
}

class SymbolTable {
  constructor() { this.classScope = new Map(); this.startSubroutine(); }
  startSubroutine() { this.subScope = new Map(); this.counts = { static: 0, field: 0, argument: 0, var: 0 }; }
  define(name, type, kind) {
    const table = (kind === 'static' || kind === 'field') ? this.classScope : this.subScope;
    table.set(name, { type, kind, index: this.counts[kind]++ });
  }
  varCount(kind) { return this.counts[kind]; }
  lookup(name) { return this.subScope.get(name) || this.classScope.get(name); }
}

class VMWriter {
  constructor() { this.lines = []; }
  write(line) { this.lines.push(line); }
  push(segment, index) { this.write(`push ${segment} ${index}`); }
  pop(segment, index) { this.write(`pop ${segment} ${index}`); }
  arithmetic(command) { this.write(command); }
  label(name) { this.write(`label ${name}`); }
  goto(name) { this.write(`goto ${name}`); }
  ifGoto(name) { this.write(`if-goto ${name}`); }
  call(name, count) { this.write(`call ${name} ${count}`); }
  function(name, count) { this.write(`function ${name} ${count}`); }
  return() { this.write('return'); }
  toString() { return `${this.lines.join('\n')}\n`; }
}

const SEGMENT = { static: 'static', field: 'this', argument: 'argument', var: 'local' };
const BINARY_OP = { '+': 'add', '-': 'sub', '&': 'and', '|': 'or', '<': 'lt', '>': 'gt', '=': 'eq' };
const UNARY_OP = { '-': 'neg', '~': 'not' };

class CompilationEngine {
  constructor(tokenizer, fileName) {
    this.t = tokenizer;
    this.fileName = fileName;
    this.symbols = new SymbolTable();
    this.vm = new VMWriter();
    this.className = '';
    this.labelCounter = 0;
  }

  error(message) {
    const token = this.t.peek();
    throw new Error(`${this.fileName}: ${message}; got ${token ? `${token.type} ${JSON.stringify(token.value)}` : 'end of input'}`);
  }
  is(value) { return this.t.peek()?.value === value; }
  isOneOf(values) { return values.includes(this.t.peek()?.value); }
  take(value) {
    const token = this.t.advance();
    if (value !== undefined && token.value !== value) this.error(`Expected ${JSON.stringify(value)}`);
    return token;
  }
  identifier() {
    const token = this.t.advance();
    if (token.type !== 'identifier') this.error('Expected identifier');
    return token.value;
  }
  type(allowVoid = false) {
    const token = this.t.advance();
    const valid = token.type === 'identifier' || ['int', 'char', 'boolean'].includes(token.value) || (allowVoid && token.value === 'void');
    if (!valid) this.error('Expected type');
    return token.value;
  }
  label(prefix) { return `${prefix}${this.labelCounter++}`; }

  compileClass() {
    this.take('class');
    this.className = this.identifier();
    this.take('{');
    while (this.isOneOf(['static', 'field'])) this.compileClassVarDec();
    while (this.isOneOf(['constructor', 'function', 'method'])) this.compileSubroutine();
    this.take('}');
    if (this.t.hasMore()) this.error('Unexpected tokens after class');
    return this.vm.toString();
  }

  compileClassVarDec() {
    const kind = this.take().value;
    const type = this.type();
    this.symbols.define(this.identifier(), type, kind);
    while (this.is(',')) { this.take(','); this.symbols.define(this.identifier(), type, kind); }
    this.take(';');
  }

  compileSubroutine() {
    const kind = this.take().value;
    this.type(true);
    const name = this.identifier();
    this.symbols.startSubroutine();
    if (kind === 'method') this.symbols.define('this', this.className, 'argument');
    this.take('(');
    this.compileParameterList();
    this.take(')');
    this.take('{');
    while (this.is('var')) this.compileVarDec();
    this.vm.function(`${this.className}.${name}`, this.symbols.varCount('var'));
    if (kind === 'constructor') {
      this.vm.push('constant', this.symbols.varCount('field'));
      this.vm.call('Memory.alloc', 1);
      this.vm.pop('pointer', 0);
    } else if (kind === 'method') {
      this.vm.push('argument', 0);
      this.vm.pop('pointer', 0);
    }
    this.compileStatements();
    this.take('}');
  }

  compileParameterList() {
    if (this.is(')')) return;
    while (true) {
      const type = this.type();
      this.symbols.define(this.identifier(), type, 'argument');
      if (!this.is(',')) break;
      this.take(',');
    }
  }

  compileVarDec() {
    this.take('var');
    const type = this.type();
    this.symbols.define(this.identifier(), type, 'var');
    while (this.is(',')) { this.take(','); this.symbols.define(this.identifier(), type, 'var'); }
    this.take(';');
  }

  compileStatements() {
    while (this.isOneOf(['let', 'if', 'while', 'do', 'return'])) {
      if (this.is('let')) this.compileLet();
      else if (this.is('if')) this.compileIf();
      else if (this.is('while')) this.compileWhile();
      else if (this.is('do')) this.compileDo();
      else this.compileReturn();
    }
  }

  symbol(name) {
    const entry = this.symbols.lookup(name);
    if (!entry) this.error(`Undefined variable ${name}`);
    return entry;
  }
  pushVar(name) { const s = this.symbol(name); this.vm.push(SEGMENT[s.kind], s.index); }
  popVar(name) { const s = this.symbol(name); this.vm.pop(SEGMENT[s.kind], s.index); }

  compileLet() {
    this.take('let');
    const name = this.identifier();
    const array = this.is('[');
    if (array) {
      this.pushVar(name);
      this.take('['); this.compileExpression(); this.take(']');
      this.vm.arithmetic('add');
    }
    this.take('='); this.compileExpression(); this.take(';');
    if (array) {
      this.vm.pop('temp', 0);
      this.vm.pop('pointer', 1);
      this.vm.push('temp', 0);
      this.vm.pop('that', 0);
    } else this.popVar(name);
  }

  compileIf() {
    this.take('if');
    const trueLabel = this.label('IF_TRUE');
    const falseLabel = this.label('IF_FALSE');
    const endLabel = this.label('IF_END');
    this.take('('); this.compileExpression(); this.take(')');
    this.vm.ifGoto(trueLabel);
    this.vm.goto(falseLabel);
    this.vm.label(trueLabel);
    this.take('{'); this.compileStatements(); this.take('}');
    if (this.is('else')) {
      this.vm.goto(endLabel);
      this.vm.label(falseLabel);
      this.take('else'); this.take('{'); this.compileStatements(); this.take('}');
      this.vm.label(endLabel);
    } else this.vm.label(falseLabel);
  }

  compileWhile() {
    this.take('while');
    const start = this.label('WHILE_EXP');
    const end = this.label('WHILE_END');
    this.vm.label(start);
    this.take('('); this.compileExpression(); this.take(')');
    this.vm.arithmetic('not');
    this.vm.ifGoto(end);
    this.take('{'); this.compileStatements(); this.take('}');
    this.vm.goto(start);
    this.vm.label(end);
  }

  compileDo() {
    this.take('do');
    this.compileSubroutineCall();
    this.take(';');
    this.vm.pop('temp', 0);
  }

  compileReturn() {
    this.take('return');
    if (!this.is(';')) this.compileExpression();
    else this.vm.push('constant', 0);
    this.take(';');
    this.vm.return();
  }

  compileExpression() {
    this.compileTerm();
    while (this.isOneOf(['+', '-', '*', '/', '&', '|', '<', '>', '='])) {
      const op = this.take().value;
      this.compileTerm();
      if (op === '*') this.vm.call('Math.multiply', 2);
      else if (op === '/') this.vm.call('Math.divide', 2);
      else this.vm.arithmetic(BINARY_OP[op]);
    }
  }

  compileTerm() {
    const token = this.t.peek();
    if (!token) this.error('Expected term');
    if (token.type === 'integerConstant') {
      this.vm.push('constant', this.take().value);
    } else if (token.type === 'stringConstant') {
      const text = this.take().value;
      this.vm.push('constant', text.length);
      this.vm.call('String.new', 1);
      for (const char of text) {
        this.vm.push('constant', char.charCodeAt(0));
        this.vm.call('String.appendChar', 2);
      }
    } else if (token.type === 'keyword') {
      const keyword = this.take().value;
      if (keyword === 'this') this.vm.push('pointer', 0);
      else if (keyword === 'true') { this.vm.push('constant', 0); this.vm.arithmetic('not'); }
      else if (keyword === 'false' || keyword === 'null') this.vm.push('constant', 0);
      else this.error(`Invalid keyword constant ${keyword}`);
    } else if (token.value === '(') {
      this.take('('); this.compileExpression(); this.take(')');
    } else if (token.value === '-' || token.value === '~') {
      const op = this.take().value;
      this.compileTerm();
      this.vm.arithmetic(UNARY_OP[op]);
    } else if (token.type === 'identifier') {
      if (this.t.peek(1)?.value === '(' || this.t.peek(1)?.value === '.') {
        this.compileSubroutineCall();
      } else {
        const name = this.identifier();
        if (this.is('[')) {
          this.pushVar(name);
          this.take('['); this.compileExpression(); this.take(']');
          this.vm.arithmetic('add');
          this.vm.pop('pointer', 1);
          this.vm.push('that', 0);
        } else this.pushVar(name);
      }
    } else this.error('Expected term');
  }

  compileSubroutineCall() {
    const first = this.identifier();
    let target;
    let args = 0;
    if (this.is('.')) {
      this.take('.');
      const second = this.identifier();
      const variable = this.symbols.lookup(first);
      if (variable) {
        this.vm.push(SEGMENT[variable.kind], variable.index);
        target = `${variable.type}.${second}`;
        args = 1;
      } else target = `${first}.${second}`;
    } else {
      this.vm.push('pointer', 0);
      target = `${this.className}.${first}`;
      args = 1;
    }
    this.take('(');
    args += this.compileExpressionList();
    this.take(')');
    this.vm.call(target, args);
  }

  compileExpressionList() {
    let count = 0;
    if (this.is(')')) return count;
    while (true) {
      this.compileExpression(); count += 1;
      if (!this.is(',')) break;
      this.take(',');
    }
    return count;
  }
}

function compileFile(input, output) {
  const source = fs.readFileSync(input, 'utf8');
  const tokenizer = new JackTokenizer(source);
  const engine = new CompilationEngine(tokenizer, input);
  fs.writeFileSync(output, engine.compileClass(), 'utf8');
  console.log(`${input} -> ${output}`);
}

function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node JackCompiler.js <file.jack | directory>');
    process.exit(2);
  }
  const resolved = path.resolve(target);
  if (!fs.existsSync(resolved)) throw new Error(`Path not found: ${resolved}`);
  const stat = fs.statSync(resolved);
  const files = stat.isDirectory()
    ? fs.readdirSync(resolved).filter((name) => name.toLowerCase().endsWith('.jack')).sort().map((name) => path.join(resolved, name))
    : [resolved];
  if (files.length === 0) throw new Error(`No .jack files found: ${resolved}`);
  for (const input of files) compileFile(input, input.replace(/\.jack$/i, '.vm'));
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message); process.exit(1); }
}

module.exports = { JackTokenizer, SymbolTable, VMWriter, CompilationEngine, compileFile };
