package com.healthbridge.backend.api;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/members/me")
public class MemberFeaturesController {
    private final JdbcTemplate jdbc;
    public MemberFeaturesController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record ContactUpdate(String phone, String address) {}

    @GetMapping("/profile")
    public Map<String, Object> profile(Authentication auth) {
        return jdbc.queryForMap("""
            SELECT m.member_id AS "memberId", m.full_name AS "fullName",
                   a.email AS "email", m.phone AS "phone", m.address AS "address",
                   m.plan_name AS "planName", m.plan_type AS "planType",
                   m.coverage_status AS "coverageStatus"
            FROM members m JOIN member_accounts a ON m.member_id = a.member_id
            WHERE m.member_id = ?
            """, auth.getName());
    }

    @PatchMapping("/profile")
    public Map<String, Object> updateProfile(@RequestBody ContactUpdate input, Authentication auth) {
        if (input == null || input.phone() == null || input.address() == null
                || input.phone().length() > 30 || input.address().length() > 255
                || !input.phone().matches("[+0-9() .-]*")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid contact information");
        }
        int updated = jdbc.update("UPDATE members SET phone = ?, address = ?, version = version + 1 WHERE member_id = ?",
                input.phone().trim(), input.address().trim(), auth.getName());
        if (updated != 1) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Member profile not found");
        }
        return profile(auth);
    }

    @GetMapping("/prescriptions")
    public List<Map<String, Object>> prescriptions(Authentication auth) {
        return jdbc.queryForList("""
            SELECT id, medication, dosage, pharmacy, refill_status AS "refillStatus",
                   refills_remaining AS "refillsRemaining", last_filled AS "lastFilled"
            FROM prescriptions WHERE member_id = ? ORDER BY last_filled DESC NULLS LAST, id DESC
            """, auth.getName());
    }
}
