// tables.cpp — C++ 표 정렬 fixture. 열축이 일부러 어긋나 있다(골든은 tables.aligned.cpp).

#pragma once

#include <string>
#include <vector>

namespace demo {

struct CacheConfig {
    int retries;
    const std::string& label;
    std::vector<int> keys;
    Node* next;
    bool verbose; // 재시도 스위치
};

struct Limits {
    int small;
    std::size_t total;
    bool enabled;
    // 주석은 구획을 끊는다 — 앞뒤 표가 폭을 공유하지 않는다
    const std::vector<int>& refIds;
    double ratioLimit;
    unsigned long flags;
};

struct Session {
    std::vector<int> seen = {};
    const char* mode = "a=b;c";
    int attempts = 10;
    bool loaded = false;
    double ratio = 0.5; // 마지막 관측값
};

struct Pending {
    bool dirty = false;
    bool stale = true;
};

enum class Mode {
    Unknown = 0,
    Slow = 250,
    Fast = 50,
    Fatal = 65535,
};

const ServerOptions options = {
    .port = 8080,
    .tag = "edge",
    .workers = 4,
    .timeoutSeconds = 30,
};

#define SMALL_LIMIT 4
#define LARGE_LIMIT 4096
#define DEFAULT_TAG "dev=1;"
#define BITMASK (1 << 10)

} // namespace demo
