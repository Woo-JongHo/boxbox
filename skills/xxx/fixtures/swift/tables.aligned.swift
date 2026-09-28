// tables.swift — Swift table alignment fixture. Column axes are deliberately misaligned (golden: tables.aligned.swift).

import Foundation

let retries            = 3
let longTimeoutSeconds = 90
let debugMode          = false

let limit  : Int    = 30
let label  : String = "cache:meta"
let enabled: Bool   = true

var visited      = false
var attemptCount = 7
var label2       = "a=b#c"

cache = [
    "host" : "localhost:8080",
    "port" : 8080            ,
    "debug": true            ,
]

var flag1: Bool = true
var flag2: Bool = false
