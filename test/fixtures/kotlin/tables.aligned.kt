// tables.kt — Kotlin table alignment fixture. Column axes are deliberately misaligned (golden: tables.aligned.kt).

import kotlin.collections.Map

val retries            = 3
val longTimeoutSeconds = 90
val debugMode          = false

val limit  : Int     = 30
val label  : String  = "cache:meta"
val enabled: Boolean = true

var visited      = false
var attemptCount = 7
var label2       = "a=b#c"

fun render(): Map<String, Any> {
    return emptyMap()
}

var flag1: Bool = true
var flag2: Bool = false
