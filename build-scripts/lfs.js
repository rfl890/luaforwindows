import { cpSync, mkdirSync, renameSync, rmSync } from "fs";
import { exec, invoke_compiler } from "../util/exec.js";
import { download_with_progress } from "../util/download.js";
import decompress from "../util/decompress.js";
import { join } from "path";
import { waitFile } from "wait-file";

export async function build(variables, spinner) {
    const lua_info = variables.versions.libraries.find(
        (obj) => obj.name === "lua"
    );
    const lfs_info = variables.versions.libraries.find(
        (obj) => obj.name === "luafilesystem"
    );

    const lua_dir = join(variables.BUILD_DIR, lua_info.out_dir);
    const lfs_dir = join(variables.BUILD_DIR, lfs_info.out_dir);

    await download_with_progress(
        lfs_info.url,
        join(variables.BUILD_DIR, "lfs.archive"),
        `Downloading ${lfs_info.name} ${lfs_info.version}...`,
        lfs_info.b3sum,
        spinner
    );

    await decompress(
        join(variables.BUILD_DIR, "lfs.archive"),
        join(variables.BUILD_DIR)
    );

    spinner.text = `Compiling ${lfs_info.name} ${lfs_info.version}...`;
    process.chdir(join(lfs_dir, "src"));
    await invoke_compiler({
        compiler: variables.CC,
        includeDirectories: [join(lua_dir, "include")],
        flags: ["-O3", "-shared"],
        output: "lfs.dll",
        sourceFiles: ["lfs.c", join(lua_dir, "lib", "liblua54.a")],
        keepOutput: false,
        log: false,
    });
    await exec(
        "strip",
        ["--strip-unneeded", join(lfs_dir, "src", "lfs.dll")],
        false,
        false
    );

    spinner.text = `Installing ${lfs_info.name} ${lfs_info.version}...`;
    process.chdir(variables.BUILD_DIR);

    const lfs_install_dir = join(variables.BUILD_DIR, "lfs-tmp-install");
    mkdirSync(lfs_install_dir);

    mkdirSync(join(lfs_install_dir, "lib", "lua", "5.4"), { recursive: true });
    mkdirSync(join(lfs_install_dir, "doc"), { recursive: true });

    renameSync(
        join(lfs_dir, "doc"),
        join(lfs_install_dir, "doc", "luafilesystem")
    );

    cpSync(
        join(lfs_dir, "src", "lfs.dll"),
        join(lfs_install_dir, "lib", "lua", "5.4", "lfs.dll")
    );

    spinner.text = "Cleaning up...";
    await waitFile({
        resources: [lfs_dir],
        delay: 0,
        interval: 75,
        log: false,
        reverse: false,
        timeout: 20000,
        verbose: false,
        window: 250,
    });

    rmSync("lfs.archive");
    rmSync(lfs_dir, { recursive: true, force: true });
    renameSync(lfs_install_dir, lfs_dir);
}