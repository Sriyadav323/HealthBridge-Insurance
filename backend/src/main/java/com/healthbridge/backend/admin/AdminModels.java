package com.healthbridge.backend.admin;

import java.time.Instant;
import java.util.List;
import jakarta.validation.constraints.*;

public final class AdminModels {
    private AdminModels() {}

    public record MemberWrite(
        @NotBlank @Size(max = 150) String fullName,
        @NotBlank @Email @Size(max = 255) String email,
        @NotNull @Size(max = 30) @Pattern(regexp = "[+0-9() .-]*") String phone,
        @NotNull @Size(max = 255) String address,
        @NotBlank @Size(max = 150) String planName,
        @NotNull @Pattern(regexp = "HMO|PPO|EPO") String planType,
        @NotNull @Pattern(regexp = "Active|Inactive") String coverageStatus,
        @PositiveOrZero Long version,
        @Positive Long planId
    ) {}

    public record AccountUpdate(@NotNull Boolean enabled, @NotNull @PositiveOrZero Long version) {}
    public record VersionRequest(@NotNull @PositiveOrZero Long version) {}
    public record MemberSummary(String memberId, String fullName, String email, String phone,
        String planName, String planType, String coverageStatus, Boolean accountEnabled,
        boolean passwordSetupRequired, String registeredAt, long version) {}
    public record MemberDetails(MemberSummary summary, String address) {}
    public record MemberPage(List<MemberSummary> items, long totalElements, long totalPages, int page, int size) {}
    public record Dashboard(long totalMembers, long activeMembers, long inactiveMembers,
        long enabledAccounts, List<MemberSummary> recentRegistrations) {}
    public record SetupLink(String token, Instant expiresAt) {
        @Override public String toString() { return "SetupLink[redacted]"; }
    }
    public record Registration(MemberDetails details, String setupToken, Instant setupExpiresAt) {
        @Override public String toString() { return "Registration[redacted]"; }
    }
}
