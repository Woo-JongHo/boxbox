package tricky

import "fmt"

// Name    string    `json:"name"` — 주석 안의 겉보기 필드 행
// Key:      value,
// Alias   "pkg/inside-comment"

type Record struct {
	Label string `json:"label;key=name" validate:"min=1"` // 한 행 표는 정렬 대상이 아니다
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
