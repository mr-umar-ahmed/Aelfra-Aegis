// SPDX-License-Identifier: GPL-2.0
// Aegis Minimal eBPF Sensor — libbpf/CO-RE version
// Requires: Linux 5.15+, BTF enabled (/sys/kernel/btf/vmlinux must exist)
// Compile: clang -O2 -target bpf -D__TARGET_ARCH_x86 \
//           -I/usr/include/x86_64-linux-gnu \
//           -c aegis_minimal.bpf.c -o aegis_minimal.bpf.o

#include "vmlinux.h"   // auto-generated from BTF
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>

struct event {
    __u32 pid;
    char comm[16];
    char fname[128];
};

struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 1 << 16);
} events SEC(".maps");

SEC("tracepoint/syscalls/sys_enter_openat")
int trace_openat(struct trace_event_raw_sys_enter *ctx)
{
    struct event *e;
    e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (!e) return 0;
    
    e->pid = bpf_get_current_pid_tgid() >> 32;
    bpf_get_current_comm(e->comm, sizeof(e->comm));
    bpf_probe_read_user_str(e->fname, sizeof(e->fname), 
                            (const char *)ctx->args[1]);
    
    bpf_ringbuf_submit(e, 0);
    return 0;
}

char LICENSE[] SEC("license") = "GPL";
