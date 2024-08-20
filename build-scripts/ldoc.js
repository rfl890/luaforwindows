import { cpSync, mkdirSync, renameSync, rmSync, writeFileSync } from "fs";
import { download_with_progress } from "../util/download.js";
import decompress from "../util/decompress.js";
import { join } from "path";
import { waitFile } from "wait-file";
import { exec } from "../util/exec.js";
import { update_path } from "../util/path.js";

export async function build(variables, spinner) {
    const ldoc_info = variables.versions.libraries.find(
        (obj) => obj.name === "ldoc"
    );
    const lua_info = variables.versions.libraries.find(
        (obj) => obj.name === "lua"
    );
    const pl_info = variables.versions.libraries.find(
        (obj) => obj.name === "penlight"
    );
    const lfs_info = variables.versions.libraries.find(
        (obj) => obj.name === "luafilesystem"
    );

    const ldoc_dir = join(variables.BUILD_DIR, ldoc_info.out_dir);

    await download_with_progress(
        ldoc_info.url,
        join(variables.BUILD_DIR, "ldoc.archive"),
        `Downloading ${ldoc_info.name} ${ldoc_info.version}...`,
        ldoc_info.b3sum,
        spinner
    );

    await decompress(
        join(variables.BUILD_DIR, "ldoc.archive"),
        join(variables.BUILD_DIR)
    );

    spinner.text = `Installing ${ldoc_info.name} ${ldoc_info.version}...`;
    process.chdir(variables.BUILD_DIR);

    const ldoc_install_dir = join(variables.BUILD_DIR, "ldoc-tmp-install");
    mkdirSync(ldoc_install_dir);

    mkdirSync(join(ldoc_install_dir, "scripts"), { recursive: true });
    mkdirSync(join(ldoc_install_dir, "bin"), { recursive: true });
    mkdirSync(join(ldoc_install_dir, "share", "lua", "5.4"), {
        recursive: true,
    });
    mkdirSync(join(ldoc_install_dir, "doc"), { recursive: true });

    cpSync(
        join(ldoc_dir, "ldoc.lua"),
        join(ldoc_install_dir, "scripts", "ldoc.lua")
    );

    cpSync(
        join(ldoc_dir, "manual.md"),
        join(ldoc_install_dir, "doc", "ldoc", "manual.md")
    );

    writeFileSync(
        join(ldoc_install_dir, "bin", "ldoc.cmd"),
        `
    @echo off
    setlocal
    %~dp0lua.exe %~dp0..\\scripts\\ldoc.lua %*
    `
    );

    renameSync(
        join(ldoc_dir, "ldoc"),
        join(ldoc_install_dir, "share", "lua", "5.4", "ldoc")
    );

    spinner.text = "Cleaning up...";
    await waitFile({
        resources: [ldoc_dir],
        delay: 0,
        interval: 75,
        log: false,
        reverse: false,
        timeout: 20000,
        verbose: false,
        window: 250,
    });

    rmSync("ldoc.archive");
    rmSync(ldoc_dir, { recursive: true, force: true });
    renameSync(ldoc_install_dir, ldoc_dir);

    spinner.text = "Bootstrapping a minimal Lua + ldoc installation...";
    await exec(
        "cp",
        ["-RT", join(variables.BUILD_DIR, lua_info.out_dir), join(variables.BUILD_DIR, "ldoc-bin")],
        false,
        false
    );
    await exec(
        "cp",
        ["-RT", join(variables.BUILD_DIR, lfs_info.out_dir), join(variables.BUILD_DIR, "ldoc-bin")],
        false,
        false
    );
    await exec(
        "cp",
        ["-RT", join(variables.BUILD_DIR, pl_info.out_dir), join(variables.BUILD_DIR, "ldoc-bin")],
        false,
        false
    );
    await exec(
        "cp",
        ["-RT", ldoc_dir, join(variables.BUILD_DIR, "ldoc-bin")],
        false,
        false
    );

    variables.PATH.push(join(variables.BUILD_DIR, "ldoc-bin", "bin"));
    update_path(variables.PATH);
}