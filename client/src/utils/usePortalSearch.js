import { useState, useEffect, useRef, useCallback } from 'react';

const FILTER_ORDER = ['all', 'announcements', 'events', 'departments'];

/**
 * Resolve the navigation URL for a search result based on the active portal context.
 * @param {object} item
 * @param {'student' | 'staff' | 'mypage' | 'guest'} portalContext
 */
export function resolveSearchResultUrl(item, portalContext = 'student') {
  if (!item) return '/';
  if (item.url) return item.url;

  if (item.type === 'page') {
    if (portalContext === 'guest') return `/page/${item.id}`;
    if (portalContext === 'staff' || portalContext === 'mypage') return `/staff/page/${item.id}`;
    return `/student/page/${item.id}`;
  }

  if (item.type === 'event') {
    if (portalContext === 'guest') return '/auth';
    if (portalContext === 'mypage') return '/staff/mypage/events';
    if (portalContext === 'staff') return '/staff/events';
    return '/student/events';
  }

  if (portalContext === 'guest') return '/auth';
  if (portalContext === 'mypage') return '/staff/mypage/announcements';
  if (portalContext === 'staff') return '/staff/announcements';
  return '/student/announcements';
}

/**
 * Shared portal search hook backed by GET /api/search.
 * Supports announcements, events, and approved pages with debouncing and category filtering.
 */
export function usePortalSearch(portalContext = 'student') {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      return undefined;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(filterCategory)}`,
          { headers, signal: controller.signal }
        );
        if (!res.ok) {
          setSearchResults([]);
          return;
        }
        const data = await res.json();
        const mapped = (data.results || []).map((item) => ({
          ...item,
          url: resolveSearchResultUrl(item, portalContext),
        }));
        setSearchResults(mapped);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Portal search failed:', err);
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, filterCategory, portalContext]);

  const handleSearchChange = useCallback((e) => {
    const nextQuery = e.target.value;
    setSearchQuery(nextQuery);
    const hasQuery = Boolean(nextQuery.trim());
    setShowDropdown(hasQuery);
    if (!hasQuery) {
      setSearchResults([]);
      setIsSearching(false);
    } else {
      setIsSearching(true);
    }
  }, []);

  const handleToggleFilter = useCallback(() => {
    setFilterCategory((prev) => {
      const idx = FILTER_ORDER.indexOf(prev);
      return FILTER_ORDER[(idx + 1) % FILTER_ORDER.length];
    });
  }, []);

  const handleSelectSearchResult = useCallback((_result, openOnly) => {
    setShowDropdown(Boolean(openOnly));
  }, []);

  return {
    searchQuery,
    filterCategory,
    searchResults,
    isSearching,
    showDropdown,
    searchContainerRef,
    handleSearchChange,
    handleToggleFilter,
    handleSelectSearchResult,
  };
}
