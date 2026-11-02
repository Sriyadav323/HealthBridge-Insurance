package com.healthbridge.backend.admin;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static com.healthbridge.backend.admin.AdminModels.*;

@Service
public class PasswordSetupService {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwords;
    private final SecureRandom random = new SecureRandom();

    public PasswordSetupService(JdbcTemplate jdbc, PasswordEncoder passwords) {
        this.jdbc = jdbc;
        this.passwords = passwords;
    }

    // Called only inside the administrator's registration/reissue transaction.
    public SetupLink issue(String memberId) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expires = Instant.now().plusSeconds(1800);
        jdbc.update("""
            INSERT INTO account_password_setup(member_id, token_hash, expires_at, used_at)
            VALUES (?, ?, ?, NULL) ON CONFLICT(member_id) DO UPDATE
            SET token_hash=EXCLUDED.token_hash, expires_at=EXCLUDED.expires_at, used_at=NULL
            """, memberId, hash(token), java.sql.Timestamp.from(expires));
        return new SetupLink(token, expires);
    }

    @Transactional
    public void complete(String token, String password) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}") || password == null
                || password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid setup link or password. Use 12+ characters, at most 72 UTF-8 bytes.");
        }
        // All writers lock member -> account -> token in this order, including simultaneous completions.
        var candidates = jdbc.queryForList("SELECT member_id FROM account_password_setup WHERE token_hash = ?", hash(token));
        if (candidates.size() != 1) throw invalidLink();
        String memberId = (String) candidates.getFirst().get("member_id");
        jdbc.queryForList("SELECT member_id FROM members WHERE member_id = ? FOR UPDATE", memberId);
        var accounts = jdbc.queryForList("SELECT password_setup_required FROM member_accounts WHERE member_id = ? FOR UPDATE", memberId);
        var valid = jdbc.queryForList("""
            SELECT member_id FROM account_password_setup WHERE member_id = ? AND token_hash = ?
            AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP FOR UPDATE
            """, memberId, hash(token));
        if (valid.size() != 1 || accounts.isEmpty()
                || !Boolean.TRUE.equals(accounts.getFirst().get("password_setup_required"))) throw invalidLink();
        jdbc.update("""
            UPDATE member_accounts SET password_hash = ?, password_setup_required = false,
            enabled = true, session_version = session_version + 1 WHERE member_id = ?
            """, passwords.encode(password), memberId);
        jdbc.update("UPDATE account_password_setup SET used_at = CURRENT_TIMESTAMP WHERE member_id = ?", memberId);
        jdbc.update("UPDATE members SET version = version + 1 WHERE member_id = ?", memberId);
    }

    private ResponseStatusException invalidLink() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "This setup link is invalid, expired, or already used. Ask an administrator for a new link.");
    }

    public static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable");
        }
    }
}
