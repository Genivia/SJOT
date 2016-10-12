#!/bin/bash

cd dev

# get version after version bump
VERSION=`npm view sjot version`
echo "Creating sjot $VERSION"

# bump version and remove DEBUG[ ... DEBUG]
sed -e "s/{VERSION}/$VERSION/" -e "s/DEBUG\[.*DEBUG\]//g" -e "/DEBUG\[/,/DEBUG\]/ d" < sjot.js > ../dist/sjot.js

# sjot-fast.js removes FAST[ ... FAST]
sed -e "s/FAST\[.*FAST\]//g" -e "/FAST\[/,/FAST\]/ d" < ../dist/sjot.js > ../dist/sjot-fast.js

# sjot-lean.js removes LEAN[ ... LEAN]
sed -e "s/LEAN\[.*LEAN\]//g" -e "/LEAN\[/,/LEAN\]/ d" < ../dist/sjot.js > ../dist/sjot-lean.js

# sjot-mean.js removes FAST[ ... FAST] and LEAN[ ... LEAN]
sed -e "s/LEAN\[.*LEAN\]//g" -e "/LEAN\[/,/LEAN\]/ d" < ../dist/sjot-fast.js > ../dist/sjot-mean.js

# create index.js by adding module.exports
cp -f ../dist/sjot.js ../index.js
echo 'module.exports = SJOT;' >> ../index.js

# create travis-test.js
cp -f ../dist/sjot.js ../travis-test.js
tail +2 test.js >> ../travis-test.js
