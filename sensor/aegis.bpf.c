#include <uapi/linux/ptrace.h>
#include <linux/sched.h>
#include <net/sock.h>

struct event_t {
    u32 pid;
    u32 ppid;
    u32 uid;
    u64 timestamp_ns;
    char comm[16];
    char event_type[16];
    char filename[256];
    u32 dest_ip;
    u16 dest_port;
};

BPF_RINGBUF_OUTPUT(events, 8);

TRACEPOINT_PROBE(syscalls, sys_enter_openat) {
    u64 pid_tgid = bpf_get_current_pid_tgid();
    u32 pid = pid_tgid >> 32;
    u32 uid = bpf_get_current_uid_gid();

    char filename[256] = {};
    bpf_probe_read_user_str(&filename, sizeof(filename), args->filename);

    int match = 0;
    #pragma unroll
    for (int i = 0; i < 200; i++) {
        if (filename[i] == '.' && filename[i+1] == 'e' && filename[i+2] == 'n' && filename[i+3] == 'v') {
            match = 1;
            break;
        }
        if (filename[i] == '\0') break;
    }

    if (match) {
        struct event_t *event = events.ringbuf_reserve(sizeof(struct event_t));
        if (!event) return 0;

        event->pid = pid;
        event->uid = uid;
        event->timestamp_ns = bpf_ktime_get_ns();
        bpf_get_current_comm(&event->comm, sizeof(event->comm));
        
        struct task_struct *task = (struct task_struct *)bpf_get_current_task();
        event->ppid = task->real_parent->tgid;

        __builtin_memcpy(event->event_type, "file_open", 10);
        __builtin_memcpy(event->filename, filename, sizeof(filename));

        events.ringbuf_submit(event, 0);
    }

    return 0;
}

TRACEPOINT_PROBE(syscalls, sys_enter_execve) {
    u64 pid_tgid = bpf_get_current_pid_tgid();
    u32 pid = pid_tgid >> 32;
    u32 uid = bpf_get_current_uid_gid();

    char filename[256] = {};
    bpf_probe_read_user_str(&filename, sizeof(filename), args->filename);

    struct event_t *event = events.ringbuf_reserve(sizeof(struct event_t));
    if (!event) return 0;

    event->pid = pid;
    event->uid = uid;
    event->timestamp_ns = bpf_ktime_get_ns();
    bpf_get_current_comm(&event->comm, sizeof(event->comm));

    struct task_struct *task = (struct task_struct *)bpf_get_current_task();
    event->ppid = task->real_parent->tgid;

    __builtin_memcpy(event->event_type, "exec_spawn", 11);
    __builtin_memcpy(event->filename, filename, sizeof(filename));

    events.ringbuf_submit(event, 0);

    return 0;
}

int trace_tcp_connect(struct pt_regs *ctx, struct sock *sk) {
    u64 pid_tgid = bpf_get_current_pid_tgid();
    u32 pid = pid_tgid >> 32;
    u32 uid = bpf_get_current_uid_gid();

    struct event_t *event = events.ringbuf_reserve(sizeof(struct event_t));
    if (!event) return 0;

    event->pid = pid;
    event->uid = uid;
    event->timestamp_ns = bpf_ktime_get_ns();
    bpf_get_current_comm(&event->comm, sizeof(event->comm));

    struct task_struct *task = (struct task_struct *)bpf_get_current_task();
    event->ppid = task->real_parent->tgid;

    __builtin_memcpy(event->event_type, "network", 8);
    __builtin_memcpy(event->filename, "", 1);

    bpf_probe_read_kernel(&event->dest_ip, sizeof(event->dest_ip), &sk->__sk_common.skc_daddr);
    bpf_probe_read_kernel(&event->dest_port, sizeof(event->dest_port), &sk->__sk_common.skc_dport);

    events.ringbuf_submit(event, 0);

    return 0;
}
