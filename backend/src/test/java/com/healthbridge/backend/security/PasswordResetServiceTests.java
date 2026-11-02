package com.healthbridge.backend.security;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

class PasswordResetServiceTests {
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    PasswordEncoder passwords = mock(PasswordEncoder.class);
    ResetEmailSender mail = mock(ResetEmailSender.class);
    PasswordResetService service = new PasswordResetService(jdbc, passwords, mail);
    String token = "A".repeat(43);
    @BeforeEach void defaults() {
        when(jdbc.queryForList(anyString(), anyString())).thenReturn(List.of());
    }
    @Test void unknownEmailDoesNotSendOrWrite() {
        service.request("missing@example.com");
        verify(mail, never()).send(anyString(), anyString());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }
    @Test void recoveryHashCannotBeUsedAsSetupHash() {
        assertNotEquals(com.healthbridge.backend.admin.PasswordSetupService.hash(token), PasswordResetService.hash(token));
    }
    @Test void invalidExpiredAndUsedTokensCannotChangePassword() {
        assertThrows(ResponseStatusException.class, () -> service.complete("bad", "long-test-password"));
        assertThrows(ResponseStatusException.class, () -> service.complete(token, "long-test-password"));
        verifyNoInteractions(passwords);
    }
    @Test void rejectsPasswordsBeyondBcryptByteLimit() {
        assertThrows(ResponseStatusException.class, () -> service.complete(token, "é".repeat(37)));
        verifyNoInteractions(passwords);
    }
    @Test void successfulResetRevokesSessionsWithoutEnablingOrChangingRoles() {
        when(jdbc.queryForList(contains("WHERE token_hash=?"), anyString())).thenReturn(List.of(Map.of("member_id", "ID")));
        when(jdbc.queryForList(contains("SELECT enabled,password_setup_required"), anyString()))
            .thenReturn(List.of(Map.of("enabled", true, "password_setup_required", false)));
        when(jdbc.queryForList(contains("AND used_at IS NULL"), anyString(), anyString())).thenReturn(List.of(Map.of("member_id", "ID")));
        when(passwords.encode("long-test-password")).thenReturn("hashed");
        service.complete(token, "long-test-password");
        verify(jdbc).update("UPDATE member_accounts SET password_hash=?,session_version=session_version+1 WHERE member_id=?", "hashed", "ID");
        verify(jdbc).update("UPDATE account_password_setup SET used_at=CURRENT_TIMESTAMP WHERE member_id=?", "ID");
    }
    @Test void disabledAccountCannotResetEvenWithValidToken() {
        when(jdbc.queryForList(contains("WHERE token_hash=?"), anyString())).thenReturn(List.of(Map.of("member_id", "ID")));
        when(jdbc.queryForList(contains("SELECT enabled,password_setup_required"), anyString()))
            .thenReturn(List.of(Map.of("enabled", false, "password_setup_required", false)));
        when(jdbc.queryForList(contains("AND used_at IS NULL"), anyString(), anyString())).thenReturn(List.of(Map.of("member_id", "ID")));
        assertThrows(ResponseStatusException.class, () -> service.complete(token, "long-test-password"));
        verifyNoInteractions(passwords);
    }
    @Test void issuesOnlyHashedTokensWithThirtyMinuteExpiry() {
        when(jdbc.queryForList(contains("lower(email)"), anyString()))
            .thenReturn(List.of(Map.of("member_id", "ID", "email", "member@example.com")));
        when(jdbc.queryForList(contains("SELECT enabled, password_setup_required, email"), anyString()))
            .thenReturn(List.of(Map.of("enabled", true, "password_setup_required", false, "email", "member@example.com")));
        service.request("member@example.com");
        var token = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(mail).send(eq("member@example.com"), token.capture());
        assertTrue(token.getValue().matches("[A-Za-z0-9_-]{43}"));
        var expiry = org.mockito.ArgumentCaptor.forClass(java.sql.Timestamp.class);
        verify(jdbc).update(contains("INSERT INTO account_password_setup"), eq("ID"), eq(PasswordResetService.hash(token.getValue())), expiry.capture());
        assertTrue(expiry.getValue().toInstant().isAfter(java.time.Instant.now().plusSeconds(1790)));
    }
    @Test void expiryOrReplayAfterCandidateLookupCannotChangePassword() {
        when(jdbc.queryForList(contains("WHERE token_hash=?"), anyString())).thenReturn(List.of(Map.of("member_id", "ID")));
        when(jdbc.queryForList(contains("SELECT enabled,password_setup_required"), anyString()))
            .thenReturn(List.of(Map.of("enabled", true, "password_setup_required", false)));
        when(jdbc.queryForList(contains("AND used_at IS NULL"), anyString(), anyString())).thenReturn(List.of());
        assertThrows(ResponseStatusException.class, () -> service.complete(token, "long-test-password"));
        verifyNoInteractions(passwords);
    }
}
