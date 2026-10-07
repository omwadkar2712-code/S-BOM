import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  listCatalogApplications,
  listCatalogProjects,
  type CatalogRecord,
} from '../api/client';

export interface CatalogOptionsState {
  items: CatalogRecord[];
  loading: boolean;
  error: string | null;
  empty: boolean;
  hasMore: boolean;
  reload: () => void;
  loadMore: () => void;
  setQuery: (query: string) => void;
  query: string;
}

function isAbort(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export function useCatalogProjects(): CatalogOptionsState {
  return useCatalogLookup('projects', 'all');
}

export function useCatalogApplications(projectId: string | null): CatalogOptionsState {
  return useCatalogLookup('applications', projectId);
}

function useCatalogLookup(kind: 'projects' | 'applications', scopeKey: string | null): CatalogOptionsState {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [items, setItems] = useState<CatalogRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(scopeKey));
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const cursorRef = useRef<string | null>(null);
  cursorRef.current = cursor;

  useEffect(() => {
    setQuery('');
    setDebounced('');
  }, [scopeKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!scopeKey) {
      generation.current += 1;
      setItems([]);
      setLoading(false);
      setError(null);
      setCursor(null);
      return;
    }
    const current = generation.current + 1;
    generation.current = current;
    const controller = new AbortController();
    setItems([]);
    setCursor(null);
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const page =
          kind === 'projects'
            ? await listCatalogProjects({ q: debounced || undefined, limit: 50, signal: controller.signal })
            : await listCatalogApplications(scopeKey, { q: debounced || undefined, limit: 50, signal: controller.signal });
        if (generation.current !== current) return;
        setItems(page.items);
        setCursor(page.next_cursor);
      } catch (err) {
        if (generation.current !== current || isAbort(err)) return;
        setItems([]);
        setCursor(null);
        setError(err instanceof ApiError ? err.message : 'Could not load options.');
      } finally {
        if (generation.current === current) setLoading(false);
      }
    })();
    return () => {
      generation.current += 1;
      controller.abort();
    };
  }, [kind, scopeKey, debounced, refresh]);

  const loadMore = useCallback(() => {
    const pageCursor = cursorRef.current;
    if (!scopeKey || !pageCursor) return;
    const current = generation.current;
    const controller = new AbortController();
    void (async () => {
      try {
        const page =
          kind === 'projects'
            ? await listCatalogProjects({ q: debounced || undefined, cursor: pageCursor, limit: 50, signal: controller.signal })
            : await listCatalogApplications(scopeKey, {
                q: debounced || undefined,
                cursor: pageCursor,
                limit: 50,
                signal: controller.signal,
              });
        if (generation.current !== current) return;
        setItems((prev) => {
          const seen = new Set(prev.map((item) => item.id));
          return [...prev, ...page.items.filter((item) => !seen.has(item.id))];
        });
        setCursor(page.next_cursor);
      } catch (err) {
        if (generation.current !== current || isAbort(err)) return;
      }
    })();
  }, [debounced, kind, scopeKey]);

  const reload = useCallback(() => setRefresh((value) => value + 1), []);

  return {
    items,
    loading: Boolean(scopeKey) && loading,
    error,
    empty: Boolean(scopeKey) && !loading && !error && items.length === 0,
    hasMore: Boolean(cursor),
    reload,
    loadMore,
    setQuery,
    query,
  };
}
