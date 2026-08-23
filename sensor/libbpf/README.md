# Aegis libbpf / CO-RE Minimal Sensor (Proof of Concept)

This directory contains the **libbpf CO-RE (Compile Once — Run Everywhere)** implementation of the Aegis openat kernel probe.

---

## 1. What is CO-RE and Why Does it Matter?

In traditional eBPF (BCC), eBPF C programs are compiled dynamically at runtime on the target host using embedded Clang/LLVM compilers. This requires full kernel headers (`linux-headers-$(uname -r)`) to be installed on every production machine, introducing high memory overhead and attack surface.

**CO-RE (Compile Once — Run Everywhere)** leverages **BTF (BPF Type Format)** embedded in modern Linux kernels (`/sys/kernel/btf/vmlinux`). With CO-RE:
- eBPF bytecode is compiled **Ahead-Of-Time (AOT)** into a single `.bpf.o` binary.
- During loading, `libbpf` uses kernel BTF metadata to dynamically relocate struct field offsets to match the target kernel version at runtime.
- **Zero compiler dependencies and zero kernel header packages required on the target machine.**

---

## 2. Generating `vmlinux.h`

`vmlinux.h` contains all kernel data structures, typedefs, and enums exported directly from your running kernel's BTF metadata:

```bash
bpftool btf dump file /sys/kernel/btf/vmlinux format c > vmlinux.h
```

---

## 3. How to Compile `aegis_minimal.bpf.c`

Compile the eBPF C source into portable BPF bytecode using Clang:

```bash
clang -O2 -target bpf -D__TARGET_ARCH_x86 \
      -I/usr/include/x86_64-linux-gnu \
      -c aegis_minimal.bpf.c -o aegis_minimal.bpf.o
```

---

## 4. BCC vs. libbpf Comparison

| Feature | BCC (Development / Prototype) | libbpf / CO-RE (Production) |
| :--- | :--- | :--- |
| **Compilation** | Just-In-Time (JIT) on target host | Ahead-Of-Time (AOT) during build |
| **Host Dependencies** | Clang, LLVM, Kernel Headers (~300MB) | None (Single binary / `.bpf.o`) |
| **Startup Latency** | ~2–5 seconds (runtime compilation) | < 50ms (direct ELF load) |
| **Memory Footprint** | ~50–100MB RAM | < 5MB RAM |
| **Kernel Portability** | Compiles against local headers | Portable across kernels with BTF |

---

## 5. Why Production Security Tools Use libbpf

Enterprise security agents like **Datadog Agent**, **Cilium**, and **Falco's modern eBPF driver** use libbpf CO-RE exclusively:
- It eliminates the security risk of maintaining a full C compiler toolchain on production Kubernetes nodes.
- Instant startup and zero compile latency allow immediate runtime container defense.
- Guaranteed deterministic bytecode verification across kernel 5.15+ distributions.
