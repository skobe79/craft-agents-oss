#!/bin/bash

DIR=`dirname $0`
BUILD_DIR="$DIR/../build"
VERSION=$1

if [ -z "$VERSION" ]; then
    echo "Version is required"
    exit 1
fi

echo "Removing old build directory..."
mkdir -p $BUILD_DIR
rm -rf $BUILD_DIR/*

TARGETS=("linux-x64" "linux-arm64" "windows-x64" "darwin-x64" "darwin-arm64")
for TARGET in ${TARGETS[@]}; do
    echo "Building for $TARGET..."
    bun build --compile --minify --target $TARGET --external yoga-wasm-web --external keytar $DIR/../src/index.tsx --outfile $BUILD_DIR/craft-agent-bun-$TARGET
done

