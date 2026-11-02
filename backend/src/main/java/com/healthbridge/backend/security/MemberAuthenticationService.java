package com.healthbridge.backend.security;

import java.util.Map;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class MemberAuthenticationService {

    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final String dummyHash;

    public MemberAuthenticationService(JdbcTemplate jdbc, PasswordEncoder encoder) {
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.dummyHash = encoder.encode(java.util.UUID.randomUUID().toString());
    }

    public Authentication authenticate(String email, String password) {
        if (email == null || password == null || password.isBlank() || email.isBlank() || email.length() > 255
                || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw new BadCredentialsException("Invalid credentials");
        }
        var accounts = jdbc.queryForList(
            """
            SELECT member_id, password_hash, session_version
            FROM member_accounts
            WHERE lower(email) = lower(?) AND enabled = true AND password_setup_required = false
            """,
            email.strip()
        );

        if (accounts.size() != 1) {
            encoder.matches(password, dummyHash);
            throw new BadCredentialsException("Invalid credentials");
        }

        Map<String, Object> account = accounts.get(0);

        if (!encoder.matches(password, (String) account.get("password_hash"))) {
            throw new BadCredentialsException("Invalid credentials");
        }

        List<String> roles = jdbc.queryForList(
            "SELECT role_name FROM account_roles WHERE member_id = ? ORDER BY role_name", String.class, account.get("member_id"));
        var authorities = roles.stream().filter(role -> role.equals("ADMIN") || role.equals("MEMBER"))
            .map(role -> new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_" + role)).toList();
        if (authorities.isEmpty()) throw new BadCredentialsException("Invalid credentials");
        var authentication = UsernamePasswordAuthenticationToken.authenticated(account.get("member_id"), null, authorities);
        authentication.setDetails(((Number) account.getOrDefault("session_version", 0L)).longValue());
        return authentication;
    }
}
