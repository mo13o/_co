# nand2tetris Hack Assembler

這是一個零外部相依、使用 Node.js 實作的兩階段 Hack 組譯器，支援 nand2tetris Project 6 的完整語法：

- A 指令與 C 指令
- `(LABEL)` 標籤
- 預定義符號（`R0`–`R15`、`SP`、`LCL`、`ARG`、`THIS`、`THAT`、`SCREEN`、`KBD`）
- 自訂變數（從 RAM[16] 依序配置）
- 空白行及 `//` 註解
- 含來源行號的錯誤訊息

## 執行

需要 Node.js 18 或更新版本：

```powershell
node assembler.js Prog.asm
```

預設會在同一目錄產生 `Prog.hack`。也可以指定輸出位置：

```powershell
node assembler.js Prog.asm -o output.hack
```

## 測試

在本目錄執行：

```powershell
node --test assembler.test.js
```
