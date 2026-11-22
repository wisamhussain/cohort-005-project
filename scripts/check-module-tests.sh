#!/bin/sh
# Every module ships with tests through its entry points
# (app/modules/README.md). A module without a tests/ folder fails the check.
status=0
for dir in app/modules/*/; do
  if [ ! -d "${dir}tests" ]; then
    echo "✖ ${dir} has no tests/ folder. Test the module through its entry points: see app/modules/README.md."
    status=1
  fi
done
exit $status
