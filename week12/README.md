# nand2tetris Jack Compiler

這是一個以 Node.js 實作的 Jack → VM 編譯器，對應 nand2tetris 第 11 章 Project 11。

## 功能

- Jack tokenizer：關鍵字、符號、整數、字串、identifier、註解
- class/subroutine symbol table：`static`、`field`、`argument`、`var`
- 完整 recursive-descent parser
- VM code generation：運算式、陣列、字串、控制流程、method/function/constructor 與呼叫
- 可編譯單一 `.jack` 檔或含多個 `.jack` 檔的資料夾

## 使用方式

先安裝 Node.js 18 或更新版本，不需要安裝任何 npm 套件。

```powershell
node JackCompiler.js path\to\Main.jack
node JackCompiler.js path\to\Pong
```

Windows 也可使用：

```powershell
.\JackCompiler.cmd path\to\Square
```

編譯器會在每個 `.jack` 檔旁產生同名 `.vm` 檔。

本編譯器已使用第 11 章的 Average、ComplexArrays、ConvertToBin、Pong、Seven、Square 完成編譯測試。
