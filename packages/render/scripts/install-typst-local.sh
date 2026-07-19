#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
VERSION_FILE="${RENDER_DIR}/typst-version.txt"
BIN_DIR="${RENDER_DIR}/.bin"
TYPST_BIN="${BIN_DIR}/typst"

VERSION="$(tr -d '[:space:]' < "${VERSION_FILE}")"
ASSET="typst-x86_64-unknown-linux-musl.tar.xz"
DOWNLOAD_URL="https://github.com/typst/typst/releases/download/v${VERSION}/${ASSET}"

mkdir -p "${BIN_DIR}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

TARBALL="${TMP_DIR}/${ASSET}"
echo "Downloading Typst v${VERSION} (${ASSET})..."
curl -fsSL -o "${TARBALL}" "${DOWNLOAD_URL}"

echo "Extracting to ${TYPST_BIN}..."
tar -xJf "${TARBALL}" -C "${TMP_DIR}"
install -m 755 "${TMP_DIR}/typst-x86_64-unknown-linux-musl/typst" "${TYPST_BIN}"

echo "Typst installed: $("${TYPST_BIN}" --version)"
echo "Tarball SHA-256: $(sha256sum "${TARBALL}" | awk '{print $1}')"
echo "Binary SHA-256:  $(sha256sum "${TYPST_BIN}" | awk '{print $1}')"
