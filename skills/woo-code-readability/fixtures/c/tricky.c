/* 함정 fixture — 겉보기 필드, 문자열·주석 내부 구분자, 함수형 매크로가 섞여 있고 0 변경이어야 한다 */

#include <stdio.h>

#define SQUARE(x) ((x) * (x))
#define MAX(a, b) ((a) > (b) ? (a) : (b))
#define VERSION 2
#define LOOP for(;;)
#define WIDE 1 + \
    2 + \
    3

int add(int a, int b);
void run(void);

struct point {
    int x;
    int y;
};

static const char *message = "a = b; c = d";
static unsigned limit = 10;

int main(void) {
    int count = 0;
    for (int i = 0; i < 10; i++) {
        count += i;
    }
    if (count == 45) {
        count = 0;
    }
    while (count < 3) count++;
    return count;
}

unsigned int bits : 3;
char buffer[16];
x = y;
total += count;
count = count + 1;

/* 주석 안의 가짜 표
   int x = 1;
   NAME = 5,
   .field = value,
   #define FAKE 1
*/

// .name = "string = ;", .retries = 2, .timeout_ms = 3,

const char *code_text = "int x; unsigned y;";
char plus = '+';

create_window("main",
              width = 80,
              height = 60);
