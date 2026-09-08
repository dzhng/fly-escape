#!/usr/bin/env python3
"""Extract the campaign first-house JSON literal from apps/web/src/levels/open-window.ts."""
import json, sys
ts = open(sys.argv[1]).read()
start = ts.index('{', ts.index('= {'))
end = ts.rindex('};') + 1
obj = json.loads(ts[start:end])
assert set(obj) == {"level", "tuning"}, sorted(obj)
json.dump(obj, open(sys.argv[2], 'w'), indent=2, sort_keys=True)
