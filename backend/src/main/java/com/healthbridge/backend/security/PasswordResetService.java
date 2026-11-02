package com.healthbridge.backend.security;

import com.healthbridge.backend.admin.PasswordSetupService;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PasswordResetService {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwords;
    private final ResetEmailSender mail;
    public PasswordResetService(JdbcTemplate jdbc, PasswordEncoder passwords, ResetEmailSender mail) {
        this.jdbc = jdbc; this.passwords = passwords; this.mail = mail;
    }
    // Setup and recovery share a single outstanding credential per account, but use domain-separated hashes.
    static String hash(String token) { return PasswordSetupService.hash("password-reset:" + token); }

    @Transactional
    public void request(String email) {
        mail.requireConfiguration();
        var rows = jdbc.queryForList("SELECT member_id, email FROM member_accounts WHERE lower(email)=lower(?) AND enabled=true AND password_setup_required=false", email.trim());
        if (rows.size() != 1) return;
        String id = (String) rows.getFirst().get("member_id");
        jdbc.queryForList("SELECT member_id FROM members WHERE member_id=? FOR UPDATE", id);
        var accounts = jdbc.queryForList("SELECT enabled, password_setup_required, email FROM member_accounts WHERE member_id=? FOR UPDATE", id);
        if (accounts.isEmpty() || !Boolean.TRUE.equals(accounts.getFirst().get("enabled"))
            || Boolean.TRUE.equals(accounts.getFirst().get("password_setup_required"))) return;
        // Persisted cooldown also applies across backend restarts and multiple instances.
        var recent = jdbc.queryForList("SELECT member_id FROM account_password_setup WHERE member_id=? AND expires_at > CURRENT_TIMESTAMP + INTERVAL '29 minutes'", id);
        if (!recent.isEmpty()) return;
        byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        jdbc.update("""
            INSERT INTO account_password_setup(member_id,token_hash,expires_at,used_at) VALUES (?,?,?,NULL)
            ON CONFLICT(member_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,expires_at=EXCLUDED.expires_at,used_at=NULL
            """, id, hash(token), java.sql.Timestamp.from(Instant.now().plusSeconds(1800)));
        mail.send((String) accounts.getFirst().get("email"), token);
    }

    @Transactional
    public void complete(String token, String password) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}") || password == null || password.length() < 12
            || password.getBytes(StandardCharsets.UTF_8).length > 72) throw invalid();
        var candidates = jdbc.queryForList("SELECT member_id FROM account_password_setup WHERE token_hash=?", hash(token));
        if (candidates.size() != 1) throw invalid();
        String id = (String) candidates.getFirst().get("member_id");
        jdbc.queryForList("SELECT member_id FROM members WHERE member_id=? FOR UPDATE", id);
        var accounts = jdbc.queryForList("SELECT enabled,password_setup_required FROM member_accounts WHERE member_id=? FOR UPDATE", id);
        var valid = jdbc.queryForList("SELECT member_id FROM account_password_setup WHERE member_id=? AND token_hash=? AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP FOR UPDATE", id, hash(token));
        if (valid.size()!=1 || accounts.isEmpty() || !Boolean.TRUE.equals(accounts.getFirst().get("enabled"))
            || Boolean.TRUE.equals(accounts.getFirst().get("password_setup_required"))) throw invalid();
        jdbc.update("UPDATE member_accounts SET password_hash=?,session_version=session_version+1 WHERE member_id=?", passwords.encode(password), id);
        jdbc.update("UPDATE account_password_setup SET used_at=CURRENT_TIMESTAMP WHERE member_id=?", id);
        jdbc.update("UPDATE members SET version=version+1 WHERE member_id=?", id);
    }
    private ResponseStatusException invalid() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "The reset link is invalid, expired, or already used. Request a new link and use a password of 12+ characters, up to 72 UTF-8 bytes.");
    }
}
