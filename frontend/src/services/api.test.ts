import { describe, it, expect, vi } from 'vitest';
import { apiFetch, getApiData, mutateApiData, SESSION_EXPIRED_EVENT } from './api';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('API session and CSRF handling', () => {
  it('notifies the session boundary on 401, but not permission-denied 403', async () => {
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    const fetch = vi.fn().mockResolvedValueOnce(json({}, 403)).mockResolvedValueOnce(json({}, 401));
    vi.stubGlobal('fetch', fetch);
    await apiFetch('/api/v1/members/me/benefits');
    expect(expired).not.toHaveBeenCalled();
    await apiFetch('/api/v1/members/me/benefits');
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });

  it('sends a fresh CSRF token and same-origin cookies with mutations', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ token: 'fresh-token' })).mockResolvedValueOnce(json({ saved: true }));
    vi.stubGlobal('fetch', fetch);
    await expect(mutateApiData('/members/me/profile', 'PATCH', { phone: '' })).resolves.toEqual({ saved: true });
    expect(fetch).toHaveBeenLastCalledWith('/api/v1/members/me/profile', expect.objectContaining({
      credentials: 'same-origin', method: 'PATCH', headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'fresh-token' }),
    }));
  });

  it('renews a rejected CSRF token once', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ token: 'old' }))
      .mockResolvedValueOnce(json({ code: 'CSRF_INVALID' }, 403))
      .mockResolvedValueOnce(json({ token: 'new' })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    await mutateApiData('/auth/logout', 'POST');
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(fetch).toHaveBeenLastCalledWith('/api/v1/auth/logout', expect.objectContaining({
      headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'new' }),
    }));
  });

  it('does not retry permission failures or server errors', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ token: 'token' }))
      .mockResolvedValueOnce(json({ code: 'FORBIDDEN', message: 'Access denied.' }, 403));
    vi.stubGlobal('fetch', fetch);
    await expect(mutateApiData('/members/me/profile', 'PATCH', {})).rejects.toThrow('Access denied.');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('provides a useful error for unavailable servers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(getApiData('/providers')).rejects.toThrow('Unable to connect');
  });
});
