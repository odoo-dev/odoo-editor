#! /bin/bash

trap 'kill $build_pid && exit' INT
npm run build
npm run build -- --watch &
build_pid=$!

if [[ "$1" == "--server-watch" ]]; then
  npx live-server --cors --port=8000 dev
elif [[ "$1" == "--collaboration" ]]; then
  python3 server.py
else
  npx live-server --cors --port=8000 --ignore="." dev
fi;

