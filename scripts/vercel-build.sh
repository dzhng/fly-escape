#!/usr/bin/env bash
set -euo pipefail
export CARGO_HOME="$HOME/.cargo"
export RUSTUP_HOME="$HOME/.rustup"
export PATH="$CARGO_HOME/bin:$PATH"
export RUSTC="$CARGO_HOME/bin/rustc"
unset RUSTUP_TOOLCHAIN
bun run build
