# tables.py — Python table alignment fixture. Column axes are deliberately misaligned (golden: tables.aligned.py).

from dataclasses import dataclass


@dataclass
class CacheConfig:
    retries: int   = 3
    label  : str   = "default:cache" # colon inside a string
    verbose: bool  = True
    ratio  : float = 0.5


@dataclass
class Limits:
    small  : int
    total  : float
    enabled: bool
    # A comment breaks the section — tables before and after do not share widths
    refId: str
    tag  : str
    mode : bytes


DEFAULT_RETRIES      = 3
LONG_TIMEOUT_SECONDS = 90
DEBUG                = False

FLAGS         = True
VERBOSE_LABEL = "x=y#z"
RETRY_LIMIT   = 30 # upper bound

defaults = {
    "host" : "localhost:8080",
    "port" : 8080            ,
    "debug": True            ,
    "tag"  : "a=b#c"         , # = and # inside a string
}

hosts = {
    "primary": "alpha:1",
    "standby": "beta",
}

records = [
    ["alpha", 1  , "x"  ],
    ["b"    , 22 , "yy" ],
    ["ccc"  , 333, "zzz"],
]

points = [
    ("p1"  , 1  , 2  , True ),
    ("p22" , 33 , 44 , False),
    ("p333", 555, 666, None ),
]

edges = [
    ("a", 1),
    ("bb", 22),
]
