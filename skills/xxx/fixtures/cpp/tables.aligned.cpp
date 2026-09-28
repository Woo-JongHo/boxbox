// tables.cpp — C++ table alignment fixture. Column axes are deliberately misaligned (golden: tables.aligned.cpp).

#pragma once

#include <string>
#include <vector>

namespace demo {

struct CacheConfig {
    int                retries;
    const std::string& label  ;
    std::vector<int>   keys   ;
    Node*              next   ;
    bool               verbose; // retry switch
};

struct Limits {
    int         small  ;
    std::size_t total  ;
    bool        enabled;
    // A comment breaks the section — tables before and after do not share widths
    const std::vector<int>& refIds    ;
    double                  ratioLimit;
    unsigned long           flags     ;
};

struct Session {
    std::vector<int> seen     = {}     ;
    const char*      mode     = "a=b;c";
    int              attempts = 10     ;
    bool             loaded   = false  ;
    double           ratio    = 0.5    ; // last observed value
};

struct Pending {
    bool dirty = false;
    bool stale = true;
};

enum class Mode {
    Unknown = 0    ,
    Slow    = 250  ,
    Fast    = 50   ,
    Fatal   = 65535,
};

const ServerOptions options = {
    .port           = 8080  ,
    .tag            = "edge",
    .workers        = 4     ,
    .timeoutSeconds = 30    ,
};

static const Entry rows[] = {
    {"alpha", 1,   0x10},
    {"b, c",  22,  2},
    {"ccc",   333, 0x201},
};

static const Switch flags[] = {
    {"mode",  true},
    {"cache", false},
    {"log",   true},
};

static const Endpoint endpoints[] = {
    {"edge", 8080, nullptr, Mode::Fast},
    {"core", 2, nullptr, Mode::Slow},
};

#define SMALL_LIMIT 4
#define LARGE_LIMIT 4096
#define DEFAULT_TAG "dev=1;"
#define BITMASK     (1 << 10)

} // namespace demo
