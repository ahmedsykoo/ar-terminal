package com.termux.terminal;

/** Public facade over the (package-private) Termux PTY JNI class. */
public final class PtyNative {
    private PtyNative() {}

    public static int create(String cmd, String cwd, String[] args, String[] env, int[] pid, int rows, int cols) {
        return JNI.createSubprocess(cmd, cwd, args, env, pid, rows, cols);
    }

    public static void resize(int fd, int rows, int cols) {
        JNI.setPtyWindowSize(fd, rows, cols);
    }

    public static int waitFor(int pid) {
        return JNI.waitFor(pid);
    }
}
