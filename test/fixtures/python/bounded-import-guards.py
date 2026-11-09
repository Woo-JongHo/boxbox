from pathlib import Path
from os import path as os_path
from math import floor, ceil as up

def sign(value):
    if value<0: return "negative"
    if value == 0: return "zero"
    if value>0: return "positive"
    return "fallthrough"
