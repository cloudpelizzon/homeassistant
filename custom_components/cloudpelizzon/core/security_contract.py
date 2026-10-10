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


def _class_method(source, method_name):
    tree = ast.parse(source)
    matches = [
        m
        for cls in tree.body
        if isinstance(cls, ast.ClassDef)
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



def _delayed_arm_rechecks_license(node):
    """A license revoked during the arming countdown must abort activation."""
    if node is None:
        return False
    try:
        body = node.body
        if len(body) != 1 or not isinstance(body[0], ast.Try):
            return False
        stmts = body[0].body
        for i, stmt in enumerate(stmts):
            if i == 0 or not isinstance(stmt, ast.Expr) or not isinstance(stmt.value, ast.Await):
                continue
            call = stmt.value.value
            if not isinstance(call, ast.Call):
                continue
            if not isinstance(call.func, ast.Attribute) or call.func.attr != "async_set_state":
                continue
            if not call.args or not isinstance(call.args[0], ast.Name) or call.args[0].id != "final_state":
                continue
            gate = stmts[i - 1]
            if not isinstance(gate, ast.If):
                return False
            if not isinstance(gate.test, ast.UnaryOp) or not isinstance(gate.test.op, ast.Not):
                return False
            if "is_module_authorized" not in ast.unparse(gate.test) or "CP-SECURITY" not in ast.unparse(gate.test):
                return False
            if not any(
                isinstance(n, ast.Await) and isinstance(n.value, ast.Call)
                and isinstance(n.value.func, ast.Attribute)
                and n.value.func.attr == "async_disarm"
                for n in ast.walk(ast.Module(body=gate.body, type_ignores=[]))
            ):
                return False
            return any(isinstance(n, ast.Return) for n in gate.body)
    except Exception:
        return False
    return False


def private_emergency_runtime_verified(module_dir: Path) -> bool:
    """True only for a package with guarded arming and guarded HTTP config."""
    try:
        module_dir = Path(module_dir)
        engine = (module_dir / "engine.py").read_text(encoding="utf-8")
        manager = (module_dir / "manager.py").read_text(encoding="utf-8")
        config = (module_dir / "api_configuracao.py").read_text(encoding="utf-8")

        for name in ("async_arm_home", "async_arm_away"):
            method = _class_method(engine, name)
            if method is None or not _guarded_arm_method(method):
                return False

        # Physical emergency operations must still be implemented.
        if _class_method(engine, "async_disarm") is None:
            return False

        if not _delayed_arm_rechecks_license(
            _class_method(engine, "_finish_arming")
        ):
            return False

        reg = _class_method(manager, "_register")
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
