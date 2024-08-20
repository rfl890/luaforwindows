const update_path = (path) => {
    process.env["PATH"] = path.join(";");
};

export {
    update_path
}