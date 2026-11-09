import logging

module_a: int = 1
module_longer: int = 2
module_c: int = 3

class Record:
    field_a: int
    field_longer: int
    field_c: int

    def method(self):
        local_a: int = 1
        local_longer: int = 2
        local_c: int = 3

def parameters(
    a: int,
    /,
    longer: str,
    *,
    third: int = 1,
):
    pass

plain_a = 1
plain_longer = 2
plain_c = 3

logger = logging.getLogger(__name__)
__layer__ = "task"
__task__ = "p1.t1"
Settings = load_settings(1, "t1")

call_a = same("a", 1)
call_longer = same("longer", 2)
call_c = same("c", 3)

mapping = {
    "a": 1,
    "longer": 2,
    "c": 3,
}

consume(
    a=1,
    longer=2,
    third=3,
)

bundles = [
    ["a", 1],
    ["longer", 2],
    ["c", 3],
]

pair_a = 1
pair_longer = 2

wide = {
    "한": 1,
    "longer": 2,
    "c": 3,
}

description = """
class Fake:
    text_a: int
    text_b: int
    text_c: int
"""
