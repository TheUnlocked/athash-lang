# Athash Langauge

Prounounced "at-hash" or "a-thash"

## How to build

You must have [typescript](http://www.typescriptlang.org/) and [node.js current](https://nodejs.org/) (at least 12.x.x) installed.

* In the main folder which contains this tsconfig.json, run `tsc`.
* Run `node ./dist/main.js` (or `node dist\main.js` on Windows)

Alternatively, you can debug in [Visual Studio Code](https://code.visualstudio.com/) with the provided [.vscode] settings.

## How to run your own code

[src/main.ts] contains an invocation to `Instance.evalString` which may be edited with your own code. Alternative, you can implement your own front-end so that you don't need to rebuild every time you make a change.