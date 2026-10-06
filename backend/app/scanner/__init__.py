"""Manifest detection, parsing, and SBOM pipeline."""

from . import parsers
from .detector import KIND_BY_NAME, detect, match_file
from .pipeline import dedupe, normalize, scan_tree

__all__ = [
    "KIND_BY_NAME",
    "dedupe",
    "detect",
    "match_file",
    "normalize",
    "parsers",
    "scan_tree",
]
