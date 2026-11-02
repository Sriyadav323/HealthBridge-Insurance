package com.healthbridge.backend.security;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class PasswordResetController {
    private final java.util.concurrent.ThreadPoolExecutor delivery = new java.util.concurrent.ThreadPoolExecutor(
        2, 2, 0L, java.util.concurrent.TimeUnit.SECONDS, new java.util.concurrent.ArrayBlockingQueue<>(100),
        task -> { var thread = new Thread(task, "password-reset-delivery"); thread.setDaemon(true); return thread; });
    private final java.util.Map<String, java.util.ArrayDeque<Long>> requests = new java.util.HashMap<>();
    @jakarta.annotation.PreDestroy
    void close() { delivery.shutdownNow(); }
    private synchronized void limit(String address) {
        long now = System.currentTimeMillis();
        requests.entrySet().removeIf(entry -> entry.getValue().isEmpty() || entry.getValue().getLast() < now - 60000);
        if (!requests.containsKey(address) && requests.size() >= 10000) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Please wait a minute before trying again.");
        var times = requests.computeIfAbsent(address, ignored -> new java.util.ArrayDeque<>());
        while (!times.isEmpty() && times.getFirst() < now - 60000) times.removeFirst();
        if (times.size() >= 5) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Please wait a minute before trying again.");
        times.addLast(now);
    }
    private final PasswordResetService reset;
    private final ResetEmailSender mail;
    public PasswordResetController(PasswordResetService reset, ResetEmailSender mail) { this.reset=reset; this.mail=mail; }
    public record Request(@NotBlank @Email @Size(max=255) String email) {
        @Override public String toString() { return "ResetRequest[redacted]"; }
    }
    public record Completion(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String token,
        @NotNull @Size(min=12,max=72) String password) {
        @Override public String toString() { return "ResetCompletion[redacted]"; }
    }
    @PostMapping("/forgot-password") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void request(@Valid @RequestBody Request input, jakarta.servlet.http.HttpServletRequest request) {
        limit(request.getRemoteAddr());
        mail.requireConfiguration();
        try {
            delivery.execute(() -> {
                try { reset.request(input.email()); }
                catch (RuntimeException failure) {
                    org.slf4j.LoggerFactory.getLogger(getClass()).warn("Password reset delivery could not be completed.");
                }
            });
        } catch (java.util.concurrent.RejectedExecutionException full) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Password recovery is busy. Please try again shortly.");
        }
    }

    @PostMapping("/reset-password") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void complete(@Valid @RequestBody Completion input) { reset.complete(input.token(), input.password()); }
}
