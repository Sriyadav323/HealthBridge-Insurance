package com.healthbridge.backend.admin;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.*;
import java.math.BigDecimal;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@Service
public class AdminClaimsService {
    public record Create(@NotBlank @Size(max=30) String memberId, @NotBlank @Size(max=20) String coverageItemId,
        @NotBlank @Size(max=150) String provider, @NotNull @PastOrPresent LocalDate serviceDate,
        @NotNull @Min(0) @Max(1000000) Integer billedAmount, @NotNull @Size(max=2000) String notes) {}
    public record CoverageReview(@NotNull @PositiveOrZero Long version,
        @NotBlank @Size(max=20) String coverageItemId, @NotNull @AssertTrue Boolean confirmed) {}
    public record Review(@NotNull @PositiveOrZero Long version, @NotNull @Pattern(regexp="Approved|Denied") String status,
        @NotNull @Min(0) @Max(1000000) Integer allowedAmount, @NotNull @Min(0) @Max(1000000) Integer insurancePaid,
        @NotNull @Min(0) @Max(1000000) Integer memberResponsibility,
        @NotNull @Min(0) @Max(1000000) Integer deductibleApplied, @NotNull @Min(0) @Max(1000000) Integer oopApplied,
        @NotBlank @Size(max=2000) String reviewNotes) {}
    public record Page(List<Map<String,Object>> items,long total,int page,int size) {}
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    public AdminClaimsService(JdbcTemplate jdbc,ObjectMapper json) { this.jdbc=jdbc; this.json=json; }
    private static final String COLUMNS="""
        SELECT c.claim_number AS "id", c.member_id AS "memberId", m.full_name AS "memberName",
        c.provider_name AS "provider",c.service AS "service",to_char(c.service_date,'YYYY-MM-DD') AS "serviceDate",
        to_char(c.submitted_date,'YYYY-MM-DD') AS "submittedDate",c.claim_status AS "status",c.billed_amount AS "billedAmount",
        c.allowed_amount AS "allowedAmount",c.insurance_paid AS "insurancePaid",c.member_responsibility AS "memberResponsibility",
        c.deductible_applied AS "deductibleApplied",c.oop_applied AS "oopApplied",c.notes AS "notes",c.review_notes AS "reviewNotes",
        c.reviewed_by AS "reviewedBy",to_char(c.reviewed_at,'YYYY-MM-DD HH24:MI:SS') AS "reviewedAt",c.version AS "version",c.coverage_snapshot::text AS "coverageSnapshot",c.insurance_plan_id AS "planId",c.benefit_year AS "benefitYear"
        FROM claims c JOIN members m ON m.member_id=c.member_id
        """;
    public Page list(String search,String status,int page,int size) {
        String where=" WHERE strpos(lower(concat_ws(' ',c.claim_number,m.full_name,c.member_id,c.provider_name,c.service)),lower(?))>0 AND (?='' OR c.claim_status=?)";
        Long total=jdbc.queryForObject("SELECT count(*) FROM claims c JOIN members m ON m.member_id=c.member_id"+where,Long.class,search,status,status);
        return new Page(jdbc.queryForList(COLUMNS+where+" ORDER BY c.submitted_date DESC NULLS LAST,c.id DESC LIMIT ? OFFSET ?",search,status,status,size,(long)page*size),total==null?0:total,page,size);
    }
    public Map<String,Object> detail(String id) {
        var rows=jdbc.queryForList(COLUMNS+" WHERE c.claim_number=?",id);
        if(rows.isEmpty()) throw problem(HttpStatus.NOT_FOUND,"Claim not found.");
        return rows.getFirst();
    }
    public Map<String,Object> coverage(String id) {
        var rows=jdbc.queryForList("""
            SELECT m.member_id AS "memberId",m.full_name AS "memberName",m.plan_name AS "planName",m.coverage_status AS "coverageStatus",
            m.insurance_plan_id AS "planId",m.benefit_year AS "benefitYear",
            to_char(m.coverage_effective_from,'YYYY-MM-DD') AS "effectiveFrom",to_char(m.coverage_effective_to,'YYYY-MM-DD') AS "effectiveTo",
            b.deductible_total AS "deductibleTotal",b.deductible_met AS "deductibleMet",b.oop_maximum AS "oopMaximum",b.oop_spent AS "oopSpent"
            FROM members m JOIN member_benefits b ON b.member_id=m.member_id
            WHERE m.member_id=? AND NOT m.benefits_review_required AND m.insurance_plan_id IS NOT NULL
            AND NOT EXISTS(SELECT 1 FROM account_roles r WHERE r.member_id=m.member_id AND r.role_name='ADMIN')
            """,id);
        if(rows.isEmpty()) throw problem(HttpStatus.CONFLICT,"Assign a published insurance plan to this member before creating claims.");
        var result=new LinkedHashMap<>(rows.getFirst());
        result.put("items",jdbc.queryForList("SELECT id,name,category,status,cost,notes FROM coverage_items WHERE member_id=? ORDER BY display_order",id));
        return result;
    }
    @Transactional
    public Map<String,Object> create(Create w) {
        jdbc.queryForList("SELECT member_id FROM members WHERE member_id=? FOR UPDATE",w.memberId());
        var snapshot=verifiedCoverage(w.memberId(),w.coverageItemId(),w.serviceDate());
        @SuppressWarnings("unchecked") var item=(Map<String,Object>)snapshot.get("service");
        String id="CLM-"+UUID.randomUUID().toString().replace("-","").substring(0,24).toUpperCase(Locale.ROOT);
        jdbc.update("""
            INSERT INTO claims(claim_number,member_id,provider_name,service_date,claim_status,billed_amount,insurance_paid,member_responsibility,
                service,submitted_date,notes,insurance_plan_id,benefit_year,coverage_snapshot)
            VALUES(?,?,?,?,'Pending',?,0,0,?,CURRENT_DATE,?,?,?,?::jsonb)
            """,id,w.memberId(),w.provider().strip(),w.serviceDate(),w.billedAmount(),item.get("name"),w.notes(),snapshot.get("planId"),snapshot.get("benefitYear"),json.writeValueAsString(snapshot));
        return detail(id);
    }
    private Map<String,Object> verifiedCoverage(String member,String service,LocalDate serviceDate) {
        var snapshot=coverage(member);
        if(!"Active".equals(snapshot.get("coverageStatus"))) throw problem(HttpStatus.BAD_REQUEST,"This member does not have active coverage.");
        LocalDate from=LocalDate.parse((String)snapshot.get("effectiveFrom")),to=LocalDate.parse((String)snapshot.get("effectiveTo"));
        if(serviceDate.isBefore(from)||serviceDate.isAfter(to)) throw problem(HttpStatus.BAD_REQUEST,"The service date must fall within the member's assigned coverage period. Review the member's enrollment before proceeding.");
        var items=jdbc.queryForList("SELECT id,name,category,status,cost,notes FROM coverage_items WHERE member_id=? AND id=?",member,service);
        if(items.size()!=1) throw problem(HttpStatus.BAD_REQUEST,"Select a service from this member's assigned coverage.");
        snapshot.remove("items");snapshot.put("service",items.getFirst());
        return snapshot;
    }
    @Transactional
    public Map<String,Object> confirmCoverage(String id,CoverageReview input,String reviewer) {
        if(!Boolean.TRUE.equals(input.confirmed())) throw problem(HttpStatus.BAD_REQUEST,"Confirm the applicable coverage before proceeding.");
        var candidates=jdbc.queryForList("SELECT member_id FROM claims WHERE claim_number=?",id);
        if(candidates.isEmpty()) throw problem(HttpStatus.NOT_FOUND,"Claim not found.");
        String member=(String)candidates.getFirst().get("member_id");
        jdbc.queryForList("SELECT member_id FROM members WHERE member_id=? FOR UPDATE",member);
        var claim=jdbc.queryForMap("SELECT * FROM claims WHERE claim_number=? FOR UPDATE",id);
        if(!"Pending".equals(claim.get("claim_status")) || ((Number)claim.get("version")).longValue()!=input.version() || claim.get("coverage_snapshot")!=null)
            throw problem(HttpStatus.CONFLICT,"This claim changed or already has confirmed coverage. Reload it.");
        var snapshot=verifiedCoverage(member,input.coverageItemId(),((java.sql.Date)claim.get("service_date")).toLocalDate());
        snapshot.put("coverageConfirmedBy",reviewer);
        snapshot.put("coverageConfirmedAt",java.time.Instant.now().toString());
        jdbc.update("UPDATE claims SET coverage_snapshot=?::jsonb,insurance_plan_id=?,benefit_year=?,version=version+1 WHERE claim_number=?",
            json.writeValueAsString(snapshot),snapshot.get("planId"),snapshot.get("benefitYear"),id);
        return detail(id);
    }
    @Transactional
    public Map<String,Object> review(String id,Review w,String reviewer) {
        var candidate=jdbc.queryForList("SELECT member_id FROM claims WHERE claim_number=?",id);
        if(candidate.isEmpty()) throw problem(HttpStatus.NOT_FOUND,"Claim not found.");
        String member=(String)candidate.getFirst().get("member_id");
        // Consistent member -> claim -> benefits lock order serializes assignment and finalization.
        var memberRows=jdbc.queryForList("SELECT insurance_plan_id,benefit_year FROM members WHERE member_id=? FOR UPDATE",member);
        var claim=jdbc.queryForMap("SELECT * FROM claims WHERE claim_number=? FOR UPDATE",id);
        if(!"Pending".equals(claim.get("claim_status"))||((Number)claim.get("version")).longValue()!=w.version())
            throw problem(HttpStatus.CONFLICT,"This claim was already finalized or changed. Reload the claim.");
        boolean approved="Approved".equals(w.status());
        BigDecimal billed=new BigDecimal(claim.get("billed_amount").toString());
        if(BigDecimal.valueOf(w.allowedAmount()).compareTo(billed)>0
            || w.insurancePaid()+w.memberResponsibility()!=w.allowedAmount()
            || w.deductibleApplied()>w.oopApplied() || w.oopApplied()>w.memberResponsibility())
            throw problem(HttpStatus.BAD_REQUEST,"Allowed amount must equal insurance paid plus member responsibility, must not exceed billed amount, and spending allocations must fit the member responsibility.");
        if(!approved && (w.insurancePaid()!=0||w.deductibleApplied()!=0||w.oopApplied()!=0))
            throw problem(HttpStatus.BAD_REQUEST,"Denied claims cannot pay insurance benefits or increase deductible/out-of-pocket spending.");
        if(approved) {
            if(claim.get("coverage_snapshot")==null) throw problem(HttpStatus.CONFLICT,"This historical claim has no coverage snapshot and requires separate review.");
            var snapshot=json.readTree(claim.get("coverage_snapshot").toString());
            if(!"Covered".equals(snapshot.path("service").path("status").asText())) throw problem(HttpStatus.BAD_REQUEST,"This service is excluded from the assigned coverage and cannot be approved.");
            var current=memberRows.getFirst();
            if(!Objects.equals(current.get("insurance_plan_id"),claim.get("insurance_plan_id")) || !Objects.equals(current.get("benefit_year"),claim.get("benefit_year")))
                throw problem(HttpStatus.CONFLICT,"The member's plan or benefit year changed. Review this claim before applying spending to another enrollment.");
            var benefits=jdbc.queryForMap("SELECT * FROM member_benefits WHERE member_id=? FOR UPDATE",member);
            long met=((Number)benefits.get("deductible_met")).longValue(),spent=((Number)benefits.get("oop_spent")).longValue();
            if(w.deductibleApplied()>Math.max(0,((Number)benefits.get("deductible_total")).longValue()-met)
                || w.oopApplied()>Math.max(0,((Number)benefits.get("oop_maximum")).longValue()-spent))
                throw problem(HttpStatus.BAD_REQUEST,"Spending allocations exceed the member's remaining deductible or out-of-pocket maximum.");
            jdbc.update("UPDATE member_benefits SET deductible_met=deductible_met+?,oop_spent=oop_spent+? WHERE member_id=?",w.deductibleApplied(),w.oopApplied(),member);
        }
        jdbc.update("""
            UPDATE claims SET claim_status=?,allowed_amount=?,insurance_paid=?,member_responsibility=?,deductible_applied=?,oop_applied=?,
            review_notes=?,reviewed_at=CURRENT_TIMESTAMP,reviewed_by=?,version=version+1 WHERE claim_number=?
            """,w.status(),w.allowedAmount(),w.insurancePaid(),w.memberResponsibility(),w.deductibleApplied(),w.oopApplied(),w.reviewNotes(),reviewer,id);
        return detail(id);
    }
    private ResponseStatusException problem(HttpStatus status,String message) { return new ResponseStatusException(status,message); }
}
