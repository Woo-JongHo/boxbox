import json, pathlib
root=pathlib.Path(__file__).resolve().parents[2]
cases=[]
widths={'short':'x','medium':'medium_name','long-outlier':'exceptionally_long_argument_name_for_width_pressure','unicode-wide':'\u754c','combining':'e\u0301'}
for language in ['typescript','python']:
 for shape in ['same-call','different-call','different-arity','typed-untyped','nested-match','nested-mismatch']:
  for width,value in widths.items():
   for count in [1,2,3,6]:
    for layout in ['plain','blank','comment','trailing-comment','crlf']:
     rows=[]
     for i in range(count):
      arg=value if i==count-1 else 'x'
      rhs=f'make({json.dumps(arg,ensure_ascii=True)}, y)'
      if shape=='different-call' and i%2: rhs=f'other({json.dumps(arg,ensure_ascii=True)}, y)'
      if shape=='different-arity' and i%2: rhs=f'make({json.dumps(arg,ensure_ascii=True)})'
      if shape.startswith('nested'): rhs=f'make(inner({json.dumps(arg,ensure_ascii=True)}, y), z)' if shape=='nested-match' or i%2==0 else f'make(inner({json.dumps(arg,ensure_ascii=True)}), z)'
      annotation=(': number' if language=='typescript' else ': int') if shape=='typed-untyped' and i%2 else ''
      row=f'let item_{i}{annotation} = {rhs};' if language=='typescript' else f'self.item_{i}{annotation} = {rhs}'
      if layout=='trailing-comment': row+=(' // note' if language=='typescript' else ' # note')
      rows.append(row)
     separator={'blank':'\n\n','comment':'\n// boundary\n' if language=='typescript' else '\n# boundary\n','crlf':'\r\n'}.get(layout,'\n')
     cases.append({'id':f'{language}.variant.{shape}.{width}.{count}.{layout}','language':language,'family':'multirow-layout','code':separator.join(rows),'extension':'.ts' if language=='typescript' else '.py','parseMode':'exec','expectedParseFailure':False,'dimensions':{'shape':shape,'width':width,'rowCount':count,'layout':layout},'alignmentDecision':'unreviewed'})
negatives={'typescript':['const x = ;','const x = "unfinished','const x = make(a,,b);','const x = [a,b;','const x: = 1;','function f(a: number { return a; }','const x = {a: };','let x?: number;'], 'python':['x =','x = "unfinished','x = make(a,,b)','x = [a,b','x: = 1','def f(a:\n    pass','x = {"a": }','if True:\nx = 1']}
for language,items in negatives.items():
 for i,code in enumerate(items): cases.append({'id':f'{language}.negative.{i+1:02}','language':language,'family':'malformed-syntax','code':code,'extension':'.ts' if language=='typescript' else '.py','parseMode':'exec','expectedParseFailure':True,'alignmentDecision':'unreviewed'})
(root/'development/corpus/syntax/variant-examples.json').write_text(json.dumps({'schemaVersion':1,'scope':'bounded-cross-product-not-exhaustive','alignmentApproved':False,'cases':cases},indent='\t',ensure_ascii=True)+'\n')
print(len(cases))
