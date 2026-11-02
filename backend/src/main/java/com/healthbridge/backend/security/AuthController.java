package com.healthbridge.backend.security;

import java.util.Map;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.web.csrf.CsrfTokenRepository;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.web.csrf.CsrfToken;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final MemberAuthenticationService authenticationService;

    private final CsrfTokenRepository csrfTokens;

    public AuthController(MemberAuthenticationService authenticationService, CsrfTokenRepository csrfTokens) {
        this.authenticationService = authenticationService;
        this.csrfTokens = csrfTokens;
    }

    public record LoginRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(max = 72) String password
    ) {
        @Override
        public String toString() { return "LoginRequest[redacted]"; }
    }

    @GetMapping("/csrf")
    public Map<String, String> csrf(CsrfToken token) {
        return Map.of("token", token.getToken());
    }

    @PostMapping("/login")
    public Map<String, Object> login(
        @Valid @RequestBody LoginRequest request,
        HttpServletRequest httpRequest,
        HttpServletResponse httpResponse
    ) {
        Authentication authentication;

        try {
            authentication = authenticationService.authenticate(
                request.email(),
                request.password()
            );
        } catch (BadCredentialsException ex) {
            throw new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "Invalid email or password"
            );
        }

        httpRequest.getSession(true);
        httpRequest.changeSessionId();
        // A token from the anonymous session must not survive successful login.
        csrfTokens.saveToken(null, httpRequest, httpResponse);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);

        new HttpSessionSecurityContextRepository()
            .saveContext(context, httpRequest, httpResponse);

        return sessionUser(authentication);
    }

    private Map<String, Object> sessionUser(Authentication authentication) {
        return Map.of("memberId", authentication.getName(), "roles", authentication.getAuthorities().stream()
            .map(authority -> authority.getAuthority().replaceFirst("^ROLE_", "")).sorted().toList());
    }

    @GetMapping("/me")
    public Map<String, Object> me(Authentication authentication) {
        return sessionUser(authentication);
    }
}
