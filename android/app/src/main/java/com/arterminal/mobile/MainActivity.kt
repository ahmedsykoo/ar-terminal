package com.arterminal.mobile

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Button
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import com.termux.terminal.PtyNative
import org.json.JSONObject
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStreamReader

class MainActivity : Activity() {
    private lateinit var web: WebView
    private var pfd: ParcelFileDescriptor? = null
    private var output: FileOutputStream? = null
    private var fd = -1
    private var rows = 24
    private var cols = 80

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        web = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#1e1e1e"))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            isFocusable = true
            isFocusableInTouchMode = true
            addJavascriptInterface(Bridge(), "AndroidPty")
        }

        val keys = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val labelsAndSeq = listOf(
            "Esc" to "\u001b", "Tab" to "\t", "Ctrl+C" to "\u0003", "Ctrl+D" to "\u0004",
            "↑" to "\u001b[A", "↓" to "\u001b[B", "←" to "\u001b[D", "→" to "\u001b[C",
            "/" to "/", "-" to "-", "|" to "|", "~" to "~"
        )
        for ((label, seq) in labelsAndSeq) {
            keys.addView(Button(this).apply {
                text = label
                isAllCaps = false
                minWidth = 0
                minimumWidth = 0
                setOnClickListener { write(seq); web.requestFocus() }
            })
        }
        val keyBar = HorizontalScrollView(this).apply {
            setBackgroundColor(Color.parseColor("#252526"))
            addView(keys)
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#1e1e1e"))
            addView(web, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
            addView(keyBar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { gravity = Gravity.BOTTOM })
        }
        setContentView(root)
        WebView.setWebContentsDebuggingEnabled(true)
        web.loadUrl("file:///android_asset/terminal.html")
    }

    override fun onDestroy() {
        try { pfd?.close() } catch (_: IOException) {}
        super.onDestroy()
    }

    private fun write(s: String) {
        try {
            output?.apply { write(s.toByteArray(Charsets.UTF_8)); flush() }
        } catch (_: IOException) {}
    }

    private fun postToPage(msg: String) {
        runOnUiThread { web.evaluateJavascript("window.postMessage($msg,'*')", null) }
    }

    private fun startShell() {
        if (fd >= 0) return
        val home = filesDir.absolutePath
        val env = arrayOf(
            "TERM=xterm-256color", "HOME=$home", "LANG=en_US.UTF-8", "SHELL=/system/bin/sh",
            "PATH=" + (System.getenv("PATH") ?: "/system/bin")
        )
        val pid = IntArray(1)
        fd = PtyNative.create("/system/bin/sh", home, arrayOf("sh"), env, pid, rows, cols)
        val p = ParcelFileDescriptor.adoptFd(fd)
        pfd = p
        output = FileOutputStream(p.fileDescriptor)
        val input = FileInputStream(p.fileDescriptor)

        Thread {
            val reader = InputStreamReader(input, Charsets.UTF_8)
            val buf = CharArray(8192)
            var carry = ""
            try {
                while (true) {
                    val n = reader.read(buf)
                    if (n < 0) break
                    var s = carry + String(buf, 0, n)
                    carry = ""
                    if (s.isNotEmpty() && Character.isHighSurrogate(s.last())) {
                        carry = s.takeLast(1)
                        s = s.dropLast(1)
                    }
                    if (s.isNotEmpty()) {
                        postToPage("{type:'output',data:" + JSONObject.quote(s) + "}")
                    }
                }
            } catch (_: IOException) {
            }
            postToPage("{type:'exit'}")
        }.start()
    }

    private inner class Bridge {
        @JavascriptInterface
        fun post(json: String) {
            val o = JSONObject(json)
            when (o.getString("type")) {
                "ready" -> startShell()
                "input" -> write(o.getString("data"))
                "resize" -> {
                    cols = o.getInt("cols")
                    rows = o.getInt("rows")
                    if (fd >= 0) PtyNative.resize(fd, rows, cols)
                }
            }
        }
    }
}
