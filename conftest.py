"""
Aelfra Aegis — pytest conftest.py
Configures the test environment for the full test suite.
"""
# Nothing special is needed here — the package is importable directly from
# the project root because Python adds the cwd to sys.path during test collection.
# conftest.py existence at the repo root is enough to anchor pytest's rootdir.
