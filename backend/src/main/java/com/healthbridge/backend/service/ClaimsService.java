package com.healthbridge.backend.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ClaimsService {

    private final JdbcTemplate jdbcTemplate;

    public ClaimsService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Map<String, Object>> getClaims(String memberId) {
        String sql = """
            SELECT
                regexp_replace(claim_number, '^CLM-?', 'CLM-') AS "id",
                provider_name AS "provider",
                service AS "service",
                to_char(service_date, 'YYYY-MM-DD') AS "serviceDate",
                to_char(submitted_date, 'YYYY-MM-DD') AS "submittedDate",
                claim_status AS "status",
                billed_amount AS "billedAmount",
                CASE
                    WHEN claim_status = 'Pending' THEN NULL
                    ELSE insurance_paid
                END AS "insurancePaid",
                CASE
                    WHEN claim_status = 'Pending' THEN NULL
                    ELSE member_responsibility
                END AS "memberResponsibility",
                notes AS "notes", review_notes AS "reviewNotes",
                CASE WHEN claim_status='Pending' THEN NULL ELSE allowed_amount END AS "allowedAmount",
                deductible_applied AS "deductibleApplied",oop_applied AS "oopApplied"
            FROM claims
            WHERE member_id = ?
            ORDER BY claim_number
            """;

        return jdbcTemplate.queryForList(sql, memberId);
    }
}
