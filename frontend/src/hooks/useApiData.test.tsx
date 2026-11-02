import { renderHook, waitFor, act } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import { useApiData } from './useApiData';

it('discards old data on a new request and ignores aborted responses', async () => {
  let finishOld: (value: Response) => void = () => {};
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'first' })))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finishOld = resolve; }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'latest' })));
  vi.stubGlobal('fetch', fetch);
  const { result, rerender } = renderHook(({ path }) => useApiData<{ id: string }>(path), { initialProps: { path: '/first' } });
  await waitFor(() => expect(result.current.data?.id).toBe('first'));
  rerender({ path: '/old' });
  expect(result.current.data).toBeNull();
  expect(result.current.loading).toBe(true);
  const oldSignal = (fetch.mock.calls[1][1] as RequestInit).signal;
  rerender({ path: '/latest' });
  await waitFor(() => expect(result.current.data?.id).toBe('latest'));
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => { finishOld(new Response(JSON.stringify({ id: 'stale' }))); });
  expect(result.current.data?.id).toBe('latest');
});

it('reports API errors and completes loading', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Temporarily unavailable.' }), { status: 503 })));
  const { result } = renderHook(() => useApiData('/providers'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('Temporarily unavailable.');
  expect(result.current.data).toBeNull();
});
