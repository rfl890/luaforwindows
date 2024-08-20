# luaforwindows   
# WIP

A continuation of the LfW project by rjpcomputing.   
Unlike the previous LfW, this is a from-source build,
comprising of build scripts to compile each individual module.

# Build Requirements
- Node.js 20 LTS or higher

# Runtime Requirements
See [llvm-mingw](https://github.com/mstorsjo/llvm-mingw#known-issues).

# Instructions
```cmd
C:\luaforwindows> npm i
C:\luaforwindows> node main.js
```   
will produce a standalone LfW installation in the `out` folder, containing a Lua binary, documentation and modules.

# Todo
- Add compatible modules from original LfW project
- Write `.iss` scripts for an installer

# Module List
Note: This is unfinished.
| Module name | Version | Description |
|---|---|---|
| [argparse](https://github.com/luarocks/argparse) | 0.7.1 | Feature-rich command line parser for Lua |
| [cffi-lua](https://github.com/q66/cffi-lua) | 0.2.3 | A portable C FFI for Lua 5.1+ |
| [ldoc](https://github.com/lunarmodules/ldoc) | 1.5.0 | A LuaDoc-compatible documentation generator |
| [Lua-cURLv3](https://github.com/Lua-cURL/Lua-cURLv3) | 0.3.13 | Lua binding to libcurl |
| [luafilesystem](https://github.com/lunarmodules/luafilesystem) | 1.8.0 | A Lua library developed to complement the set of functions related to file systems offered by the standard Lua distribution.|
| [Penlight](https://github.com/lunarmodules/Penlight) | 1.14.0 | A set of pure Lua libraries for making it easier to work with common tasks like iterating over directories, reading configuration files and the like. |