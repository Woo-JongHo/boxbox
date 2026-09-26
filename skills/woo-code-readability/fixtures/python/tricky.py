# tricky.py — 문자열·주석 함정 fixture. 겉보기 표 행이어도 구조가 아니면 정렬하지 않는다.

URL = "http://example.com/?a=b#c"       # 문자열 안의 : = #
TEMPLATE = 'key: {value}'               # 문자열 안의 콜론·중괄호

look_alike = {
    "a: b": "x=y#z",
    ":=:#": "=$=",
}

def render(template, values):
    return template.format(**values)

class Rendering:
    limit = 10
    label = "n:m"

handler = lambda: None

wrapped = "a=b" + \
    "c:d"

if enabled:
    mode = "fast:mode"
