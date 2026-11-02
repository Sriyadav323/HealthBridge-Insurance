package com.healthbridge.backend.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class BenefitsService {

    private final JdbcTemplate jdbc;

    public BenefitsService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> getBenefits(String memberId) {

        Map<String, Object> member = jdbc.queryForMap("""
            SELECT
                m.member_id AS "memberId",
                m.full_name AS "memberName",
                m.plan_name AS "planName",
                m.plan_type AS "planType",
                CASE WHEN m.insurance_plan_id IS NOT NULL AND CURRENT_DATE NOT BETWEEN m.coverage_effective_from AND m.coverage_effective_to
                    THEN 'Inactive' ELSE m.coverage_status END AS "coverageStatus",
                m.coverage_effective_from AS "effectiveFrom", m.coverage_effective_to AS "effectiveTo",
                (b.member_id IS NOT NULL AND NOT m.benefits_review_required) AS "benefitsConfigured",
                COALESCE(b.deductible_total,0) AS deductible_total,
                COALESCE(b.deductible_met,0) AS deductible_met,
                COALESCE(b.oop_maximum,0) AS oop_maximum,
                COALESCE(b.oop_spent,0) AS oop_spent,
                COALESCE(b.copay_primary_care,0) AS copay_primary_care,
                COALESCE(b.copay_specialist,0) AS copay_specialist,
                COALESCE(b.copay_urgent_care,0) AS copay_urgent_care
            FROM members m
            LEFT JOIN member_benefits b
              ON m.member_id = b.member_id
            WHERE m.member_id = ?
            """, memberId);

        List<Map<String, Object>> coverage = jdbc.queryForList("""
            SELECT
                id, category, name, status, cost, notes
            FROM coverage_items
            WHERE member_id = ?
            ORDER BY display_order
            """, memberId);

        Map<String, Object> result = new LinkedHashMap<>();

        result.put("benefitsConfigured", !Boolean.FALSE.equals(member.get("benefitsConfigured")));
        result.put("effectiveFrom", member.get("effectiveFrom") == null ? null : member.get("effectiveFrom").toString());
        result.put("effectiveTo", member.get("effectiveTo") == null ? null : member.get("effectiveTo").toString());
        result.put("memberId", member.get("memberId"));
        result.put("memberName", member.get("memberName"));
        result.put("planName", member.get("planName"));
        result.put("planType", member.get("planType"));
        result.put("coverageStatus", member.get("coverageStatus"));

        result.put("deductible", Map.of(
            "total", member.get("deductible_total"),
            "met", member.get("deductible_met")
        ));

        result.put("outOfPocket", Map.of(
            "maximum", member.get("oop_maximum"),
            "spent", member.get("oop_spent")
        ));

        result.put("copays", Map.of(
            "primaryCare", member.get("copay_primary_care"),
            "specialist", member.get("copay_specialist"),
            "urgentCare", member.get("copay_urgent_care")
        ));

        result.put("coverage", coverage);

        return result;
    }
}
