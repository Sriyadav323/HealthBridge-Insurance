package com.healthbridge.backend;

import com.healthbridge.backend.security.AuthController;
import com.healthbridge.backend.security.MemberAuthenticationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AuthControllerTests {
    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void loginWithoutExistingSessionPersistsAuthenticatedMember() {
        var service = new MemberAuthenticationService(null, new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder()) {
            @Override
            public Authentication authenticate(String email, String password) {
                return UsernamePasswordAuthenticationToken.authenticated("HB100245", null, List.of());
            }
        };
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();
        assertNull(request.getSession(false));

        var result = new AuthController(service, new org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository()).login(
            new AuthController.LoginRequest("member@example.com", "test-password"), request, response);

        assertEquals("HB100245", result.get("memberId"));
        var session = request.getSession(false);
        assertNotNull(session);
        var context = (SecurityContext) session.getAttribute(
            HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
        assertNotNull(context);
        assertTrue(context.getAuthentication().isAuthenticated());
        assertEquals("HB100245", context.getAuthentication().getName());
    }
}
