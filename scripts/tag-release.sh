#!/bin/sh

# Usage: npm run tag:release -- v1.0.7-dev

if [ -z "$1" ]; then
  echo "Usage: npm run tag:release -- vX.Y.Z[-dev]"
  exit 1
fi

git tag -a "$1" -m "Release $1"
git push origin "$1"