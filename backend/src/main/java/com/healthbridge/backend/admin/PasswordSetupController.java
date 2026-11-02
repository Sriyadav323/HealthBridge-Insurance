package com.healthbridge.backend.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class PasswordSetupController {
    private final PasswordSetupService setup;
    public PasswordSetupController(PasswordSetupService setup) { this.setup = setup; }
    public record PasswordSetup(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String token,
        @NotNull @Size(min=12,max=72) String password) {
        @Override public String toString() { return "PasswordSetup[redacted]"; }
    }
    @PostMapping("/password-setup") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void complete(@Valid @RequestBody PasswordSetup input) { setup.complete(input.token(), input.password()); }
}
