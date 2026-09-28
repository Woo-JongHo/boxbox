package tricky

import "fmt"

// Name    string    `json:"name"` — look-alike field row inside a comment
// Key:      value,
// Alias   "pkg/inside-comment"

type Record struct {
	Label string `json:"label;key=name" validate:"min=1"` // a one-row table is not an alignment target
}

var lookalike = "Name       =    value"

var table = map[string]string{
	// code:  value,
	"note": "key:   value, inside string",
}

const greeting = "Alias   \"pkg/path\""

func demo(ok bool) {
	if ok == true {
		return
	}
	defer fmt.Println("field:     value,")
	go func() {
		fmt.Println("Name   string   `json:\"x\"`")
	}()
	s := "Key   string   `json:\"k\"`"
	x := 1; y := 2
	_ = s
	_ = x
	_ = y
}
