#!/bin/bash
set -e

echo "========================================="
echo "   AEGIS libbpf / CO-RE BUILD SETUP     "
echo "========================================="

# 1. Check BTF support
if [ ! -f /sys/kernel/btf/vmlinux ]; then
    echo "❌ Error: Kernel BTF not found at /sys/kernel/btf/vmlinux."
    echo "CO-RE requires Linux 5.15+ with CONFIG_DEBUG_INFO_BTF=y enabled."
    exit 1
fi
echo "✅ Kernel BTF support detected (/sys/kernel/btf/vmlinux exists)."

# 2. Install toolchain dependencies
echo "[1/3] Installing Clang, LLVM, and libbpf development headers..."
sudo apt-get update -qq
sudo apt-get install -y clang llvm libbpf-dev linux-tools-generic bpftool || true

# 3. Generate vmlinux.h from running kernel BTF
echo "[2/3] Generating vmlinux.h from kernel BTF..."
bpftool btf dump file /sys/kernel/btf/vmlinux format c > vmlinux.h
echo "✅ vmlinux.h successfully generated ($(du -h vmlinux.h | cut -f1))."

# 4. Compile aegis_minimal.bpf.c to portable BPF object file
echo "[3/3] Compiling aegis_minimal.bpf.c with Clang BPF target..."
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    TARGET_ARCH="-D__TARGET_ARCH_x86"
    INCLUDE_DIR="-I/usr/include/x86_64-linux-gnu"
elif [ "$ARCH" = "aarch64" ]; then
    TARGET_ARCH="-D__TARGET_ARCH_arm64"
    INCLUDE_DIR="-I/usr/include/aarch64-linux-gnu"
else
    TARGET_ARCH=""
    INCLUDE_DIR=""
fi

clang -O2 -target bpf $TARGET_ARCH $INCLUDE_DIR \
      -c aegis_minimal.bpf.c -o aegis_minimal.bpf.o

echo "========================================="
echo "🎉 CO-RE eBPF SENSOR COMPILED SUCCESSFULLY!"
echo "   Output binary : aegis_minimal.bpf.o"
echo "   Binary size   : $(ls -lh aegis_minimal.bpf.o | awk '{print $5}')"
echo "========================================="
