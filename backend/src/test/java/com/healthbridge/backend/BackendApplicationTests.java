package com.healthbridge.backend;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// Full application/security chain, with no external database or credentials required.
@SpringBootTest(properties = {
    "spring.autoconfigure.exclude=org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration"
})
@AutoConfigureMockMvc
class BackendApplicationTests {
    @Autowired MockMvc mvc;
    @Autowired PasswordEncoder passwords;
    @MockitoBean JdbcTemplate jdbc;
    private String password;

    @BeforeEach
    void account() {
        password = UUID.randomUUID().toString();
        when(jdbc.queryForList(contains("SELECT a.enabled, a.session_version"), anyString()))
            .thenReturn(List.of(Map.of("enabled", true, "session_version", 0L, "role_name", "MEMBER")));
        when(jdbc.queryForList(contains("SELECT role_name FROM account_roles"), eq(String.class), any()))
            .thenReturn(List.of("MEMBER"));
        when(jdbc.queryForList(contains("FROM member_accounts"), eq("member@example.com")))
            .thenReturn(List.of(Map.of("member_id", "MEMBER-A", "password_hash", passwords.encode(password))));
    }

    private MockHttpSession memberSession(String memberId) {
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(memberId, null, List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_MEMBER"))));
        var session = new MockHttpSession();
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        return session;
    }

    private String csrf(MockHttpSession session) throws Exception {
        var result = mvc.perform(get("/api/v1/auth/csrf").session(session))
            .andExpect(status().isOk()).andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.token");
    }

    private MvcResult login(MockHttpSession session, String token, String suppliedPassword) throws Exception {
        return mvc.perform(post("/api/v1/auth/login").session(session)
            .header("X-XSRF-TOKEN", token).contentType("application/json")
            .content("{\"email\":\"member@example.com\",\"password\":\"" + suppliedPassword + "\"}"))
            .andReturn();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/auth/me", "/members/me/benefits", "/members/me/claims",
        "/providers", "/members/me/profile", "/members/me/prescriptions"})
    void anonymousRequestsCannotReadMemberData(String path) throws Exception {
        mvc.perform(get("/api/v1" + path)).andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        verifyNoInteractions(jdbc);
    }

    @Test
    void loginProfileAndLogoutRequireCsrf() throws Exception {
        mvc.perform(post("/api/v1/auth/login").contentType("application/json").content("{}"))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        mvc.perform(patch("/api/v1/members/me/profile").session(memberSession("MEMBER-A"))
            .contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/logout").session(memberSession("MEMBER-A")))
            .andExpect(status().isForbidden());
        verifyNoInteractions(jdbc);
    }

    @Test
    void loginRotatesSessionAndCsrfThenLogoutInvalidatesSession() throws Exception {
        var session = new MockHttpSession();
        String token = csrf(session);
        String anonymousId = session.getId();
        var result = login(session, token, password);
        assertEquals(200, result.getResponse().getStatus());
        assertNotEquals(anonymousId, session.getId());
        mvc.perform(get("/api/v1/auth/me").session(session))
            .andExpect(status().isOk()).andExpect(jsonPath("$.memberId").value("MEMBER-A"));
        mvc.perform(post("/api/v1/auth/logout").session(session).header("X-XSRF-TOKEN", token))
            .andExpect(status().isForbidden());
        String authenticatedToken = csrf(session);
        assertNotEquals(token, authenticatedToken);
        mvc.perform(post("/api/v1/auth/logout").session(session).header("X-XSRF-TOKEN", authenticatedToken))
            .andExpect(status().isNoContent());
        assertTrue(session.isInvalid());
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void csrfTokenCannotBeReusedInAnotherSession() throws Exception {
        String otherSessionToken = csrf(new MockHttpSession());
        var session = new MockHttpSession();
        csrf(session);
        assertEquals(403, login(session, otherSessionToken, password).getResponse().getStatus());
        verifyNoInteractions(jdbc);
    }

    @Test
    void staleSessionCookieDoesNotAuthenticate() throws Exception {
        mvc.perform(get("/api/v1/members/me/profile")
            .cookie(new jakarta.servlet.http.Cookie("JSESSIONID", "expired-synthetic-session")))
            .andExpect(status().isUnauthorized());
        verifyNoInteractions(jdbc);
    }

    @Test
    void disabledAccountsLoseExistingSessions() throws Exception {
        when(jdbc.queryForList(contains("SELECT a.enabled, a.session_version"), eq("MEMBER-A")))
            .thenReturn(List.of(Map.of("enabled", false, "session_version", 0L, "role_name", "MEMBER")));
        var session = memberSession("MEMBER-A");
        mvc.perform(get("/api/v1/members/me/benefits").session(session))
            .andExpect(status().isUnauthorized());
        assertTrue(session.isInvalid());
        verify(jdbc, never()).queryForMap(anyString(), eq("MEMBER-A"));
    }

    @Test
    void reEnabledAccountsCannotReuseAnOldSession() throws Exception {
        when(jdbc.queryForList(contains("SELECT a.enabled, a.session_version"), eq("MEMBER-A")))
            .thenReturn(List.of(Map.of("enabled", true, "session_version", 2L, "role_name", "MEMBER")));
        var session = memberSession("MEMBER-A");
        mvc.perform(get("/api/v1/auth/me").session(session)).andExpect(status().isUnauthorized());
        assertTrue(session.isInvalid());
    }

    @Test
    void accountStatusDatabaseFailureDoesNotExposeDetailsOrInvalidateSession() throws Exception {
        when(jdbc.queryForList(contains("SELECT a.enabled, a.session_version"), eq("MEMBER-A")))
            .thenThrow(new DataAccessResourceFailureException("sensitive connection detail"));
        var session = memberSession("MEMBER-A");
        mvc.perform(get("/api/v1/auth/me").session(session))
            .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"));
        assertFalse(session.isInvalid());
    }

    @Test
    void loginRequestNeverPrintsCredentials() {
        String rendered = new com.healthbridge.backend.security.AuthController.LoginRequest(
            "member@example.com", password).toString();
        assertFalse(rendered.contains(password));
        assertFalse(rendered.contains("member@example.com"));
    }

    @Test
    void wrongPasswordAndUnknownAccountHaveSameResponse() throws Exception {
        var session = new MockHttpSession();
        String token = csrf(session);
        assertEquals(401, login(session, token, "incorrect").getResponse().getStatus());
        when(jdbc.queryForList(contains("FROM member_accounts"), eq("member@example.com"))).thenReturn(List.of());
        assertEquals(401, login(session, token, password).getResponse().getStatus());
        mvc.perform(get("/api/v1/auth/me").session(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void malformedLoginIsBadRequest() throws Exception {
        var session = new MockHttpSession();
        mvc.perform(post("/api/v1/auth/login").session(session).header("X-XSRF-TOKEN", csrf(session))
            .contentType("application/json").content("{\"email\":\"invalid\",\"password\":null}"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(jdbc);
    }

    @Test
    void claimsAndPrescriptionsUseSessionMemberAndIgnoreRequestedMember() throws Exception {
        for (String member : List.of("MEMBER-A", "MEMBER-B")) {
            when(jdbc.queryForList(contains("FROM claims"), eq(member)))
                .thenReturn(List.of(Map.of("id", member + "-CLAIM")));
            mvc.perform(get("/api/v1/members/me/claims?memberId=OTHER").session(memberSession(member)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(member + "-CLAIM"));
            mvc.perform(get("/api/v1/members/me/prescriptions?memberId=OTHER").session(memberSession(member)))
                .andExpect(status().isOk());
            verify(jdbc).queryForList(contains("FROM prescriptions WHERE member_id = ?"), eq(member));
        }
        verify(jdbc, never()).queryForList(anyString(), eq("OTHER"));
    }

    @Test
    void benefitsAreScopedToSessionMember() throws Exception {
        var row = Map.<String, Object>ofEntries(
            Map.entry("memberId", "MEMBER-A"), Map.entry("memberName", "Synthetic Member"),
            Map.entry("planName", "Demo PPO"), Map.entry("planType", "PPO"), Map.entry("coverageStatus", "Active"),
            Map.entry("deductible_total", 1500), Map.entry("deductible_met", 900),
            Map.entry("oop_maximum", 5000), Map.entry("oop_spent", 1200),
            Map.entry("copay_primary_care", 25), Map.entry("copay_specialist", 50), Map.entry("copay_urgent_care", 75));
        when(jdbc.queryForMap(contains("JOIN member_benefits"), eq("MEMBER-A"))).thenReturn(row);
        mvc.perform(get("/api/v1/members/me/benefits?memberId=OTHER").session(memberSession("MEMBER-A")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.memberId").value("MEMBER-A"));
        verify(jdbc).queryForMap(contains("WHERE m.member_id = ?"), eq("MEMBER-A"));
        verify(jdbc).queryForList(contains("FROM coverage_items"), eq("MEMBER-A"));
    }

    @Test
    void profileWriteCannotChangeAnotherMember() throws Exception {
        var session = memberSession("MEMBER-A");
        when(jdbc.update(anyString(), eq("555-0101"), eq("Demo address"), eq("MEMBER-A"))).thenReturn(1);
        when(jdbc.queryForMap(contains("FROM members m JOIN member_accounts"), eq("MEMBER-A")))
            .thenReturn(Map.of("memberId", "MEMBER-A"));
        mvc.perform(patch("/api/v1/members/me/profile").session(session).header("X-XSRF-TOKEN", csrf(session))
            .contentType("application/json")
            .content("{\"memberId\":\"OTHER\",\"phone\":\"555-0101\",\"address\":\"Demo address\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.memberId").value("MEMBER-A"));
        verify(jdbc).update(contains("WHERE member_id = ?"), eq("555-0101"), eq("Demo address"), eq("MEMBER-A"));
    }

    @Test
    void invalidContactDoesNotWriteToDatabase() throws Exception {
        var session = memberSession("MEMBER-A");
        mvc.perform(patch("/api/v1/members/me/profile").session(session).header("X-XSRF-TOKEN", csrf(session))
            .contentType("application/json").content("{\"phone\":\"<invalid>\",\"address\":\"Demo\"}"))
            .andExpect(status().isBadRequest());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void databaseErrorsDoNotDiscloseSqlOrMemberDetails() throws Exception {
        when(jdbc.queryForList(contains("FROM claims"), eq("MEMBER-A")))
            .thenThrow(new DataAccessResourceFailureException("sensitive SQL and connection detail"));
        var result = mvc.perform(get("/api/v1/members/me/claims").session(memberSession("MEMBER-A")))
            .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"))
            .andReturn();
        assertFalse(result.getResponse().getContentAsString().contains("sensitive"));
    }
}
