package inventory

import (
    "fmt"
    "strings"
    "time"

    cache    "github.com/org/inventory-cache"
    memstore "github.com/org/inventory-memstore"
    trace    "github.com/org/inventory-trace"
)

/*
 * Item is one inventory item — widths are aligned through the tag column.
 */
type Item struct {
    ID         string    `json:"id" validate:"required"`
    Name       string    `json:"name"`
    Quantity   int       `json:"qty" validate:"min=0"`
    UnitPrice  float64   `json:"unit_price" validate:"min=0"` // subtotal unit price
    ModifiedAt time.Time `json:"modified_at"`
}

// Batch is a grouping unit — it does not share widths with the table above.
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

// A : inside a string value is not mistaken for structure.
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
    viewer: 2, // least privilege
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

// points are positional bundle rows — inner cell columns are aligned.
var points = [][]int{
    {1  , 22  },
    {333, 4   },
    {55 , 6666},
}

// labels are 3-cell bundle rows — a different arity, so no width shared with the table above.
var labels = []Label{
    {alpha, 1  , "x" },
    {b    , 333, "yy"},
    {gamma, 22 , "z" }, // cell columns align on the code part even with a comment
}

// pair has 2 rows, so it is reported but not aligned.
var pair = [][]int{
    {7, 8},
    {99, 10},
}
