"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

type Result<T> = { path: string | null; data: T | null; error: string };

export function useApi<T>(path: string | null) {
  const [result, setResult] = useState<Result<T>>({ path: null, data: null, error: "" });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!path) return;
    let active = true;
    api<T>(path)
      .then((data) => {
        if (active) setResult({ path, data, error: "" });
      })
      .catch((error: unknown) => {
        if (active) setResult({ path, data: null, error: error instanceof ApiError ? error.message : "Server bilan aloqa bo‘lmadi" });
      });
    return () => { active = false; };
  }, [path]);

  const reload = useCallback(async () => {
    if (!path) return;
    setRefreshing(true);
    try {
      setResult({ path, data: await api<T>(path), error: "" });
    } catch (error) {
      setResult({ path, data: null, error: error instanceof ApiError ? error.message : "Server bilan aloqa bo‘lmadi" });
    } finally {
      setRefreshing(false);
    }
  }, [path]);

  const current = result.path === path ? result : { path, data: null, error: "" };
  return { data: current.data, loading: Boolean(path && (result.path !== path || refreshing)), error: current.error, reload };
}

