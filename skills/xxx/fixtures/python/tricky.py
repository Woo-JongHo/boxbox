# tricky.py — string and comment trap fixture. Look-alike table rows are not aligned unless they are structure.

URL = "http://example.com/?a=b#c"       # : = # inside a string
TEMPLATE = 'key: {value}'               # colon and braces inside a string

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
