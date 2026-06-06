"""O'zbekiston viloyat va tumanlari (Ibratbek/regions-districts-json)."""
from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / 'data'


def _norm(s: str) -> str:
    s = unicodedata.normalize('NFKD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace('ʻ', "'").replace('’', "'").replace('`', "'")
    s = re.sub(r"[^a-z0-9'\s]", ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


@lru_cache(maxsize=1)
def load_address_catalog() -> dict:
    regions_raw = json.loads((DATA_DIR / 'regions_raw.json').read_text(encoding='utf-8'))
    districts_raw = json.loads((DATA_DIR / 'districts_raw.json').read_text(encoding='utf-8'))
    regions = []
    region_by_id = {}
    for r in regions_raw:
        item = {
            'id': str(r['id']),
            'name_uz': r['name_uz'],
            'name_ru': r.get('name_ru', ''),
            'name_en': r.get('name_en', ''),
            'districts': [],
        }
        regions.append(item)
        region_by_id[item['id']] = item
    search_index = []
    for d in districts_raw:
        rid = str(d['region_id'])
        region = region_by_id.get(rid)
        if not region:
            continue
        dist = {
            'id': str(d['id']),
            'region_id': rid,
            'name_uz': d['name_uz'],
            'name_ru': d.get('name_ru', ''),
            'name_en': d.get('name_en', ''),
        }
        region['districts'].append(dist)
        search_index.append({
            **dist,
            'region_name_uz': region['name_uz'],
            'region_name_ru': region['name_ru'],
            'search_key': _norm(f"{d['name_uz']} {region['name_uz']}"),
        })
    return {'regions': regions, 'search_index': search_index}


def search_districts(query: str, limit: int = 12) -> list[dict]:
    q = _norm(query)
    if len(q) < 2:
        return []
    catalog = load_address_catalog()
    hits = []
    for item in catalog['search_index']:
        if q in item['search_key'] or q in _norm(item['name_uz']):
            hits.append({
                'district_id': item['id'],
                'district_name_uz': item['name_uz'],
                'district_name_ru': item['name_ru'],
                'region_id': item['region_id'],
                'region_name_uz': item['region_name_uz'],
                'region_name_ru': item['region_name_ru'],
            })
            if len(hits) >= limit:
                break
    return hits


def format_address(region_id: str, district_id: str) -> str:
    catalog = load_address_catalog()
    region = next((r for r in catalog['regions'] if r['id'] == str(region_id)), None)
    if not region:
        return ''
    district = next((d for d in region['districts'] if d['id'] == str(district_id)), None)
    if not district:
        return region['name_uz']
    return f"{region['name_uz']}, {district['name_uz']}"
