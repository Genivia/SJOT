#!/bin/bash

cd dev

sed -e "s/FAST\[.*FAST\]//g" -e "/FAST\[/,/FAST\]/ d" < sjot.js > ../dist/sjot-fast.js
node ../dist/sjot-fast.js

sed -e "s/LEAN\[.*LEAN\]//g" -e "/LEAN\[/,/LEAN\]/ d" < sjot.js > ../dist/sjot-lean.js
node ../dist/sjot-lean.js

sed -e "s/LEAN\[.*LEAN\]//g" -e "/LEAN\[/,/LEAN\]/ d" < ../dist/sjot-fast.js > ../dist/sjot-mean.js
node ../dist/sjot-mean.js

cp -f sjot.js node_modules/sjot/index.js
echo 'module.exports = SJOT;' >> node_modules/sjot/index.js

node test.js
