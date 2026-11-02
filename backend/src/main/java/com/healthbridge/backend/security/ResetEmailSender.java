package com.healthbridge.backend.security;

import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@Component
public class ResetEmailSender {
    private final String key, from, origin;
    private final ObjectMapper json;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    public ResetEmailSender(@Value("${SENDGRID_API_KEY:}") String key,
        @Value("${SENDGRID_FROM_EMAIL:}") String from,
        @Value("${APP_PUBLIC_URL:http://localhost:5173}") String origin, ObjectMapper json) {
        this.key=key; this.from=from; this.origin=origin.replaceAll("/+$", ""); this.json=json;
    }
    public void requireConfiguration() {
        if (key.isBlank() || from.isBlank()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
            "Password recovery is temporarily unavailable. Please contact support.");
    }
    public void send(String email, String token) {
        requireConfiguration();
        String link = origin + "/reset-password#token=" + token;
        var body = Map.of("personalizations", List.of(Map.of("to", List.of(Map.of("email", email)))),
            "from", Map.of("email", from), "subject", "Reset your HealthBridge password",
            "tracking_settings", Map.of("click_tracking", Map.of("enable", false, "enable_text", false)),
            "content", List.of(Map.of("type", "text/plain", "value",
                "Reset your HealthBridge password for the member or admin portal:\n\n" + link
                + "\n\nThis link expires in 30 minutes and works once. If you did not request this, ignore this email. Your password has not changed.")));
        try {
            var request = HttpRequest.newBuilder(URI.create("https://api.sendgrid.com/v3/mail/send"))
                .timeout(Duration.ofSeconds(10)).header("Authorization", "Bearer " + key)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build();
            var response = client.send(request, HttpResponse.BodyHandlers.discarding());
            if (response.statusCode() != 202) throw new IllegalStateException("Email delivery failed");
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt(); throw new IllegalStateException("Email delivery interrupted");
        } catch (Exception failure) {
            // Never log provider responses, recipient addresses, or reset credentials.
            throw new IllegalStateException("Email delivery failed");
        }
    }
}
