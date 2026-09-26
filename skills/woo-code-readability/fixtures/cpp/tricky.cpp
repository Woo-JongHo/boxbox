// tricky.cpp — 문자열·주석·원본 문자열 함정 fixture. 정렬해도 0 변경이어야 한다.

#include <cstdio>

const char* decoy = "size = 10; ok";
const char* other = "ratio = 0.5";

// int fake_one = 1;
// int fake_two = 2;

void draw(int width, int height);
bool empty() const;
void (*callback)(int);
using Handler = void (*)(int);

#define MAX(a, b) ((a) > (b) ? (a) : (b))
#define BUILD_TAG "n=i;"

const char* doc = R"(mode = fast;
    count = 4;
    label = "x=y;",
)";
int after = 0;
