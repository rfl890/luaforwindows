import { join } from "path";
import { submit_compile_job } from "../util/compiler_worker_wrap.js";
import { download_with_progress } from "../util/download.js";
import decompress from "../util/decompress.js";
import { exec, invoke_compiler } from "../util/exec.js";
import { cpSync, mkdirSync, readdirSync, renameSync, rmSync } from "fs";
import { waitFile } from "wait-file";
import { cpus } from "os";

export async function build(variables, spinner) {
    const lua_info = variables.versions.libraries.find(
        (obj) => obj.name === "lua"
    );
    const cffi_info = variables.versions.libraries.find(
        (obj) => obj.name === "cffi-lua"
    );

    const lua_dir = join(variables.BUILD_DIR, lua_info.out_dir);

    const master_build_dir = join(variables.BUILD_DIR, "cffi-lua-build");
    mkdirSync(master_build_dir);

    // On a slow internet connection, this is orders of magnitude faster than
    // letting meson pull in a 50 megabyte git repo which is outdated anyway
    await download_with_progress(
        cffi_info.dependencies.libffi.url,
        join(master_build_dir, "libffi.archive"),
        "[cffi-lua] downloading dep: libffi",
        cffi_info.dependencies.libffi.b3sum,
        spinner
    );

    spinner.text = "[cffi-lua] extracting dep: libffi";
    await decompress(
        join(master_build_dir, "libffi.archive"),
        master_build_dir,
        true
    );

    const libffi_dir = join(
        master_build_dir,
        cffi_info.dependencies.libffi.out_dir
    );
    const cffi_dir = join(master_build_dir, cffi_info.out_dir);

    process.chdir(libffi_dir);

    spinner.text = "[cffi-lua] configuring dep: libffi";
    const cc_target = variables.CC.split("-").slice(0, -1).join("-");

    await exec(
        "sh",
        [
            "./configure",
            "--host",
            cc_target,
            "--enable-symvers=no",
            "--disable-shared",
            "--enable-static",
        ],
        false,
        false
    );

    spinner.text = "[cffi-lua] compiling dep: libffi";
    await exec("make", [`-j${cpus().length + 1}`], false, false);

    await download_with_progress(
        cffi_info.url,
        join(variables.BUILD_DIR, "cffi.archive"),
        `Downloading ${cffi_info.name} ${cffi_info.version}...`,
        cffi_info.b3sum,
        spinner
    );

    await decompress(
        join(variables.BUILD_DIR, "cffi.archive"),
        master_build_dir,
        true
    );

    mkdirSync(join(cffi_dir, "build"));
    // wish this project would be normal about its
    // dependency management, so I could pass
    // -DLUA_INCLUDE_DIR and -DLUA_LIBRARY,
    // but I guess it's trying to be
    // "not like other projects"

    mkdirSync(join(cffi_dir, "deps"));
    mkdirSync(join(cffi_dir, "deps", "include"));

    cpSync(
        join(libffi_dir, cc_target, ".libs", "libffi.a"),
        join(cffi_dir, "deps", "libffi.a")
    );
    cpSync(
        join(libffi_dir, cc_target, "include", "ffi.h"),
        join(cffi_dir, "deps", "include", "ffi.h")
    );
    cpSync(
        join(libffi_dir, cc_target, "include", "ffitarget.h"),
        join(cffi_dir, "deps", "include", "ffitarget.h")
    );

    cpSync(join(lua_dir, "bin", "lua.exe"), join(cffi_dir, "deps", "lua.exe"));
    cpSync(
        join(lua_dir, "bin", "lua54.dll"),
        join(cffi_dir, "deps", "lua54.dll")
    );
    cpSync(
        join(lua_dir, "lib", "liblua54.a"),
        join(cffi_dir, "deps", "liblua54.a")
    );

    cpSync(
        join(lua_dir, "include", "lua.h"),
        join(cffi_dir, "deps", "include", "lua.h")
    );
    cpSync(
        join(lua_dir, "include", "luaconf.h"),
        join(cffi_dir, "deps", "include", "luaconf.h")
    );
    cpSync(
        join(lua_dir, "include", "lualib.h"),
        join(cffi_dir, "deps", "include", "lualib.h")
    );
    cpSync(
        join(lua_dir, "include", "lauxlib.h"),
        join(cffi_dir, "deps", "include", "lauxlib.h")
    );
    cpSync(
        join(lua_dir, "include", "lua.hpp"),
        join(cffi_dir, "deps", "include", "lua.hpp")
    );

    process.chdir(join(cffi_dir, "build"));

    spinner.text = `Configuring ${cffi_info.name} ${cffi_info.version}...`;
    await exec(
        "meson",
        [
            "setup",
            "..",
            "-Dlua_version=vendor",
            "-Dlibffi=vendor",
            "-Dbuildtype=release",
        ],
        false,
        false
    );

    spinner.text = `Compiling ${cffi_info.name} ${cffi_info.version}...`;
    await exec("ninja", [], false, false);
    await exec("strip", ["--strip-unneeded", join(cffi_dir, "build", "cffi.dll")], false, false);

    spinner.text = `Installing ${cffi_info.name} ${cffi_info.version}...`;
    process.chdir(variables.BUILD_DIR);

    const cffi_install_dir = join(variables.BUILD_DIR, "cffi-tmp-install");

    mkdirSync(join(cffi_install_dir, "lib", "lua", "5.4"), {
        recursive: true,
    });
    mkdirSync(join(cffi_install_dir, "doc", "cffi"), { recursive: true });

    cpSync(
        join(cffi_dir, "build", "cffi.dll"),
        join(cffi_install_dir, "lib", "lua", "5.4", "cffi.dll")
    );

    cpSync(
        join(cffi_dir, "docs", "api.md"),
        join(cffi_install_dir, "doc", "cffi", "api.md")
    );
    cpSync(
        join(cffi_dir, "docs", "introduction.md"),
        join(cffi_install_dir, "doc", "cffi", "introduction.md")
    );
    cpSync(
        join(cffi_dir, "docs", "semantics.md"),
        join(cffi_install_dir, "doc", "cffi", "semantics.md")
    );
    cpSync(
        join(cffi_dir, "docs", "syntax.md"),
        join(cffi_install_dir, "doc", "cffi", "syntax.md")
    );

    spinner.text = "Cleaning up...";
    await waitFile({
        resources: [cffi_dir],
        delay: 0,
        interval: 75,
        log: false,
        reverse: false,
        timeout: 20000,
        verbose: false,
        window: 250,
    });

    rmSync("cffi.archive");
    rmSync(master_build_dir, { recursive: true, force: true });
    renameSync(cffi_install_dir, join(variables.BUILD_DIR, cffi_info.out_dir));
}