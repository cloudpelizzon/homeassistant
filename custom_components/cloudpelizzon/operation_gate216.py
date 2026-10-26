"""Reentrant per-module cutover gate: drain operations before the data snapshot."""
import asyncio
from contextlib import asynccontextmanager
class OperationGate:
    def __init__(self):self.lock=asyncio.Lock();self.owner=None;self.paused=False
    @asynccontextmanager
    async def operation(self):
        task=asyncio.current_task()
        if self.owner is task:
            yield;return
        if self.paused:raise PermissionError('module_installation_in_progress')
        async with self.lock:
            if self.paused:raise PermissionError('module_installation_in_progress')
            self.owner=task
            try:yield
            finally:self.owner=None
    @asynccontextmanager
    async def pause(self):
        if self.paused:raise PermissionError('module_installation_in_progress')
        self.paused=True
        try:
            async with self.lock:
                self.owner=asyncio.current_task()
                try:yield
                finally:self.owner=None
        finally:self.paused=False
