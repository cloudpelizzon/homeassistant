"""Static safety contract for loading a revoked private security runtime.

Fail closed for arbitrary commercial execution. Permit the emergency runtime
only when the *installed* signed private module contains the required guards.
This probe does not execute private code and runs once during HA startup.
"""

from __future__ import annotations

import ast
from pathlib import Path


def _first_statement(body):
    """Skip an optional method docstring."""
    if (
        body
        and isinstance(body[0], ast.Expr)
        and isinstance(body[0].value, ast.Constant)
        and isinstance(body[0].value.value, str)
    ):
        return body[1] if len(body) > 1 else None
    return body[0] if body else None


def _class_method(source, cls_name, method_name):
    tree = ast.parse(source)
    matches = [
        m
        for cls in tree.body
        if isinstance(cls, ast.ClassDef) and cls.name == cls_name
        for m in cls.body
        if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef))
        and m.name == method_name
    ]
    return matches[0] if len(matches) == 1 else None


def _guarded_arm_method(node):
    first = _first_statement(node.body)
    if not isinstance(first, ast.If):
        return False
    if "is_module_authorized" not in ast.unparse(first.test):
        return False
    if "CP-SECURITY" not in ast.unparse(first.test):
        return False
    return any(isinstance(n, ast.Raise) for n in ast.walk(ast.Module(body=first.body, type_ignores=[])))


def _guarded_service_registration(node):
    first = _first_statement(node.body)
    if not isinstance(first, ast.If):
        return False
    condition = ast.unparse(first.test)
    if (
        "_service_armar_parcial" not in condition
        or "_service_armar_total" not in condition
    ):
        return False
    inner = ast.Module(body=first.body, type_ignores=[])
    text = ast.unparse(inner)
    return (
        "is_module_authorized" in text
        and "CP-SECURITY" in text
        and "commercial_license_denied" in text
    )


def private_emergency_runtime_verified(module_dir: Path) -> bool:
    """True only for a package with guarded arming and guarded HTTP config."""
    try:
        module_dir = Path(module_dir)
        engine = (module_dir / "engine.py").read_text(encoding="utf-8")
        manager = (module_dir / "manager.py").read_text(encoding="utf-8")
        config = (module_dir / "api_configuracao.py").read_text(encoding="utf-8")

        for name in ("async_arm_home", "async_arm_away"):
            method = _class_method(engine, "SecurityEngine", name)
            if method is None or not _guarded_arm_method(method):
                return False

        # Physical emergency operations must still be implemented.
        if _class_method(engine, "SecurityEngine", "async_disarm") is None:
            return False

        reg = _class_method(manager, "SecurityManager", "_register")
        if reg is None or not _guarded_service_registration(reg):
            return False

        tree = ast.parse(config)
        views = [
            cls for cls in tree.body
            if isinstance(cls, ast.ClassDef)
            and cls.name == "ConfiguracaoSegurancaView"
        ]
        if len(views) != 1:
            return False
        http_methods = [
            method for method in views[0].body
            if isinstance(method, ast.AsyncFunctionDef)
            and method.name.lower() in {"get", "post", "put", "patch", "delete"}
        ]
        if not http_methods:
            return False
        for method in http_methods:
            first = _first_statement(method.body)
            if (
                not isinstance(first, ast.If)
                or "is_module_authorized" not in ast.unparse(first.test)
                or "CP-SECURITY" not in ast.unparse(first.test)
            ):
                return False
    except (OSError, SyntaxError, UnicodeError, ValueError):
        return False

    return True
