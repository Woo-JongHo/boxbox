package inventory

import (
    "fmt"
    "strings"
    "time"

    cache    "github.com/woo/inventory-cache"
    memstore "github.com/woo/inventory-memstore"
    trace    "github.com/woo/inventory-trace"
)

/*
 * Item은 재고 품목 한 건이다 — 태그 열까지 폭을 맞춘다.
 */
type Item struct {
    ID         string    `json:"id" validate:"required"`
    Name       string    `json:"name"`
    Quantity   int       `json:"qty" validate:"min=0"`
    UnitPrice  float64   `json:"unit_price" validate:"min=0"` // 소계 단가
    ModifiedAt time.Time `json:"modified_at"`
}

// Batch는 묶음 단위다 — 위 표와 폭을 공유하지 않는다.
type Batch struct {
    Code string   `json:"code"`
    Note string   `json:"note:nullable"`
    Tags []string `json:"tags"`
}

type (
    NodeID    string
    EdgeLabel string
    Weight    int
)

const (
    MaxWeight     = 40
    MinWeight     = 1
    DefaultWeight = 12
)

// 문자열 값 안에 : 이 있어도 구조로 오판하지 않는다.
const (
    OpenHour   = "07:30"
    CloseHour  = "22:30"
    BreakStart = "12:00"
)

const (
    DefaultUnit  string = "kg"
    OverflowUnit string = "t"
    TinyUnit     string = "g"
)

var roleWeights = map[string]int{
    admin : 9,
    editor: 5,
    viewer: 2, // 최소 권한
}

var endpoints = map[string]string{
    users  : "/v1/users?sort=name"        ,
    orders : "/v1/orders:search"          ,
    reports: "/v1/reports?from=2024-01-01",
}

var aliases = map[string]string{
    usr: "user",
    grp: "group",
}
