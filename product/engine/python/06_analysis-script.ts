/** Embedded CPython analyzer. Original source slices, not tokenize's normalized string, are authoritative. */
export const PYTHON_ANALYSIS_SCRIPT = String.raw`import ast, io, json, re, sys, token, tokenize, warnings

warnings.simplefilter('ignore', SyntaxWarning)
warnings.simplefilter('ignore', DeprecationWarning)

s = sys.stdin.buffer.read().decode('utf-8')

try:
	tree = ast.parse(s)
except SyntaxError:
	print(json.dumps({'version': 1, 'status': 'syntax-invalid'}))

	sys.exit(0)
except ValueError:
	if '\x00' not in s: raise

	print(json.dumps({'version': 1, 'status': 'syntax-invalid'}))

	sys.exit(0)

parts = s.split('\n')
lines = [part + '\n' for part in parts[:-1]]
if parts[-1] or not lines: lines.append(parts[-1])

offsets = [0]
for line in lines: offsets.append(offsets[-1] + len(line.encode('utf-16-le')) // 2)

def cp(row, col):
	if row == len(lines) + 1 and col == 0: return offsets[-1]
	if row < 1 or row > len(lines) or col < 0 or col > len(lines[row - 1]): raise ValueError('token coordinate')

	return offsets[row - 1] + len(lines[row - 1][:col].encode('utf-16-le')) // 2

def byte(row, col):
	if row < 1 or row > len(lines) or col < 0: raise ValueError('node coordinate')

	b = lines[row - 1].encode('utf-8')
	if col > len(b): raise ValueError('node byte coordinate')

	return offsets[row - 1] + len(b[:col].decode('utf-8').encode('utf-16-le')) // 2

def loc(n): return [byte(n.lineno, n.col_offset), byte(n.end_lineno, n.end_col_offset)]

tokens    = []
formatted = []
line_tokens = {}

starts = {getattr(token, name, None) for name in ('FSTRING_START', 'TSTRING_START')}
ends   = {getattr(token, name, None) for name in ('FSTRING_END', 'TSTRING_END')}

depth = 0
start = None

for t in tokenize.generate_tokens(io.StringIO(s).readline):
	if t.type in (tokenize.NEWLINE, tokenize.NL, tokenize.DEDENT, tokenize.ENDMARKER, tokenize.INDENT): continue

	a, b = cp(*t.start), cp(*t.end)
	if b > a: tokens.append([t.type, a, b])
	if t.type != tokenize.COMMENT and t.start[0] == t.end[0]:
		line_tokens.setdefault(t.start[0], []).append((t.type, t.string, a, b))

	if t.type in starts:
		if depth == 0: start = a

		depth += 1
	elif t.type in ends:
		depth -= 1
		if depth < 0: raise ValueError('unbalanced formatted string')
		if depth == 0: formatted.append([start, b])
	elif t.type == token.STRING and depth == 0:
		prefix = re.match(r'(?i)^[a-z]*', t.string).group().lower()
		if 'f' in prefix or 't' in prefix: formatted.append([a, b])

if depth: raise ValueError('incomplete formatted string')

rows   = []
owners = []
nextid = 0

def newowner(n, field, kind):
	global nextid

	result = nextid; nextid += 1

	owners.append([result, type(n).__name__, field, kind])

	return result

def add(n, owner, kind):
	if not hasattr(n, 'lineno') or not hasattr(n, 'end_lineno'): return
	if n.lineno != n.end_lineno: return

	a, b = loc(n)

	rows.append([n.lineno - 1, owner, kind, a, b])

def special_slots(n, kind):
	if n.lineno != n.end_lineno: return None

	a, b = loc(n)
	items = [t for t in line_tokens.get(n.lineno, []) if a <= t[2] and t[3] <= b]
	if not items: return None

	if kind == 'import-from':
		if items[0][:2] != (token.NAME, 'from'): return None
		if any(t[0] == token.OP and t[1] in ('(', ')') for t in items): return None

		middle = next((i for i, t in enumerate(items) if t[:2] == (token.NAME, 'import')), -1)
		if middle < 2 or middle + 1 >= len(items): return None

		cells = [('from', 0, 0), ('module', 1, middle - 1), ('import', middle, middle), ('names', middle + 1, len(items) - 1)]
	else:
		if items[0][:2] != (token.NAME, 'if') or n.orelse or len(n.body) != 1: return None

		statement = n.body[0]
		if not isinstance(statement, ast.Return) or statement.value is None: return None

		start = loc(statement)[0]
		middle = next((i for i, t in enumerate(items) if t[2] == start and t[:2] == (token.NAME, 'return')), -1)
		if middle < 3 or middle + 1 >= len(items) or items[middle - 1][:2] != (token.OP, ':'): return None

		cells = [('if', 0, 0), ('condition', 1, middle - 2), ('colon', middle - 1, middle - 1), ('return', middle, middle), ('value', middle + 1, len(items) - 1)]

	return [[axis, items[first][2], items[last][3]] for axis, first, last in cells]

def add_special(n, owner, kind):
	a = byte(n.lineno, n.col_offset)
	b = cp(n.lineno, len(lines[n.lineno - 1].rstrip('\r\n')))
	slots = special_slots(n, kind)
	if slots: b = slots[-1][2]

	rows.append([n.lineno - 1, owner, kind, a, b, slots])

def visit(n):
	global nextid

	for field, value in ast.iter_fields(n):
		if isinstance(value, list):
			if   field in ('body', 'orelse', 'finalbody')                 : kind = 'statement'
			elif isinstance(n, (ast.List, ast.Tuple)) and field == 'elts' : kind = 'bundle'
			elif isinstance(n, ast.Call) and field == 'keywords'          : kind = 'keyword'
			elif isinstance(n, ast.Call) and field == 'args'              : kind = 'positional'
			else: kind = None

			owner = newowner(n, field, kind) if kind else None
			positional = newowner(n, field, 'positional') if kind == 'bundle' else owner
			special = {}

			for child in value:
				if kind == 'statement':
					candidate = None
					if isinstance(child, ast.ImportFrom): candidate = 'import-from'
					elif isinstance(child, ast.If) and any(isinstance(entry, ast.Return) for entry in child.body): candidate = 'return-guard'

					if candidate:
						if candidate not in special: special[candidate] = newowner(n, field, candidate)

						add_special(child, special[candidate], candidate)

				if isinstance(child, (ast.Assign, ast.AnnAssign)) and field in ('body', 'orelse', 'finalbody'):
					add(child, owner, 'statement')
				elif isinstance(child, (ast.Import, ast.ImportFrom)) and field in ('body', 'orelse', 'finalbody'):
					a = byte(child.lineno, child.col_offset)
					b = cp(child.lineno, len(lines[child.lineno - 1].rstrip('\r\n')))

					rows.append([child.lineno - 1, owner, 'statement', a, b])
				elif isinstance(child, (ast.List, ast.Tuple)) and isinstance(n, (ast.List, ast.Tuple)) and field == 'elts':
					add(child, owner, 'bundle')
				elif isinstance(n, (ast.List, ast.Tuple)) and field == 'elts':
					add(child, positional, 'positional')
				elif isinstance(n, ast.Call) and field == 'args':
					add(child, owner, 'positional')
				elif isinstance(child, ast.keyword) and isinstance(n, ast.Call) and field == 'keywords' and child.arg is not None:
					add(child, owner, 'keyword')

		if isinstance(value, ast.AST): visit(value)
		elif isinstance(value, list):
			for child in value:
				if isinstance(child, ast.AST): visit(child)

	if isinstance(n, ast.arguments):
		owner = newowner(n, 'parameters', 'parameter')

		for child in n.posonlyargs + n.args + n.kwonlyargs: add(child, owner, 'parameter')

	if isinstance(n, ast.Dict):
		owner = newowner(n, 'entries', 'dictionary')

		for k, v in zip(n.keys, n.values):
			if k is not None and k.lineno == k.end_lineno == v.lineno == v.end_lineno:
				a, b = loc(k)[0], loc(v)[1]

				rows.append([k.lineno - 1, owner, 'dictionary', a, b])

visit(tree)

print(json.dumps({
	'version'       : 1                              ,
	'status'        : 'ok'                           ,
	'sourceLength'  : len(s.encode('utf-16-le')) // 2,
	'pythonVersion' : list(sys.version_info[:3])     ,
	'owners'        : owners                         ,
	'rows'          : rows                           ,
	'tokens'        : tokens                         ,
	'formatted'     : formatted
}, separators=(',', ':')))`;
