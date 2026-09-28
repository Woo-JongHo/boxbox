// tricky.kt — Kotlin trap fixture. Look-alike rows are not aligned unless they are structure.

URL = "http://example.com/?a=b#c"      // = and # inside a string
template = """
    multi ${'$'}{value} line
    """
escaped = "quote \" and \\ backslash"

/* nested /* comments */ keep going
const faked = 1;
val faked2 = 2 */

fun render(values: Map<String, Any>): String {
    return template
}

if (retries == 3) {
    attemptCount += 1
}
