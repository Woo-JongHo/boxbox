# tables.py — Python 표 정렬 fixture. 열축이 일부러 어긋나 있다(골든은 tables.aligned.py).

from dataclasses import dataclass


@dataclass
class CacheConfig:
    retries: int   = 3
    label  : str   = "default:cache" # 문자열 안의 콜론
    verbose: bool  = True
    ratio  : float = 0.5


@dataclass
class Limits:
    small  : int
    total  : float
    enabled: bool
    # 주석은 구획을 끊는다 — 앞뒤 표가 폭을 공유하지 않는다
    refId: str
    tag  : str
    mode : bytes


DEFAULT_RETRIES      = 3
LONG_TIMEOUT_SECONDS = 90
DEBUG                = False

FLAGS         = True
VERBOSE_LABEL = "x=y#z"
RETRY_LIMIT   = 30 # 상한

defaults = {
    "host" : "localhost:8080",
    "port" : 8080            ,
    "debug": True            ,
    "tag"  : "a=b#c"         , # 문자열 안의 = 와 #
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
