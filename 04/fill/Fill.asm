// This file is part of www.nand2tetris.org
// and the book "The Elements of Computing Systems"
// by Nisan and Schocken, MIT Press.
// File name: projects/04/Fill.asm

// Runs an infinite loop that listens to the keyboard input.
// When a key is pressed (any key), the program blackens the screen,
// i.e. writes "black" in every pixel;
// the screen should remain fully black as long as the key is pressed. 
// When no key is pressed, the program clears the screen, i.e. writes
// "white" in every pixel;
// the screen should remain fully clear as long as no key is pressed.

// Put your code here.

 // 主迴圈：持續偵測鍵盤
 (LOOP)

 // 讀取鍵盤狀態
 @KBD
 D=M

 // 沒有按鍵就跳到 WHITE
 @WHITE
 D;JEQ

 // 有按鍵：設定黑色
 @color
 M=-1

 // 跳到填色程式
 @FILL
 0;JMP

 // 沒有按鍵：設定白色
 (WHITE)
 @color
 M=0

 // 開始填滿螢幕
 (FILL)

 // 設定螢幕起始位置
 @SCREEN
 D=A
 @address
 M=D

 // 設定需要處理的記憶體數量
 @8192
 D=A
 @count
 M=D

 // 填色迴圈
 (FILL_LOOP)

 // 取得顏色
 @color
 D=M

 // 將顏色寫入螢幕
 @address
 A=M
 M=D

 // 移動到下一個記憶體位置
 @address
 M=M+1

 // 計數器減一
 @count
 M=M-1
 D=M

 // 還沒填完就繼續
 @FILL_LOOP
 D;JGT

 // 完成後重新偵測鍵盤
 @LOOP
 0;JMP
