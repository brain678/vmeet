import importlib, sys, traceback
try:
    m = importlib.import_module('main')
    print('Imported main, app attr:', hasattr(m, 'app'))
    print('app repr:', repr(getattr(m, 'app', None)))
except Exception:
    traceback.print_exc()
    sys.exit(1)
