import { join } from "path";
import { submit_compile_job } from "../util/compiler_worker_wrap.js";
import { download_with_progress } from "../util/download.js";
import decompress from "../util/decompress.js";
import { exec, invoke_compiler } from "../util/exec.js";
import { cpSync, mkdirSync, renameSync, rmSync } from "fs";
import { waitFile } from "wait-file";

export async function build(variables, spinner) {
    const lua_info = variables.versions.libraries.find(
        (obj) => obj.name === "lua"
    );

    await download_with_progress(
        lua_info.url,
        join(variables.BUILD_DIR, "lua.archive"),
        `Downloading ${lua_info.name} ${lua_info.version}...`,
        lua_info.b3sum,
        spinner
    );
    await decompress(
        join(variables.BUILD_DIR, "lua.archive"),
        join(variables.BUILD_DIR),
        true
    );

    const lua_dir = join(variables.BUILD_DIR, lua_info.out_dir);
    const lua_src = [
        "lapi.c",
        "lcode.c",
        "lctype.c",
        "ldebug.c",
        "ldo.c",
        "ldump.c",
        "lfunc.c",
        "lgc.c",
        "llex.c",
        "lmem.c",
        "lobject.c",
        "lopcodes.c",
        "lparser.c",
        "lstate.c",
        "lstring.c",
        "ltable.c",
        "ltm.c",
        "lundump.c",
        "lvm.c",
        "lzio.c",
        "lauxlib.c",
        "lbaselib.c",
        "lcorolib.c",
        "ldblib.c",
        "liolib.c",
        "lmathlib.c",
        "loadlib.c",
        "loslib.c",
        "lstrlib.c",
        "ltablib.c",
        "lutf8lib.c",
        "linit.c",
    ];

    // map lua_src into compiler jobs
    const lua_compiler_jobs = lua_src.map((src) => {
        return {
            compiler: variables.CC,
            includeDirectories: [],
            flags: ["-O3", "-DLUA_COMPAT_5_3", "-DLUA_BUILD_AS_DLL", "-c"],
            sourceFiles: [join(src)],
            keepOutput: false,
            log: false,
        };
    });

    process.chdir(join(lua_dir, "src"));

    spinner.text = `Compiling ${lua_info.name} ${lua_info.version}...`;
    await submit_compile_job(variables, lua_compiler_jobs);

    spinner.text = `Linking ${lua_info.name} ${lua_info.version}...`;
    await invoke_compiler({
        compiler: variables.CC,
        includeDirectories: [],
        flags: ["-O3", "-shared"],
        sourceFiles: [...lua_src.map((x) => x.replace(".c", ".o"))],
        output: "lua54.dll",
        linkerFlags: ["-Wl,--out-implib=liblua54.a"],
        keepOutput: false,
        log: false,
    });
    await invoke_compiler({
        compiler: variables.CC,
        includeDirectories: [],
        flags: ["-O3", "-DLUA_COMPILE_AS_DLL"],
        sourceFiles: ["lua.c", "lua54.dll"],
        output: "lua.exe",
        linkerFlags: [],
        keepOutput: false,
        log: false,
    });
    await invoke_compiler({
        compiler: variables.CC,
        includeDirectories: [],
        flags: ["-O3", "-s"],
        sourceFiles: ["luac.c", ...lua_src.map((x) => x.replace(".c", ".o"))],
        output: "luac.exe",
        linkerFlags: [],
        keepOutput: false,
        log: false,
    });

    await exec(
        "strip",
        ["--strip-unneeded", join(lua_dir, "src", "lua54.dll")],
        false,
        false
    );
    await exec("strip", [join(lua_dir, "src", "lua.exe")], false, false);
    await exec("strip", [join(lua_dir, "src", "luac.exe")], false, false);

    spinner.text = `Installing ${lua_info.name} ${lua_info.version}...`;
    process.chdir(variables.BUILD_DIR);

    const lua_install_dir = join(variables.BUILD_DIR, "lua-tmp-install");
    mkdirSync(lua_install_dir);

    mkdirSync(join(lua_install_dir, "bin"));
    mkdirSync(join(lua_install_dir, "include"));
    mkdirSync(join(lua_install_dir, "lib", "lua", "5.4"), { recursive: true });
    mkdirSync(join(lua_install_dir, "share", "lua", "5.4"), {
        recursive: true,
    });
    mkdirSync(join(lua_install_dir, "doc"));

    cpSync(
        join(lua_dir, "src", "lua.exe"),
        join(lua_install_dir, "bin", "lua.exe")
    );
    cpSync(
        join(lua_dir, "src", "luac.exe"),
        join(lua_install_dir, "bin", "luac.exe")
    );
    cpSync(
        join(lua_dir, "src", "lua54.dll"),
        join(lua_install_dir, "bin", "lua54.dll")
    );

    cpSync(
        join(lua_dir, "src", "lua.h"),
        join(lua_install_dir, "include", "lua.h")
    );
    cpSync(
        join(lua_dir, "src", "luaconf.h"),
        join(lua_install_dir, "include", "luaconf.h")
    );
    cpSync(
        join(lua_dir, "src", "lualib.h"),
        join(lua_install_dir, "include", "lualib.h")
    );
    cpSync(
        join(lua_dir, "src", "lauxlib.h"),
        join(lua_install_dir, "include", "lauxlib.h")
    );
    cpSync(
        join(lua_dir, "src", "lua.hpp"),
        join(lua_install_dir, "include", "lua.hpp")
    );

    cpSync(
        join(lua_dir, "src", "liblua54.a"),
        join(lua_install_dir, "lib", "liblua54.a")
    );

    renameSync(join(lua_dir, "doc"), join(lua_install_dir, "doc", "lua"));

    spinner.text = "Cleaning up...";
    await waitFile({
        resources: [lua_dir],
        delay: 0,
        interval: 75,
        log: false,
        reverse: false,
        timeout: 20000,
        verbose: false,
        window: 250,
    });

    rmSync("lua.archive");
    rmSync(lua_dir, { recursive: true, force: true });
    renameSync(lua_install_dir, lua_dir);
}