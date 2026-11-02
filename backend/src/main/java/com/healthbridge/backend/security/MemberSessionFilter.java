package com.healthbridge.backend.security;

import java.io.IOException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** Enforce account revocation on existing sessions, not only on the next login. */
final class MemberSessionFilter extends OncePerRequestFilter {
    private final JdbcTemplate jdbc;

    MemberSessionFilter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            chain.doFilter(request, response);
            return;
        }
        boolean enabled;
        try {
            var rows = jdbc.queryForList("""
                SELECT a.enabled, a.session_version, r.role_name
                FROM member_accounts a LEFT JOIN account_roles r ON r.member_id = a.member_id
                WHERE a.member_id = ?
                """, authentication.getName());
            var currentRoles = rows.stream().map(row -> "ROLE_" + row.get("role_name"))
                .filter(role -> role.equals("ROLE_ADMIN") || role.equals("ROLE_MEMBER"))
                .collect(java.util.stream.Collectors.toSet());
            var sessionRoles = authentication.getAuthorities().stream().map(authority -> authority.getAuthority())
                .collect(java.util.stream.Collectors.toSet());
            long sessionVersion = authentication.getDetails() instanceof Number number ? number.longValue() : 0;
            enabled = !rows.isEmpty() && Boolean.TRUE.equals(rows.getFirst().get("enabled"))
                && ((Number) rows.getFirst().get("session_version")).longValue() == sessionVersion
                && !currentRoles.isEmpty() && currentRoles.equals(sessionRoles);
        } catch (DataAccessException exception) {
            SecurityConfig.writeError(response, 503, "SERVICE_UNAVAILABLE", "Member information is temporarily unavailable.");
            return;
        }
        if (!enabled) {
            var session = request.getSession(false);
            if (session != null) session.invalidate();
            SecurityContextHolder.clearContext();
            SecurityConfig.writeError(response, 401, "UNAUTHENTICATED", "Please sign in to continue.");
            return;
        }
        chain.doFilter(request, response);
    }
}
