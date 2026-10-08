// This file is part of www.nand2tetris.org
// and the book "The Elements of Computing Systems"
// by Nisan and Schocken, MIT Press.
// File name: projects/04/Mult.asm

// Multiplies R0 and R1 and stores the result in R2.
// (R0, R1, R2 refer to RAM[0], RAM[1], and RAM[2], respectively.)

// Put your code here.

 // 將 R2 初始化為 0
 @R2
 M=0

 // 將 R1 的值存入計數器
 @R1
 D=M
 @count
 M=D

 // 開始迴圈
 (LOOP)

 // 檢查 count 是否為 0
 @count
 D=M
 @END
 D;JEQ

 // R2 = R2 + R0
 @R0
 D=M
 @R2
 M=D+M

 // count = count - 1
 @count
 M=M-1

 // 返回 LOOP
 @LOOP
 0;JMP

 // 程式結束
 (END)
 @END
 0;JMP
