use sha2::{Digest, Sha256};
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
};

fn rust_sources(dir: &Path, files: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(dir).expect("read core source directory") {
        let path = entry.expect("read core source entry").path();
        if path.is_dir() {
            rust_sources(&path, files);
        } else if path.extension().is_some_and(|ext| ext == "rs") {
            files.push(path);
        }
    }
}
fn main() {
    let root = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("crate directory"));
    let mut files = vec![];
    rust_sources(&root.join("src"), &mut files);
    files.extend([
        root.join("build.rs"),
        root.join("Cargo.toml"),
        root.join("../../Cargo.lock"),
        root.join("../../Cargo.toml"),
    ]);
    files.sort();
    println!("cargo:rerun-if-changed=src");
    let mut hash = Sha256::new();
    hash.update(b"fly-sim-build-v1\0");
    for path in files {
        println!("cargo:rerun-if-changed={}", path.display());
        let name = path
            .strip_prefix(&root)
            .expect("source path relative to crate")
            .to_string_lossy()
            .replace('\\', "/");
        let bytes = fs::read(&path).expect("read build identity input");
        hash.update((name.len() as u64).to_le_bytes());
        hash.update(name.as_bytes());
        hash.update((bytes.len() as u64).to_le_bytes());
        hash.update(bytes);
    }
    let compiler = Command::new(env::var_os("RUSTC").expect("Rust compiler"))
        .arg("--version")
        .output()
        .expect("query Rust compiler");
    assert!(compiler.status.success(), "query Rust compiler version");
    hash.update(compiler.stdout);
    hash.update(env::var("TARGET").expect("compilation target").as_bytes());
    println!("cargo:rustc-env=SIM_BUILD_ID={:x}", hash.finalize());
}
