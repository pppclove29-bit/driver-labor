// 장소 검색 입력. 서버에는 검색어만 간다(GET /api/places). 현재 위치는 쓰지 않는다.
// 입력을 멈추고 300ms 뒤에 2자 이상일 때만 조회하고, 같은 검색어는 메모리에서 다시 쓴다.
// 조회가 막혀도 이름만 입력해서 여행을 시작·정산할 수 있다(장소를 안 고르면 경로는 기본값).

import { useEffect, useRef, useState } from 'react';

import { api } from '../api/index.js';
import type { PlaceRef } from '../api/client.js';
import { LOOKUP_LIMIT_MESSAGE } from '../model/lookup.js';

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;
const cache = new Map<string, PlaceRef[]>();

export function PlaceSearch({
  value,
  place,
  placeholder,
  onChange,
}: {
  value: string;
  place?: PlaceRef | undefined;
  placeholder: string;
  /** 글자를 고치면 place는 undefined, 목록에서 고르면 그 장소. */
  onChange: (text: string, place?: PlaceRef) => void;
}) {
  const [results, setResults] = useState<PlaceRef[]>([]);
  const [notice, setNotice] = useState<'limit' | 'waiting' | undefined>();
  const latest = useRef('');

  useEffect(() => {
    const q = value.trim();
    latest.current = q;
    if (place || [...q].length < MIN_CHARS) {
      setResults([]);
      return;
    }
    const hit = cache.get(q);
    if (hit) {
      setResults(hit);
      return;
    }
    const timer = setTimeout(() => {
      void api.places(q).then((r) => {
        if (latest.current !== q) return;
        if (r.ok) {
          cache.set(q, r.value.places);
          setResults(r.value.places);
          setNotice(undefined);
        } else {
          setResults([]);
          setNotice(r.reason === 'invalid' ? undefined : r.reason);
        }
      });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [value, place]);

  return (
    <div className="field">
      {notice === 'limit' ? (
        <div className="note">{LOOKUP_LIMIT_MESSAGE} 장소 이름만 적어도 됩니다.</div>
      ) : null}
      {notice === 'waiting' ? (
        <div className="note">검색 대기 중이에요. 장소 이름만 적어도 됩니다.</div>
      ) : null}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
      {place ? <p className="screen__sub">📍 {place.address || place.name}</p> : null}
      {results.map((p) => (
        <button
          key={`${p.name}-${String(p.lat)}-${String(p.lng)}`}
          type="button"
          className="row"
          onClick={() => {
            setResults([]);
            onChange(p.name, p);
          }}
        >
          <span>
            {p.name}
            <br />
            <span className="dim">{p.address}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
