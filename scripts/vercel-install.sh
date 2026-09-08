#!/usr/bin/env bash
set -euo pipefail

bun install --frozen-lockfile
# Vercel's bundled compiler lacks the WASM target; use the project's pinned rustup toolchain.
export CARGO_HOME="$HOME/.cargo"
export RUSTUP_HOME="$HOME/.rustup"
export PATH="$CARGO_HOME/bin:$PATH"
if [ ! -x "$CARGO_HOME/bin/rustup" ]; then
  installer="$(mktemp)"
  curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs -o "$installer"
  sh "$installer" -y --no-modify-path --default-toolchain none
  rm "$installer"
fi
unset RUSTUP_TOOLCHAIN
rustup show active-toolchain
