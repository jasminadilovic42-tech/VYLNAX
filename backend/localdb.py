import json
import uuid
import copy
from pathlib import Path
from typing import Any, Dict, List, Optional

class LocalCursor:
    def __init__(self, docs: List[Dict[str, Any]]):
        self.docs = docs
    def sort(self, key: str, direction: int = 1):
        rev = direction == -1
        self.docs.sort(key=lambda d: d.get(key, ''), reverse=rev)
        return self
    async def to_list(self, length: Optional[int] = None):
        docs = self.docs if length is None else self.docs[:length]
        return [copy.deepcopy(d) for d in docs]

class LocalCollection:
    def __init__(self, db: 'LocalDB', name: str):
        self.db = db
        self.name = name
        self.db.data.setdefault(name, [])
    def _matches(self, doc: Dict[str, Any], query: Dict[str, Any]) -> bool:
        for k, v in (query or {}).items():
            if doc.get(k) != v:
                return False
        return True
    def _project(self, doc: Dict[str, Any], projection: Optional[Dict[str, Any]]):
        d = copy.deepcopy(doc)
        if projection and projection.get('_id') == 0:
            d.pop('_id', None)
        return d
    async def create_index(self, *args, **kwargs):
        return None
    async def find_one(self, query=None, projection=None):
        for doc in self.db.data.get(self.name, []):
            if self._matches(doc, query or {}):
                return self._project(doc, projection)
        return None
    def find(self, query=None, projection=None):
        docs = [self._project(d, projection) for d in self.db.data.get(self.name, []) if self._matches(d, query or {})]
        return LocalCursor(docs)
    async def insert_one(self, doc):
        d = copy.deepcopy(doc)
        d.setdefault('_id', uuid.uuid4().hex)
        self.db.data[self.name].append(d)
        self.db.save()
        return type('InsertOneResult', (), {'inserted_id': d['_id']})()
    async def insert_many(self, docs):
        ids = []
        for doc in docs:
            d = copy.deepcopy(doc)
            d.setdefault('_id', uuid.uuid4().hex)
            ids.append(d['_id'])
            self.db.data[self.name].append(d)
        self.db.save()
        return type('InsertManyResult', (), {'inserted_ids': ids})()
    async def delete_one(self, query):
        before = len(self.db.data.get(self.name, []))
        for i, doc in enumerate(list(self.db.data.get(self.name, []))):
            if self._matches(doc, query or {}):
                del self.db.data[self.name][i]
                break
        self.db.save()
        return type('DeleteResult', (), {'deleted_count': before - len(self.db.data.get(self.name, []))})()
    async def delete_many(self, query):
        before = len(self.db.data.get(self.name, []))
        self.db.data[self.name] = [d for d in self.db.data.get(self.name, []) if not self._matches(d, query or {})]
        self.db.save()
        return type('DeleteResult', (), {'deleted_count': before - len(self.db.data.get(self.name, []))})()
    async def update_one(self, query, update):
        matched = 0
        modified = 0
        for doc in self.db.data.get(self.name, []):
            if self._matches(doc, query or {}):
                matched = 1
                if '$set' in update:
                    doc.update(copy.deepcopy(update['$set']))
                    modified = 1
                break
        self.db.save()
        return type('UpdateResult', (), {'matched_count': matched, 'modified_count': modified})()

class LocalDB:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        if self.path.exists():
            try:
                self.data = json.loads(self.path.read_text(encoding='utf-8'))
            except Exception:
                self.data = {}
        else:
            self.data = {}
    def __getattr__(self, name: str):
        if name.startswith('_'):
            raise AttributeError(name)
        return LocalCollection(self, name)
    def save(self):
        self.path.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding='utf-8')
