// 객체 리터럴 표 1 — key·value 열에 어긋남이 있다.
const config = {
  short       : 1               ,
  aVeryLongKey: 22              ,
  mid         : "v:1;k=2"       , // 문자열 내부 구분자는 구조가 아니다
  deep        : { nested: true },
};

// 객체 리터럴 표 2 — 앞 표와 폭을 공유하지 않는다.
const limits = {
  low        : 5             ,
  higherLimit: 300           ,
  tiny       : `tpl:${1 + 1}`,
};

class Span {
  width  = 10         ;
  height = 200        ;
  label  = "w=10;h=2" ;
}

const small          = 1       ;
const extraLargeName = 222     ;
const midSize        = "a=b;c" ; // 꼬리 주석

// 짝 — 2행은 표로 묶지 않는다.
const pairOne = 1;
const pairTwo = 22;

// 묶음 행 표 — 셀 3개와 셀 4개 행이 맞닿아 있어도 arity가 다르면 폭을 공유하지 않는다.
const rows = [
  ["alpha", 1  , "x" ],
  ["b"    , 22 , "yy"],
  ["ccc"  , 333, "z" ], // 꼬리 주석은 닫는 대괄호 뒤에 붙는다
  ["a"  , 1  , true , null     ],
  ["bb" , 22 , false, undefined],
  ["x,y", 333, true , "z"      ],
];

// 묶음 짝 — 2행은 표로 묶지 않는다.
const pairRows = [
  ["pair", 1, 2],
  ["pairs", 22, 33],
];
